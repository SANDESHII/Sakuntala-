import { AnalysisResult, InternalTeamData, HistoricalMatch, ArenaConfig, ArenaPrediction, ConsensusResult, StrategyCard } from '../types';
import { TEAM_STATS, LEAGUE_CONFIGS, BASE_GOALS, DEFAULT_RHO, STRATEGY_MODIFIERS, WORKFLOW_MODIFIERS, REASONING_MODIFIERS } from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from './calibration';
import { FeatureEngine } from './features';
import { TeamRegistry } from '../data/identity/registry';
import { ARENA_SKILLS } from '../data/arenaSkills';

/**
 * Prediction Pipeline Configuration
 */
const MODEL_CONFIG = {
  LEAGUE_AVG_GOALS: BASE_GOALS,
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
    if (FreeDataService.isLiveCapable()) {
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
      attackStrength: 1.0,
      defenseStrength: 1.0,
      avgGoalsScored: 1.35,
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
  // All strengths are league-average multipliers (1.0 = average)
  const homeAttack = homeData.attackStrength;
  const awayDefense = awayData.defenseStrength;
  const awayAttack = awayData.attackStrength;
  const homeDefense = homeData.defenseStrength;

  let lambdaHome = homeAttack * awayDefense * leagueAvg * (1 + blendedHomeAdv * MODEL_CONFIG.HOME_ADVANTAGE_WEIGHT);
  let muAway = awayAttack * homeDefense * leagueAvg * (1 - leagueConfig.homeAdvantage * MODEL_CONFIG.AWAY_DEFENSE_WEIGHT);

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
  try {
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
  let finalRho = DEFAULT_RHO;
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
    scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, DEFAULT_RHO);
    modelSource = 'HEURISTIC_FALLBACK';
    modelSpecification = 'Heuristic Blended (Hand-tuned Weights & Biases)';
  }

  probOver25 = DixonColes.calculateOverUnder(scoreMatrix, 2.5);
  probUnder25 = 1 - DixonColes.calculateOverUnder(scoreMatrix, 2.5);

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
  let marketOddsOver25: number | null = null;
  let marketOddsUnder25: number | null = null;
  let over25Real = false;
  let under25Real = false;
  let matchOdds: any = null;
  let marketSource: 'THE_ODDS_API' | 'HISTORICAL' | 'NONE' = 'NONE';

  if (historicalOddsOverride) {
    marketOddsOver25 = historicalOddsOverride.over25?.bestPrice || null;
    marketOddsUnder25 = historicalOddsOverride.under25?.bestPrice || null;
    over25Real = !!marketOddsOver25;
    under25Real = !!marketOddsUnder25;
    marketSource = 'HISTORICAL';
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
      marketSource = 'THE_ODDS_API';
      matchOdds.bookmakers.forEach((bm: any) => {
        const market = bm.markets.find((m: any) => m.key === 'totals');
        if (market) {
          const o25 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 2.5);
          const u25 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 2.5);
          
          if (o25 && (!marketOddsOver25 || o25.price > marketOddsOver25)) {
            marketOddsOver25 = o25.price;
            over25Real = true;
          }
          if (u25 && (!marketOddsUnder25 || u25.price > marketOddsUnder25)) {
            marketOddsUnder25 = u25.price;
            under25Real = true;
          }
        }
      });
    }
  }

  // Market edge computed against raw bookmaker price (bestPrice). 
  const over25Edge = marketOddsOver25 ? probOver25 - (1 / marketOddsOver25) : -1;
  const under25Edge = marketOddsUnder25 ? probUnder25 - (1 / marketOddsUnder25) : -1;

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
  let edge: number | null = null;
  let marketOdds: number | null = null;

  if (!isLowConfidence) {
    if (over25Edge > under25Edge && over25Edge > currentOverThreshold && marketOddsOver25) {
      predictionType = 'OVER_25';
      probability = Math.round(probOver25 * 100);
      edge = Math.round(over25Edge * 1000) / 10;
      marketOdds = marketOddsOver25;
    } else if (under25Edge > currentUnderThreshold && marketOddsUnder25) {
      predictionType = 'UNDER_25';
      probability = Math.round(probUnder25 * 100);
      edge = Math.round(under25Edge * 1000) / 10;
      marketOdds = marketOddsUnder25;
    }
  }

  // Final metadata resolution
  const chosenMarketReal = predictionType === 'OVER_25' ? over25Real
    : predictionType === 'UNDER_25' ? under25Real : false;
  
  if (!chosenMarketReal) edge = null;

  const predictionLabel = predictionType === 'NO_BET' ? 'NO EDGE DETECTED' : predictionType === 'OVER_25' ? 'OVER 2.5 GOALS' : 'UNDER 2.5 GOALS';
  
  // Kelly precision
  const p = predictionType === 'OVER_25' ? probOver25 : predictionType === 'UNDER_25' ? probUnder25 : probability / 100;
  const q = 1 - p;
  const b = (marketOdds || 0) - 1;
  const kellyFraction = (edge && edge > 0 && b > 0) ? Math.min(0.05, ((p * b - q) / b) * MODEL_CONFIG.KELLY_FRACTION) * 100 : 0;
  
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

  const baseSummary = generateSummary(homeTeam, awayTeam, predictionType, lambdaHome, muAway, edge || 0, modelSource, isLowConfidence);
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
    predictionType,
    predictionLabel,
    marketOdds,
    marketImpliedProb: marketOdds ? Math.round((1 / marketOdds) * 1000) / 10 : null,
    edge,
    recommendedStake: Math.max(0, Math.round(kellyFraction * 10) / 10),
    verdict: (chosenMarketReal && edge && edge > 3 && !isLowConfidence) ? 'EXECUTE_BET' : 'NO_BET',
    context: {
      league: leagueKey,
      homeSeasonGoals: homeRes.data.avgGoalsScored * 20,
      awaySeasonGoals: awayRes.data.avgGoalsScored * 20,
      homeSeasonGoalsAgainst: homeRes.data.avgGoalsConceded * 20,
      awaySeasonGoalsAgainst: awayRes.data.avgGoalsConceded * 20,
      homeAttackRating: Math.round(homeRes.data.attackStrength * 5),
      awayAttackRating: Math.round(awayRes.data.attackStrength * 5),
      date: asOfDate || new Date().toISOString().split('T')[0],
      marketOdds: { 
        pinnacleOver25: marketOddsOver25, 
        pinnacleUnder25: marketOddsUnder25,
        source: marketSource
      },
    },
    dataSource,
    modelSource,
    modelSpecification,
    isLowConfidence,
    isThresholdAdaptive: !!adaptiveThresholdContext,
    usedRealOdds: chosenMarketReal,
    goalDistribution: distribution,
    scoreMatrix: scoreMatrix.slice(0, 6).map(row => row.slice(0, 6))
  };
} catch (err: any) {
  console.error('[Engine] Prediction execution failure:', err);
  throw new Error(`Prediction processing failed: ${err.message}`);
}
}

