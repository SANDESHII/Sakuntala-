import { AnalysisResult, InternalTeamData, HistoricalMatch } from '../types';
import { TEAM_STATS, LEAGUE_CONFIGS } from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from './calibration';
import { FeatureEngine } from './features';
import { TeamRegistry } from '../data/identity/registry';

/**
 * Prediction Pipeline Configuration
 */
const MODEL_CONFIG = {
  LEAGUE_AVG_GOALS: Calibration.BASE_GOALS,
  HOME_ADVANTAGE_WEIGHT: 0.5,
  AWAY_DEFENSE_WEIGHT: 0.3,
  EDGE_THRESHOLD: 0.03,
  MAX_LAMBDA: 4.0,
  MIN_LAMBDA: 0.3,
  MAX_MU: 3.5,
  MIN_MU: 0.2,
  KELLY_FRACTION: 0.35, // 1/3 Kelly discount for model error
};

/**
 * Smart team lookup using TeamRegistry for safe canonical resolution.
 */
const findTeamDetailed = (teamName: string): InternalTeamData | null => {
  try {
    const identity = TeamRegistry.resolveByName(teamName);
    return TEAM_STATS[identity.id] ?? null;
  } catch {
    return null; // Fall through to league-average, don't guess
  }
};

/**
 * Resolves team data from live API or local fallback
 */
async function resolveTeamData(
  teamName: string, 
  leagueKey: string, 
  leagueConfig: any,
  asOfDate?: string,
  fixtureCache?: Record<string, HistoricalMatch[]>
): Promise<{ 
  data: InternalTeamData; 
  isGeneric: boolean; 
  dataSource: 'LIVE' | 'FALLBACK_STATIC';
}> {
  // 1. Point-in-time historical mode
  if (asOfDate) {
    const historicalData = await FeatureEngine.computeFeatures(teamName, leagueKey, asOfDate, fixtureCache?.[leagueKey]);
    return {
      data: historicalData,
      isGeneric: historicalData.quality === 'low',
      dataSource: 'FALLBACK_STATIC'
    };
  }

  // 2. Try Live API
  const liveData = await FreeDataService.getTeamStats(teamName, leagueKey);
  if (liveData) return { data: liveData, isGeneric: false, dataSource: 'LIVE' };

  // 3. Try Local Database
  const staticData = findTeamDetailed(teamName);
  if (staticData) {
    const data = { ...staticData };
    if (FreeDataService.isLiveCapable) {
      data.form = [1, 1, 1, 1, 1];
    }

    return { 
      data, 
      isGeneric: false, 
      dataSource: 'FALLBACK_STATIC'
    };
  }

  // 3. Fallback to League Averages
  return {
    isGeneric: true,
    dataSource: 'FALLBACK_STATIC',
    data: {
      attackStrength: 1.15,
      defenseStrength: 0.90,
      avgGoalsScored: 1.45,
      avgGoalsConceded: 1.35,
      homeAdvantageHeuristic: leagueConfig.homeAdvantage,
      form: [1, 1, 1, 1, 1],
      cleanSheetRate: 0.25,
    }
  };
}

/**
 * HEURISTIC FALLBACK MODEL
 * 
 * Specification:
 * lambda = alpha_i * beta_j * LeagueAvg * (1 + blendedHomeAdv * HomeWeight)
 * mu     = alpha_j * beta_i * LeagueAvg * (1 - LeagueHomeAdv * AwayWeight)
 * 
 * This model uses hand-tuned weights and blended team/league averages
 * for cold-start scenarios or when MLE fitting is unavailable.
 */
