import { AnalysisResult, InternalTeamData } from '../types';
import { TEAM_STATS, TEAM_ALIASES, LEAGUE_CONFIGS } from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from './calibration';

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
};

/**
 * Normalizes team names for consistent lookup
 */
const normalizeTeamName = (name: string): string => {
  return name.toUpperCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
};

/**
 * Smart team lookup using aliases and canonical stats.
 * Returns both the data and the canonical name for league validation.
 */
const findTeamDetailed = (teamName: string): InternalTeamData | null => {
  const normalized = normalizeTeamName(teamName);
  
  if (TEAM_STATS[normalized]) return TEAM_STATS[normalized];
  
  const alias = TEAM_ALIASES[normalized];
  if (alias && TEAM_STATS[alias]) {
    return TEAM_STATS[alias];
  }
  
  // Fuzzy match fallback
  const keys = Object.keys(TEAM_STATS);
  const match = keys.find(key => key.includes(normalized) || normalized.includes(key));
  return match ? TEAM_STATS[match] : null;
};

/**
 * Resolves team data from live API or local fallback
 */
async function resolveTeamData(
  teamName: string, 
  leagueKey: string, 
  leagueConfig: any
): Promise<{ 
  data: InternalTeamData; 
  isGeneric: boolean; 
  dataSource: 'LIVE' | 'FALLBACK_STATIC';
}> {
  // 1. Try Live API
  const liveData = await FreeDataService.getTeamStats(teamName, leagueKey);
  if (liveData) return { data: liveData, isGeneric: false, dataSource: 'LIVE' };

  // 2. Try Local Database
  const staticData = findTeamDetailed(teamName);
  if (staticData) {
    // Neutralize frozen form data if we are in an API-capable environment
    // This prevents "frozen in time" form from polluting the analysis
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
      avgXG: 1.40,
      avgXGA: 1.30,
      homeBias: leagueConfig.homeAdvantage,
      form: [1, 1, 1, 1, 1],
      cleanSheetRate: 0.25,
      clinicalEdge: 1.0,
    }
  };
}

/**
 * Core Dixon-Coles Probability Engine
 */