// ═══════════════════════════════════════════════════════════════
// ARENA PREDICTION SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Generate strategy cards for arena
 */
function generateArenaCards(count: number, seed?: number): StrategyCard[] {
  const { reasoning, workflows, strategies } = ARENA_SKILLS;
  const cards: StrategyCard[] = [];
  const used = new Set<string>();

  // Seeded random for reproducibility
  let s = seed || Date.now();
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };

  for (let i = 0; i < count; i++) {
    let card: StrategyCard;
    let attempts = 0;
    do {
      const rIdx = Math.floor(rand() * reasoning.length);
      const wIdx = Math.floor(rand() * workflows.length);
      const sIdx = Math.floor(rand() * strategies.length);
      card = {
        reasoning: reasoning[rIdx],
        workflow: workflows[wIdx],
        strategy: strategies[sIdx],
      };
      attempts++;
    } while (used.has(`${card.reasoning.id}-${card.workflow.id}-${card.strategy.id}`) && attempts < 100);

    used.add(`${card.reasoning.id}-${card.workflow.id}-${card.strategy.id}`);
    cards.push(card);
  }

  return cards;
}

/**
 * Run prediction with a single strategy card
 */
async function runPredictionWithCard(
  card: StrategyCard,
  baseResult: AnalysisResult
): Promise<ArenaPrediction> {
  // Get strategy modifiers (with fallbacks)
  const stratMod = STRATEGY_MODIFIERS[card.strategy.id] || { edgeThreshold: 0.03, kellyFraction: 0.30, confidenceMultiplier: 1.0 };
  const workMod = WORKFLOW_MODIFIERS[card.workflow.id] || { rhoAdjust: 0, uncertaintyAdjust: 0 };
  const reasonMod = REASONING_MODIFIERS[card.reasoning.id] || { lambdaAdjust: 0, muAdjust: 0, formWeight: 0 };

  // Apply reasoning modifiers to base lambda/mu
  const lambdaAdj = baseResult.homeExpectedGoals + reasonMod.lambdaAdjust;
  const muAdj = baseResult.awayExpectedGoals + reasonMod.muAdjust;
  const rhoAdj = DEFAULT_RHO + workMod.rhoAdjust;

  // Calculate score matrix with strategy adjustments
  const scoreMatrix = DixonColes.calculateStrategyScoreMatrix(lambdaAdj, muAdj, rhoAdj);
  const probOver25 = DixonColes.calculateOverUnder(scoreMatrix, 2.5);

  // Run Monte Carlo with strategy-adjusted uncertainty (placeholder for side-effects/future use)
  DixonColes.runStrategyMonteCarlo(
    lambdaAdj, muAdj, rhoAdj,
    4000, 0.12, workMod.uncertaintyAdjust
  );

  // Determine prediction
  const prediction: 'OVER_25' | 'UNDER_25' | 'NO_BET' =
    probOver25 > 0.55 ? 'OVER_25' :
    probOver25 < 0.45 ? 'UNDER_25' : 'NO_BET';

  // Calculate edge against market
  const marketProb = baseResult.marketOdds ? 1 / baseResult.marketOdds : 0.5;
  const edge = prediction === 'OVER_25'
    ? (probOver25 - marketProb) * 100
    : prediction === 'UNDER_25'
    ? ((1 - probOver25) - (1 - marketProb)) * 100
    : 0;

  // Apply strategy confidence modifier
  const baseConfidence = Math.abs(probOver25 - 0.5) * 2;
  const confidence = Math.min(0.95, baseConfidence * stratMod.confidenceMultiplier);

  // Score the prediction on the rubric
  const scores = {
    correctness: Math.min(10, Math.round(confidence * 8 + (Math.abs(edge) > 3 ? 2 : 0))),
    completeness: 7,
    robustness: Math.min(10, Math.round(confidence * 7 + (card.workflow.id === 'build-then-break' ? 2 : 0))),
    specificity: Math.min(10, Math.round(5 + (card.strategy.id === 'concrete-specifics' ? 4 : 0))),
    clarity: Math.min(10, Math.round(6 + (card.strategy.id === 'clarity' ? 3 : 0))),
  };

  const weightedTotal = (
    scores.correctness * 30 +
    scores.completeness * 25 +
    scores.robustness * 20 +
    scores.specificity * 15 +
    scores.clarity * 10
  ) / 10;

  const fatal = Math.abs(edge) > 15 || confidence < 0.2;

  return {
    card,
    prediction,
    confidence,
    edge: Math.round(edge * 10) / 10,
    reasoning: `${card.reasoning.name} + ${card.workflow.name} + ${card.strategy.name}`,
    scores,
    weightedTotal: Math.round(weightedTotal * 10) / 10,
    fatal,
  };
}