function runHeuristicModel(
  homeData: InternalTeamData,
  awayData: InternalTeamData,
  leagueConfig: any
) {
  const leagueAvg = leagueConfig.goalRate * MODEL_CONFIG.LEAGUE_AVG_GOALS;
  
  // Blended home advantage: 60% league constant, 40% team-specific variation
  const blendedHomeAdv = (leagueConfig.homeAdvantage * 0.6) + (homeData.homeAdvantageHeuristic * 0.4);
  
  // Base xG calculation
  let lambdaHome = homeData.attackStrength * awayData.defenseStrength * leagueAvg * (1 + blendedHomeAdv * MODEL_CONFIG.HOME_ADVANTAGE_WEIGHT);
  let muAway = awayData.attackStrength * homeData.defenseStrength * leagueAvg * (1 - leagueConfig.homeAdvantage * MODEL_CONFIG.AWAY_DEFENSE_WEIGHT);

  // Sanity clamping
  lambdaHome = Math.max(MODEL_CONFIG.MIN_LAMBDA, Math.min(MODEL_CONFIG.MAX_LAMBDA, lambdaHome));
  muAway = Math.max(MODEL_CONFIG.MIN_MU, Math.min(MODEL_CONFIG.MAX_MU, muAway));

  const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, -0.13);

  return {
    lambdaHome,
    muAway,
    probOver25: DixonColes.calculateOverUnder(scoreMatrix, 2.5),
    probUnder25: 1 - DixonColes.calculateOverUnder(scoreMatrix, 2.5)
  };
}

/**
 * Main prediction engine using Dixon-Coles model
 */