function calculateModelMetrics(
  homeData: InternalTeamData,
  awayData: InternalTeamData,
  leagueConfig: any
) {
  const leagueAvg = leagueConfig.goalRate * MODEL_CONFIG.LEAGUE_AVG_GOALS;
  
  // Base xG calculation
  let lambdaHome = homeData.attackStrength * awayData.defenseStrength * leagueAvg * (1 + leagueConfig.homeAdvantage * MODEL_CONFIG.HOME_ADVANTAGE_WEIGHT);
  let muAway = awayData.attackStrength * homeData.defenseStrength * leagueAvg * (1 - leagueConfig.homeAdvantage * MODEL_CONFIG.AWAY_DEFENSE_WEIGHT);

  // Clinical edge scaling (Primary performance multiplier)
  lambdaHome *= homeData.clinicalEdge;
  muAway *= awayData.clinicalEdge;

  // Sanity clamping
  lambdaHome = Math.max(MODEL_CONFIG.MIN_LAMBDA, Math.min(MODEL_CONFIG.MAX_LAMBDA, lambdaHome));
  muAway = Math.max(MODEL_CONFIG.MIN_MU, Math.min(MODEL_CONFIG.MAX_MU, muAway));

  const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, -0.13);

  return {
    lambdaHome,
    muAway,
    probOver15: DixonColes.calculateOverUnder(scoreMatrix, 1.5),
    probUnder35: 1 - DixonColes.calculateOverUnder(scoreMatrix, 3.5)
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
  historicalOddsOverride: any = null
): Promise<AnalysisResult> {
  const leagueKey = normalizeLeagueKey(league.toUpperCase().replace(/ /g, '_'));
  const leagueConfig = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['EPL'];

  // Parallel data resolution
  const [homeRes, awayRes, liveOdds, fittedParams] = await Promise.all([
    resolveTeamData(homeTeam, leagueKey, leagueConfig),
    resolveTeamData(awayTeam, leagueKey, leagueConfig),
    historicalOddsOverride ? Promise.resolve([]) : FreeDataService.getLiveOdds(leagueKey),
    fittedOverride ? Promise.resolve(fittedOverride) : Calibration.fitFromAPI(leagueKey)
  ]);

  // Use MLE fitted goals if available, otherwise fallback to local stats model
  const mleGoals = Calibration.predictGoals(fittedParams, homeTeam, awayTeam);
  
  let lambdaHome: number;
  let muAway: number;
  let probOver15: number;
  let probUnder35: number;
  let finalRho = -0.13;

  if (mleGoals) {
    lambdaHome = mleGoals.lambdaHome;
    muAway = mleGoals.muAway;
    finalRho = fittedParams.rho;
    
    const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, finalRho);
    probOver15 = DixonColes.calculateOverUnder(scoreMatrix, 1.5);
    probUnder35 = 1 - DixonColes.calculateOverUnder(scoreMatrix, 3.5);
  } else {
    const metrics = calculateModelMetrics(homeRes.data, awayRes.data, leagueConfig);
    lambdaHome = metrics.lambdaHome;
    muAway = metrics.muAway;
    probOver15 = metrics.probOver15;
    probUnder35 = metrics.probUnder35;
  }

  // Market odds resolution - scanning all bookmakers for best real price per leg
  let marketOddsOver15 = 1.05 / probOver15; // synthetic fallback
  let marketOddsUnder35 = 1.05 / probUnder35; // synthetic fallback
  let over15Real = false;
  let under35Real = false;
  let matchOdds: any = null;

  over15Real = !!historicalOddsOverride?.over15;
  under35Real = !!historicalOddsOverride?.under35;

  if (historicalOddsOverride) {
    marketOddsOver15 = historicalOddsOverride.over15 || marketOddsOver15;
    marketOddsUnder35 = historicalOddsOverride.under35 || marketOddsUnder35;
  } else {
    matchOdds = liveOdds.find((o: any) => 
      normalizeTeamName(o.home_team).includes(normalizeTeamName(homeTeam)) ||
      normalizeTeamName(homeTeam).includes(normalizeTeamName(o.home_team))
    );

    if (matchOdds) {
      matchOdds.bookmakers.forEach((bm: any) => {
        const market = bm.markets.find((m: any) => m.key === 'totals');
        if (market) {
          const o15 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 1.5);
          const u35 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 3.5);
          
          if (o15 && (!over15Real || o15.price > marketOddsOver15)) {
            marketOddsOver15 = o15.price;
            over15Real = true;
          }
          if (u35 && (!under35Real || u35.price > marketOddsUnder35)) {
            marketOddsUnder35 = u35.price;
            under35Real = true;
          }
        }
      });
    }
  }

  const over15Edge = probOver15 - (1 / marketOddsOver15);
  const under35Edge = probUnder35 - (1 / marketOddsUnder35);

  // Result arbitration
  let predictionType: 'OVER_15' | 'UNDER_35' | 'NO_BET' = 'NO_BET';
  let probability = probOver15 > probUnder35 ? Math.round(probOver15 * 100) : Math.round(probUnder35 * 100);
  let edge = 0;
  let marketOdds = probOver15 > probUnder35 ? marketOddsOver15 : marketOddsUnder35;

  if (over15Edge > under35Edge && over15Edge > MODEL_CONFIG.EDGE_THRESHOLD) {
    predictionType = 'OVER_15';
    probability = Math.round(probOver15 * 100);
    edge = Math.round(over15Edge * 1000) / 10;
    marketOdds = marketOddsOver15;
  } else if (under35Edge > MODEL_CONFIG.EDGE_THRESHOLD) {
    predictionType = 'UNDER_35';
    probability = Math.round(probUnder35 * 100);
    edge = Math.round(under35Edge * 1000) / 10;
    marketOdds = marketOddsUnder35;
  }

  // Force zero edge if the chosen market is synthetic
  const chosenMarketReal = predictionType === 'OVER_15' ? over15Real
    : predictionType === 'UNDER_35' ? under35Real : false;
  
  if (!chosenMarketReal) {
    edge = 0;
  }

  const predictionLabel = predictionType === 'NO_BET' ? 'NO EDGE DETECTED' : predictionType === 'OVER_15' ? 'OVER 1.5 GOALS' : 'UNDER 3.5 GOALS';
  
  // Kelly precision - use unrounded probability
  const p = predictionType === 'OVER_15' ? probOver15 : predictionType === 'UNDER_35' ? probUnder35 : probability / 100;
  const q = 1 - p;
  const b = marketOdds - 1;
  const kellyFraction = edge > 0 ? Math.min(0.05, ((p * b - q) / b)) * 100 : 0;
  
  const mapStats = (name: string, data: InternalTeamData) => ({
    name: name.toUpperCase(),
    goalsScored: data.avgGoalsScored,
    goalsConceded: data.avgGoalsConceded,
    avgXG: data.avgXG,
    avgXGA: data.avgXGA,
    npxG: data.avgXG * 0.8,
    defensiveStability: 1 - data.defenseStrength + 0.3,
    form: data.form,
    cleanSheets: Math.round(data.cleanSheetRate * 20),
    clinicalEdge: data.clinicalEdge,
    homeAwayBias: data.homeBias,
  });

  const summary = generateSummary(homeTeam, awayTeam, predictionType, lambdaHome, muAway, edge);
  const dataSource = homeRes.dataSource === 'LIVE' && awayRes.dataSource === 'LIVE' ? 'LIVE' : 'FALLBACK_STATIC';

  let finalSummary = summary;
  if (!chosenMarketReal) {
    finalSummary = `⚠️ No real odds available — edge cannot be verified. ${summary}`;
  } else if (homeRes.isGeneric || awayRes.isGeneric) {
    finalSummary = `⚠️ Data Gap: ${[homeRes.isGeneric ? homeTeam : null, awayRes.isGeneric ? awayTeam : null].filter(Boolean).join(', ')} missing. ${summary}`;
  }

  return {
    probability,
    summary: finalSummary,
    homeStats: mapStats(homeTeam, homeRes.data),
    awayStats: mapStats(awayTeam, awayRes.data),
    homeXG: lambdaHome,
    awayXG: muAway,
    minimumExpectancy: Math.round((lambdaHome + muAway) * 100) / 100,
    potentialCeiling: Math.round((lambdaHome + muAway + 1.5) * 100) / 100,
    predictionType,
    predictionLabel,
    marketOdds,
    marketImpliedProb: Math.round((1 / marketOdds) * 1000) / 10,
    edge,
    recommendedStake: Math.max(0, Math.round(kellyFraction * 10) / 10),
    verdict: (chosenMarketReal && edge > 3) ? 'EXECUTE_BET' : 'NO_BET',
    context: {
      league: leagueKey,
      homeSeasonXG: homeRes.data.avgXG * 20,
      awaySeasonXG: awayRes.data.avgXG * 20,
      homeSeasonXGA: homeRes.data.avgXGA * 20,
      awaySeasonXGA: awayRes.data.avgXGA * 20,
      homeTier: Math.round(homeRes.data.attackStrength * 5),
      awayTier: Math.round(awayRes.data.attackStrength * 5),
      date: new Date().toISOString().split('T')[0],
      marketOdds: { pinnacleOver15: marketOddsOver15, pinnacleUnder35: marketOddsUnder35 },
    },
    dataSource,
    usedRealOdds: chosenMarketReal,
  };
}