/**
 * Find consensus from multiple predictions
 */
function findConsensus(predictions: ArenaPrediction[]): ConsensusResult {
  const overVotes = predictions.filter(p => p.prediction === 'OVER_25' && !p.fatal);
  const underVotes = predictions.filter(p => p.prediction === 'UNDER_25' && !p.fatal);
  const noBetVotes = predictions.filter(p => p.prediction === 'NO_BET' || p.fatal);
  const total = predictions.length;

  let prediction = 'NO_BET';
  let confidence = 0;
  let edge = 0;
  let agreement = 0;

  if (overVotes.length > underVotes.length && overVotes.length > noBetVotes.length) {
    prediction = 'OVER_25';
    confidence = overVotes.reduce((s, p) => s + p.confidence, 0) / overVotes.length;
    edge = overVotes.reduce((s, p) => s + p.edge, 0) / overVotes.length;
    agreement = (overVotes.length / total) * 100;
  } else if (underVotes.length > overVotes.length && underVotes.length > noBetVotes.length) {
    prediction = 'UNDER_25';
    confidence = underVotes.reduce((s, p) => s + p.confidence, 0) / underVotes.length;
    edge = underVotes.reduce((s, p) => s + p.edge, 0) / underVotes.length;
    agreement = (underVotes.length / total) * 100;
  } else {
    agreement = (noBetVotes.length / total) * 100;
  }

  // Sort by weighted total to find survivors
  const sorted = [...predictions].sort((a, b) => b.weightedTotal - a.weightedTotal);
  const surviving = sorted.filter(p => !p.fatal).slice(0, Math.ceil(total * 0.3));
  const dissenting = predictions.filter(p => p.prediction !== prediction && !p.fatal);

  const topReasoning = surviving.length > 0
    ? surviving[0].card.reasoning.name
    : "No clear winner";

  return {
    prediction,
    confidence: Math.round(confidence * 100) / 100,
    edge: Math.round(edge * 10) / 10,
    agreement: Math.round(agreement),
    topReasoning,
    surviving,
    dissenting,
  };
}

/**
 * Arena-augmented prediction pipeline
 * Runs N parallel analyses with different strategy cards, finds consensus
 */