export async function runPrediction(
  homeTeam: string,
  awayTeam: string,
  league: string,
  fittedOverride: Calibration.FittedLeagueParams | null = null,
  historicalOddsOverride: any = null,
  adaptiveThresholdContext: any[] | null = null,
  asOfDate?: string,
  fixtureCache?: Record<string, HistoricalMatch[]>
): Promise<AnalysisResult> {
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const leagueConfig = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['STANDARD'];

  // Parallel data resolution
  const [homeRes, awayRes, liveOdds, fittedParams] = await Promise.all([
    resolveTeamData(homeTeam, leagueKey, leagueConfig, asOfDate, fixtureCache),
    resolveTeamData(awayTeam, leagueKey, leagueConfig, asOfDate, fixtureCache),
    historicalOddsOverride ? Promise.resolve([]) : FreeDataService.getLiveOdds(leagueKey),
    fittedOverride ? Promise.resolve(fittedOverride) : Calibration.fitFromAPI(leagueKey, asOfDate, fixtureCache?.[leagueKey])
  ]);

  // Use MLE fitted goals if available, otherwise fallback to local stats model
  const mleGoals = Calibration.predictGoals(fittedParams, homeTeam, awayTeam);
  
  let lambdaHome: number;
  let muAway: number;
  let probOver25: number;
  let probUnder25: number;
  let finalRho = -0.13;
  let scoreMatrix: number[][];
  let modelSource: 'MLE_FITTED' | 'HEURISTIC_FALLBACK';
  let modelSpecification = '';
  let isLowConfidence = false;

  if (mleGoals) {
    lambdaHome = mleGoals.lambdaHome;
    muAway = mleGoals.muAway;
    finalRho = fittedParams.rho;
    scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, finalRho);
    modelSource = 'MLE_FITTED';
    modelSpecification = 'MLE Dixon-Coles (λ = αiβjγ, μ = αjβi)';
    isLowConfidence = mleGoals.lowConfidence;
  } else {
    const metrics = runHeuristicModel(homeRes.data, awayRes.data, leagueConfig);
    lambdaHome = metrics.lambdaHome;
    muAway = metrics.muAway;
    scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, -0.13);
    modelSource = 'HEURISTIC_FALLBACK';
    modelSpecification = 'Heuristic Blended (Hand-tuned Weights & Biases)';
  }

  probOver25 = DixonColes.calculateOverUnder(scoreMatrix, 2.5);
  probUnder25 = 1 - DixonColes.calculateOverUnder(scoreMatrix, 2.5);

  // Monte Carlo Simulation for Uncertainty Propagation
  const mcResults = DixonColes.runMonteCarlo(lambdaHome, muAway, finalRho, 10000, 0.12);

  // Goal Distribution Calculation
  const distribution: { goals: string; probability: number }[] = [
    { goals: '0', probability: 0 },
    { goals: '1', probability: 0 },
    { goals: '2', probability: 0 },
    { goals: '3', probability: 0 },
    { goals: '4+', probability: 0 },
  ];

  scoreMatrix.forEach((row, h) => {
    row.forEach((p, a) => {
      const total = h + a;
      if (total <= 3) {
        distribution[total].probability += p;
      } else {
        distribution[4].probability += p;
      }
    });
  });

  distribution.forEach(d => d.probability = Math.round(d.probability * 100));

  // Market odds resolution
  let marketOddsOver25 = 1.05 / probOver25; 
  let marketOddsUnder25 = 1.05 / probUnder25; 
  let over25Real = false;
  let under25Real = false;
  let matchOdds: any = null;

  over25Real = !!historicalOddsOverride?.over25?.bestPrice;
  under25Real = !!historicalOddsOverride?.under25?.bestPrice;

  if (historicalOddsOverride) {
    marketOddsOver25 = historicalOddsOverride.over25?.bestPrice || marketOddsOver25;
    marketOddsUnder25 = historicalOddsOverride.under25?.bestPrice || marketOddsUnder25;
  } else {
    matchOdds = liveOdds.find((o: any) => {
      try {
        const oHomeId = TeamRegistry.resolveByName(o.home_team).id;
        const currentHomeId = TeamRegistry.resolveByName(homeTeam).id;
        return oHomeId === currentHomeId;
      } catch {
        return false;
      }
    });

    if (matchOdds) {
      matchOdds.bookmakers.forEach((bm: any) => {
        const market = bm.markets.find((m: any) => m.key === 'totals');
        if (market) {
          const o25 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 2.5);
          const u25 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 2.5);
          
          if (o25 && (!over25Real || o25.price > marketOddsOver25)) {
            marketOddsOver25 = o25.price;
            over25Real = true;
          }
          if (u25 && (!under25Real || u25.price > marketOddsUnder25)) {
            marketOddsUnder25 = u25.price;
            under25Real = true;
          }
        }
      });
    }
  }

  // Market edge computed against raw bookmaker price (bestPrice). 
  const over25Edge = probOver25 - (1 / marketOddsOver25);
  const under25Edge = probUnder25 - (1 / marketOddsUnder25);

  // Adaptive Threshold Logic
  const getThreshold = (edgeVal: number) => {
    const baseThreshold = MODEL_CONFIG.EDGE_THRESHOLD;
    if (!adaptiveThresholdContext) return baseThreshold;

    const absEdge = Math.abs(edgeVal * 100);
    const segment = adaptiveThresholdContext.find(s => absEdge >= s.min && absEdge < s.max);
    
    if (segment && segment.avgClv < 0) {
        return baseThreshold + 0.01;
    }
    return baseThreshold;
  };

  const currentOverThreshold = getThreshold(over25Edge);
  const currentUnderThreshold = getThreshold(under25Edge);

  // Result arbitration
  let predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET' = 'NO_BET';
  let probability = probOver25 > probUnder25 ? Math.round(probOver25 * 100) : Math.round(probUnder25 * 100);
  let edge = 0;
  let marketOdds = probOver25 > probUnder25 ? marketOddsOver25 : marketOddsUnder25;

  if (!isLowConfidence) {
    if (over25Edge > under25Edge && over25Edge > currentOverThreshold) {
      predictionType = 'OVER_25';
      probability = Math.round(probOver25 * 100);
      edge = Math.round(over25Edge * 1000) / 10;
      marketOdds = marketOddsOver25;
    } else if (under25Edge > currentUnderThreshold) {
      predictionType = 'UNDER_25';
      probability = Math.round(probUnder25 * 100);
      edge = Math.round(under25Edge * 1000) / 10;
      marketOdds = marketOddsUnder25;
    }
  }

  // Final metadata resolution
  const chosenMarketReal = predictionType === 'OVER_25' ? over25Real
    : predictionType === 'UNDER_25' ? under25Real : false;
  
  if (!chosenMarketReal) edge = 0;

  const predictionLabel = predictionType === 'NO_BET' ? 'NO EDGE DETECTED' : predictionType === 'OVER_25' ? 'OVER 2.5 GOALS' : 'UNDER 2.5 GOALS';
  
  // Kelly precision
  const p = predictionType === 'OVER_25' ? probOver25 : predictionType === 'UNDER_25' ? probUnder25 : probability / 100;
  const q = 1 - p;
  const b = marketOdds - 1;
  const kellyFraction = edge > 0 ? Math.min(0.05, ((p * b - q) / b) * MODEL_CONFIG.KELLY_FRACTION) * 100 : 0;
  
  const mapStats = (name: string, data: InternalTeamData) => ({
    name: name.toUpperCase(),
    goalsScored: data.avgGoalsScored,
    goalsConceded: data.avgGoalsConceded,
    avgGoalsScored: data.avgGoalsScored,
    avgGoalsConceded: data.avgGoalsConceded,
    defensiveRatingHeuristic: data.cleanSheetRate * 1.5,
    form: data.form,
    cleanSheets: Math.round(data.cleanSheetRate * 20),
    homeAwayBias: data.homeAdvantageHeuristic,
  });

  const baseSummary = generateSummary(homeTeam, awayTeam, predictionType, lambdaHome, muAway, edge, modelSource, isLowConfidence);
  let finalSummary = baseSummary;

  // Append warnings with consistent formatting
  const warnings: string[] = [];
  if (isLowConfidence) warnings.push('Prediction withheld due to thin sample size.');
  if (predictionType !== 'NO_BET' && !chosenMarketReal) warnings.push('No real odds available — edge cannot be verified.');
  if (homeRes.isGeneric) warnings.push(`${homeTeam} data missing (using league averages).`);
  if (awayRes.isGeneric) warnings.push(`${awayTeam} data missing (using league averages).`);

  if (warnings.length > 0) {
    finalSummary = `⚠️ ${warnings.join(' ')} ${baseSummary}`;
  }

  const dataSource = homeRes.dataSource === 'LIVE' && awayRes.dataSource === 'LIVE' ? 'LIVE' : 'FALLBACK_STATIC';

  return {
    probability,
    rawProbability: probOver25, // Specifically track Over 2.5 raw probability for global evaluation
    summary: finalSummary,
    homeStats: mapStats(homeTeam, homeRes.data),
    awayStats: mapStats(awayTeam, awayRes.data),
    homeExpectedGoals: lambdaHome,
    awayExpectedGoals: muAway,
    minimumExpectancy: Math.round((lambdaHome + muAway) * 100) / 100,
    heuristicCeiling: Math.round((lambdaHome + muAway + 1.5) * 100) / 100,
    predictionType,
    predictionLabel,
    marketOdds,
    marketImpliedProb: Math.round((1 / marketOdds) * 1000) / 10,
    edge,
    recommendedStake: Math.max(0, Math.round(kellyFraction * 10) / 10),
    verdict: (chosenMarketReal && edge > 3 && !isLowConfidence) ? 'EXECUTE_BET' : 'NO_BET',
    context: {
      league: leagueKey,
      homeSeasonGoals: homeRes.data.avgGoalsScored * 20,
      awaySeasonGoals: awayRes.data.avgGoalsScored * 20,
      homeSeasonGoalsAgainst: homeRes.data.avgGoalsConceded * 20,
      awaySeasonGoalsAgainst: awayRes.data.avgGoalsConceded * 20,
      homeAttackRating: Math.round(homeRes.data.attackStrength * 5),
      awayAttackRating: Math.round(awayRes.data.attackStrength * 5),
      date: asOfDate || new Date().toISOString().split('T')[0],
      marketOdds: { pinnacleOver25: marketOddsOver25, pinnacleUnder25: marketOddsUnder25 },
    },
    dataSource,
    modelSource,
    modelSpecification,
    isLowConfidence,
    isThresholdAdaptive: !!adaptiveThresholdContext,
    usedRealOdds: chosenMarketReal,
    goalDistribution: distribution,
    scoreMatrix: scoreMatrix.slice(0, 6).map(row => row.slice(0, 6)),
    monteCarlo: {
      ...mcResults,
      iterations: 10000,
      uncertainty: 0.12
    }
  };
}