function normalizeLeagueKey(league: string): string {
  const l = league.toUpperCase().replace(/_/g, '').replace(/ /g, '').replace(/-/g, '');
  if (l.includes('LALIGA') || l.includes('SPAIN')) return 'LA_LIGA';
  if (l.includes('SERIEA') || l.includes('ITALY')) return 'SERIE_A';
  if (l.includes('LIGUE1') || l.includes('FRANCE')) return 'LIGUE_1';
  if (l.includes('EPL') || l.includes('PREMIER') || l.includes('ENGLAND')) return 'EPL';
  if (l.includes('BUNDESLIGA') || l.includes('GERMANY')) return 'BUNDESLIGA';
  return league;
}

function generateSummary(
  home: string, away: string,
  type: 'OVER_15' | 'UNDER_35' | 'NO_BET',
  lambdaHome: number, muAway: number,
  edge: number
): string {
  const totalXG = (lambdaHome + muAway).toFixed(2);

  if (type === 'OVER_15') {
    return `Combined xG of ${totalXG} strongly supports Over 1.5 Goals market. ${home.toUpperCase()}'s offensive output (${lambdaHome.toFixed(2)} xG) combined with ${away.toUpperCase()}'s defensive vulnerability creates a high-probability scoring environment. Model edge of +${edge.toFixed(1)}% represents positive expected value.`;
  } else if (type === 'UNDER_35') {
    return `Defensive stability metrics indicate a controlled match environment. Combined xG of ${totalXG} suggests tactical discipline from both sides. ${home.toUpperCase()}'s defensive structure and ${away.toUpperCase()}'s conservative approach support the Under 3.5 market with +${edge.toFixed(1)}% edge.`;
  } else {
    return `Market is pricing this fixture efficiently. Combined xG of ${totalXG} does not present a measurable edge in either direction. Model recommends capital preservation.`;
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
      over15Accuracy: 0,
      under35Accuracy: 0,
      edgeSegments: [
        { segment: 'Low Edge (0-3%)', min: 0, max: 3, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
        { segment: 'Mid Edge (3-7%)', min: 3, max: 7, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
        { segment: 'High Edge (7%+)', min: 7, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
      ],
      matches: [],
      error: 'API key required. Set VITE_API_FOOTBALL_KEY in .env to enable historical backtesting.',
    };
  }

  const leagues = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];
  const matches: any[] = [];
  let totalOver15Correct = 0;
  let totalUnder35Correct = 0;
  let over15Predictions = 0;
  let under35Predictions = 0;
  let totalMatches = 0;

  const edgeSegments = [
    { segment: 'Low Edge (0-3%)', min: 0, max: 3, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
    { segment: 'Mid Edge (3-7%)', min: 3, max: 7, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
    { segment: 'High Edge (7%+)', min: 7, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0 },
  ];
  const edgeSums = [0, 0, 0];

  const fittedByLeague: Record<string, Calibration.FittedLeagueParams> = {};
  const evalPool: any[] = [];

  try {
    await Promise.all(leagues.map(async l => {
      const raw = await FreeDataService.getHistoricalFixtures(l, 100);
      if (raw.length < 30) return;
      
      const sorted = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const leagueEval = sorted.slice(-20);
      const leagueTrain = sorted.slice(0, -20).map(m => ({
        home: m.home, away: m.away, hg: m.homeGoals, ag: m.awayGoals
      }));

      fittedByLeague[l] = Calibration.fitDixonColes(leagueTrain);
      evalPool.push(...leagueEval);
    }));
  } catch (err) {
    console.error('Historical Fetch Error:', err);
  }

  let totalPnl = 0;
  let totalStake = 0;
  let totalClvSum = 0;
  let clvCount = 0;

  for (const match of evalPool) {
    const prediction = await runPrediction(
        match.home, 
        match.away, 
        match.league, 
        fittedByLeague[match.league],
        match.takenPrices
    );
    const hGoals = match.homeGoals;
    const aGoals = match.awayGoals;
    
    const totalGoals = hGoals + aGoals;
    const isOver15Correct = totalGoals >= 2;
    const isUnder35Correct = totalGoals <= 3;

    if (prediction.predictionType === 'NO_BET') continue;

    // PnL & CLV Calculation
    const stake = prediction.recommendedStake;
    const takenOdds = prediction.marketOdds;
    const closingOdds = prediction.predictionType === 'OVER_15' 
      ? match.closingPrices?.over15 
      : match.closingPrices?.under35;

    const isHit = prediction.predictionType === 'OVER_15' ? isOver15Correct : isUnder35Correct;
    const pnl = isHit ? (stake * takenOdds - stake) : -stake;
    
    totalPnl += pnl;
    totalStake += stake;

    let clv = 0;
    if (closingOdds && closingOdds > 1) {
      clv = (takenOdds / closingOdds - 1) * 100;
      totalClvSum += clv;
      clvCount++;
    }

    if (prediction.predictionType === 'OVER_15') {
      over15Predictions++;
      if (isOver15Correct) totalOver15Correct++;
    } else if (prediction.predictionType === 'UNDER_35') {
      under35Predictions++;
      if (isUnder35Correct) totalUnder35Correct++;
    }
    
    totalMatches++;

    const absEdge = Math.abs(prediction.edge);
    const segIdx = edgeSegments.findIndex(s => absEdge >= s.min && absEdge < s.max);
    if (segIdx !== -1) {
      edgeSegments[segIdx].count++;
      edgeSums[segIdx] += absEdge / 100;
      if (isHit) edgeSegments[segIdx].hits++;
    }

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
        probability: prediction.probability 
      },
      marketEdge: prediction.edge / 100,
      isOver15Correct,
      isUnder35Correct,
      pnl,
      clv,
      stake,
      takenOdds,
      closingOdds
    });
  }

  edgeSegments.forEach((seg, i) => {
    seg.hitRate = seg.count > 0 ? seg.hits / seg.count : 0;
    seg.avgEdge = seg.count > 0 ? edgeSums[i] / seg.count : 0;
  });

  return {
    totalMatches,
    brierScore: matches.length > 0
      ? matches.reduce((sum, m) => {
          const predicted = m.prediction.probability / 100;
          const actual = m.prediction.predictionType === 'UNDER_35' ? (m.isUnder35Correct ? 1 : 0) : (m.isOver15Correct ? 1 : 0);
          return sum + Math.pow(predicted - actual, 2);
        }, 0) / matches.length
      : -1,
    over15Accuracy: over15Predictions > 0 ? (totalOver15Correct / over15Predictions) * 100 : 0,
    under35Accuracy: under35Predictions > 0 ? (totalUnder35Correct / under35Predictions) * 100 : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield: totalStake > 0 ? (totalPnl / totalStake) * 100 : 0,
    avgClv: clvCount > 0 ? totalClvSum / clvCount : 0,
    edgeSegments,
    matches: matches.slice(0, 20),
  };
}