export async function runArenaPrediction(
  homeTeam: string,
  awayTeam: string,
  league: string,
  arenaConfig: ArenaConfig = { enableArena: false, cardCount: 12 },
  fittedOverride: Calibration.FittedLeagueParams | null = null,
  historicalOddsOverride: any = null,
  adaptiveThresholdContext: any[] | null = null,
): Promise<AnalysisResult> {
  // 1. Run the base prediction (always)
  const baseResult = await runPrediction(
    homeTeam, awayTeam, league,
    fittedOverride, historicalOddsOverride, adaptiveThresholdContext
  );

  // 2. If arena is disabled, return base result
  if (!arenaConfig?.enableArena || arenaConfig.cardCount < 2) {
    return baseResult;
  }

  // 3. Generate strategy cards
  const cards = generateArenaCards(arenaConfig.cardCount, arenaConfig.seed);

  // 4. Run prediction with each card (parallel with concurrency limit)
  const predictions: ArenaPrediction[] = [];
  const CONCURRENCY = 4; // Don't hammer the API

  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    const batch = cards.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(card => runPredictionWithCard(
        card, baseResult
      ))
    );
    predictions.push(...batchResults);
  }

  // 5. Find consensus
  const consensus = findConsensus(predictions);

  // 6. Attach arena data to result
  return {
    ...baseResult,
    arena: {
      consensus,
      predictions: predictions.sort((a, b) => b.weightedTotal - a.weightedTotal),
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
  if (!FreeDataService.isLiveCapable()) {
    return {
      totalMatches: 0,
      brierScore: -1,
      over25Accuracy: 0,
      under25Accuracy: 0,
      totalPnl: 0,
      totalYield: 0,
      avgClv: 0,
      edgeSegments: [
        { segment: 'Low Edge (0-2%)', min: 0, max: 2, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
        { segment: 'Mid Edge (2-5%)', min: 2, max: 5, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
        { segment: 'High Edge (5-8%)', min: 5, max: 8, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
        { segment: 'Elite Edge (8%+)', min: 8, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
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
    { segment: 'Low Edge (0-2%)', min: 0, max: 2, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
    { segment: 'Mid Edge (2-5%)', min: 2, max: 5, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
    { segment: 'High Edge (5-8%)', min: 5, max: 8, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
    { segment: 'Elite Edge (8%+)', min: 8, max: 100, count: 0, hits: 0, hitRate: 0, avgEdge: 0, avgClv: 0 },
  ];
  const edgeSums = [0, 0, 0, 0];
  const clvSums = [0, 0, 0, 0];
  const clvCounts = [0, 0, 0, 0];

  const evalPool: any[] = [];
  const fixtureCache: Record<string, HistoricalMatch[]> = {};

  for (const l of leagues) {
    try {
      // Fetch fixtures without odds initially to save quota
      const raw = await FreeDataService.getHistoricalFixtures(l, 80, false);
      if (raw.length < 30) continue;
      
      const sorted = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      fixtureCache[l] = sorted;
      
      // Select evaluation pool (last 6 matches per league for stability/speed balance)
      const leagueEval = sorted.slice(-6);
      evalPool.push(...leagueEval);
      
      // Small delay between leagues
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.warn(`[Engine] Skipping league ${l} due to fetch error:`, (err as Error).message);
    }
  }

  // Sort global eval pool by date
  evalPool.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalPnl = 0;
  let totalStake = 0;
  let totalClvSum = 0;
  let clvCount = 0;

  for (const match of evalPool) {
    try {
        // 1. Fetch odds for this specific match only now
        const odds = await FreeDataService.getHistoricalOddsForMatch(match.league, match.date, match.home, match.away);
        if (odds) {
            match.takenPrices = odds.takenPrices;
            match.closingPrices = odds.closingPrices;
            match.takenAt = odds.takenAt;
            match.closedAt = odds.closedAt;
        }

        // 2. True Walk-Forward prediction
        const prediction = await runPrediction(
            match.home, 
            match.away, 
            match.league, 
            null, 
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

        // Track for global metrics
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
          marketEdge: prediction.edge !== null ? prediction.edge / 100 : null,
          isOver25Correct,
          isUnder25Correct,
          pnl: 0,
          clv: 0,
          stake: 0,
          takenOdds: prediction.marketOdds
        });

        if (prediction.predictionType === 'NO_BET' || prediction.marketOdds === null || prediction.edge === null) continue;

        // PnL & CLV Calculation
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

        currentMatch.pnl = pnl;
        currentMatch.clv = clv;
        currentMatch.stake = stake;
        currentMatch.closingOdds = closingOdds;
    } catch (err: any) {
        console.warn(`[Engine] Stopping backtest early due to processing error:`, err.message);
        // Break the loop but return partial results if we have matches
        if (matches.length > 5) break;
        throw err; // Not enough data, propagate error
    }
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