function generateSummary(
  home: string, away: string,
  type: 'OVER_25' | 'UNDER_25' | 'NO_BET',
  lambdaHome: number, muAway: number,
  edge: number,
  modelSource: 'MLE_FITTED' | 'HEURISTIC_FALLBACK',
  isLowConfidence: boolean = false
): string {
  const totalXG = (lambdaHome + muAway).toFixed(2);
  const modelTypeLabel = modelSource === 'MLE_FITTED' ? 'Fitted MLE Model' : 'Heuristic Fallback Model';
  const confidencePrefix = isLowConfidence ? '[Low Confidence] ' : (modelSource === 'HEURISTIC_FALLBACK' ? '[Heuristic] ' : '');

  if (type === 'OVER_25') {
    return `${confidencePrefix}Combined goal expectancy of ${totalXG} strongly supports Over 2.5 Goals market. ${home.toUpperCase()}'s offensive output (${lambdaHome.toFixed(2)} exp. goals) combined with ${away.toUpperCase()}'s defensive vulnerability creates a high-probability scoring environment. Model edge of +${edge.toFixed(1)}% represents positive expected value via ${modelTypeLabel}.`;
  } else if (type === 'UNDER_25') {
    return `${confidencePrefix}Defensive stability metrics indicate a controlled match environment. Combined goal expectancy of ${totalXG} suggests tactical discipline from both sides. ${home.toUpperCase()}'s defensive structure and ${away.toUpperCase()}'s conservative approach support the Under 2.5 market with +${edge.toFixed(1)}% edge using ${modelTypeLabel}.`;
  } else {
    return `Market is pricing this fixture efficiently. Combined goal expectancy of ${totalXG} does not present a measurable edge. Analysis performed via ${modelTypeLabel}.`;
  }
}

/**
 * Run backtest simulation using real historical data for grounding
 */
export async function runBacktest() {
  if (!FreeDataService.isLiveCapable) {
    return {
      totalMatches: 0,
      brierScore: -1,
      over25Accuracy: 0,
      under25Accuracy: 0,
      totalPnl: 0,
      totalYield: 0,
      avgClv: 0,
      edgeSegments: [
        { segment: 'Low Edge (0-3%)', min: 0, max: 3, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
        { segment: 'Mid Edge (3-7%)', min: 3, max: 7, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
        { segment: 'High Edge (7%+)', min: 7, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
      ],
      matches: [],
      error: 'API key required. Set VITE_API_FOOTBALL_KEY in .env to enable historical backtesting.',
    };
  }

  const leagues = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];
  const matches: any[] = [];
  let totalOver25Correct = 0;
  let totalUnder25Correct = 0;
  let over25Predictions = 0;
  let under25Predictions = 0;
  let totalMatches = 0;

  const edgeSegments = [
    { segment: 'Low Edge (0-3%)', min: 0, max: 3, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
    { segment: 'Mid Edge (3-7%)', min: 3, max: 7, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
    { segment: 'High Edge (7%+)', min: 7, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
  ];
  const edgeSums = [0, 0, 0];
  const clvSums = [0, 0, 0];
  const clvCounts = [0, 0, 0];

  const evalPool: any[] = [];
  const fixtureCache: Record<string, HistoricalMatch[]> = {};

  try {
    await Promise.all(leagues.map(async l => {
      const raw = await FreeDataService.getHistoricalFixtures(l, 150);
      if (raw.length < 30) return;
      
      const sorted = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      fixtureCache[l] = sorted;
      
      // Select evaluation pool (last 20 matches)
      const leagueEval = sorted.slice(-20);
      evalPool.push(...leagueEval);
    }));
  } catch (err) {
    console.error('Historical Fetch Error:', err);
  }

  // Sort global eval pool by date to optimize fitFromAPI caching
  evalPool.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalPnl = 0;
  let totalStake = 0;
  let totalClvSum = 0;
  let clvCount = 0;

  for (const match of evalPool) {
    // True Walk-Forward: refit model for every match as-of its specific date
    const prediction = await runPrediction(
        match.home, 
        match.away, 
        match.league, 
        null, // No override, forces re-fitting using available data up to match.date
        match.takenPrices,
        null,
        match.date,
        fixtureCache
    );
    const hGoals = match.homeGoals;
    const aGoals = match.awayGoals;
    
    const totalGoals = hGoals + aGoals;
    const isOver25Correct = totalGoals > 2.5;
    const isUnder25Correct = totalGoals < 2.5;

    // Track for global metrics (Brier score evaluates all attempts)
    matches.push({
      match: { 
        homeTeam: match.home, 
        awayTeam: match.away, 
        actualScore: [hGoals, aGoals], 
        league: match.league, 
        isReal: true 
      },
      prediction: { 
        predictionType: prediction.predictionType, 
        probability: prediction.probability,
        rawProbability: prediction.rawProbability
      },
      marketEdge: prediction.edge / 100,
      isOver25Correct,
      isUnder25Correct,
      pnl: 0,
      clv: 0,
      stake: 0,
      takenOdds: prediction.marketOdds
    });

    if (prediction.predictionType === 'NO_BET') continue;

    // PnL & CLV Calculation (only for bets)
    const currentMatch = matches[matches.length - 1];
    const stake = prediction.recommendedStake;
    const takenOdds = prediction.marketOdds;
    const closingOdds = prediction.predictionType === 'OVER_25' 
      ? match.closingPrices?.over25 
      : match.closingPrices?.under25;

    const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
    const pnl = isHit ? (stake * takenOdds - stake) : -stake;
    
    totalPnl += pnl;
    totalStake += stake;

    let clv = 0;
    if (closingOdds && closingOdds > 1) {
      clv = (takenOdds / closingOdds - 1) * 100;
      totalClvSum += clv;
      clvCount++;
    }

    if (prediction.predictionType === 'OVER_25') {
      over25Predictions++;
      if (isOver25Correct) totalOver25Correct++;
    } else if (prediction.predictionType === 'UNDER_25') {
      under25Predictions++;
      if (isUnder25Correct) totalUnder25Correct++;
    }
    
    totalMatches++;

    const absEdge = Math.abs(prediction.edge);
    const segIdx = edgeSegments.findIndex(s => absEdge >= s.min && absEdge < s.max);
    if (segIdx !== -1) {
      edgeSegments[segIdx].count++;
      edgeSums[segIdx] += absEdge / 100;
      if (isHit) edgeSegments[segIdx].hits++;
      
      if (clv !== 0 || (closingOdds && closingOdds > 1)) {
        clvSums[segIdx] += clv;
        clvCounts[segIdx]++;
      }
    }

    // Update the last match entry with bet-specific results
    currentMatch.pnl = pnl;
    currentMatch.clv = clv;
    currentMatch.stake = stake;
    currentMatch.closingOdds = closingOdds;
  }

  edgeSegments.forEach((seg, i) => {
    seg.hitRate = seg.count > 0 ? seg.hits / seg.count : 0;
    seg.avgEdge = seg.count > 0 ? edgeSums[i] / seg.count : 0;
    seg.avgClv = clvCounts[i] > 0 ? clvSums[i] / clvCounts[i] : 0;
  });

  return {
    totalMatches,
    brierScore: matches.length > 0
      ? matches.reduce((sum, m) => {
          // Proper binary Brier score: evaluates model's Over 2.5 forecast against actual outcome
          const predicted = m.prediction.rawProbability;
          const actual = m.isOver25Correct ? 1 : 0;
          return sum + Math.pow(predicted - actual, 2);
        }, 0) / matches.length
      : -1,
    over25Accuracy: over25Predictions > 0 ? (totalOver25Correct / over25Predictions) * 100 : 0,
    under25Accuracy: under25Predictions > 0 ? (totalUnder25Correct / under25Predictions) * 100 : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield: totalStake > 0 ? (totalPnl / totalStake) * 100 : 0,
    avgClv: clvCount > 0 ? totalClvSum / clvCount : 0,
    edgeSegments,
    matches: matches.slice(0, 20),
  };
}
