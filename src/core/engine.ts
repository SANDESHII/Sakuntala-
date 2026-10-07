import { AnalysisResult, InternalTeamData, HistoricalMatch, BacktestSummary, BacktestMatch } from '../types';
import { TEAM_STATS, LEAGUE_CONFIGS, BASE_GOALS, DEFAULT_RHO, HOME_ADVANTAGE_WEIGHT, AWAY_DEFENSE_WEIGHT, EDGE_THRESHOLD } from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from './calibration';
import { FeatureEngine } from './features';
import { resolveTeam } from '../data/teamIds';
import { logger } from '../services/logger';

const MODEL_CONFIG = {
  LEAGUE_AVG_GOALS: BASE_GOALS,
  EDGE_THRESHOLD: EDGE_THRESHOLD,
  MAX_LAMBDA: 4.0,
  MIN_LAMBDA: 0.3,
  KELLY_FRACTION: 0.35,
};

/**
 * Resolve team data using historical, live, static, or fallback paths.
 */
async function resolveTeamData(
  teamName: string, 
  leagueKey: string, 
  leagueConfig: any,
  asOfDate?: string,
  fixtureCache?: Record<string, HistoricalMatch[]>
): Promise<{ data: InternalTeamData; isGeneric: boolean; dataSource: 'LIVE' | 'FALLBACK_STATIC' }> {
  if (asOfDate) {
    const hist = await FeatureEngine.computeFeatures(teamName, leagueKey, asOfDate, fixtureCache?.[leagueKey]);
    return { data: hist, isGeneric: hist.quality === 'low', dataSource: 'FALLBACK_STATIC' };
  }
  const live = await FreeDataService.getTeamStats(teamName, leagueKey);
  const staticData = TEAM_STATS[resolveTeam(teamName).id];
  return { 
    data: live || staticData || { 
      attackStrength: 1.0, defenseStrength: 1.0, avgGoalsScored: 1.35, avgGoalsConceded: 1.35,
      homeAdvantageHeuristic: leagueConfig.homeAdvantage, form: [1, 1, 1, 1, 1], cleanSheetRate: 0.25 
    }, 
    isGeneric: !live && !staticData, dataSource: live ? 'LIVE' : 'FALLBACK_STATIC' 
  };
}

/**
 * Extract best market odds for Over/Under 2.5.
 */
function getBestOdds(matchOdds: any) {
  let o25 = 0, u25 = 0;
  matchOdds?.bookmakers?.forEach((bm: any) => {
    const market = bm.markets.find((m: any) => m.key === 'totals');
    const o = market?.outcomes.find((oc: any) => oc.name === 'Over' && oc.point === 2.5);
    const u = market?.outcomes.find((oc: any) => oc.name === 'Under' && oc.point === 2.5);
    if (o?.price > o25) o25 = o.price;
    if (u?.price > u25) u25 = u.price;
  });
  return { o25, u25 };
}

/**
 * Main prediction engine using Dixon-Coles model.
 * 
 * @param homeTeam - Canonical name of the home team
 * @param awayTeam - Canonical name of the away team
 * @param league - League key (e.g., 'EPL')
 * @param fittedOverride - Optional pre-fitted parameters
 * @param historicalOddsOverride - Optional odds for backtesting
 * @param adaptiveThresholdContext - Context for edge threshold adjustment
 * @param asOfDate - Cutoff date for historical simulation
 * @param fixtureCache - Cache of fixtures for backtesting performance
 * @returns Comprehensive analysis including probabilities and betting verdict
 */
export async function runPrediction(
  homeTeam: string,
  awayTeam: string,
  league: string,
  fittedOverride: Calibration.FittedLeagueParams | null = null,
  historicalOddsOverride: any = null,
  asOfDate?: string,
  fixtureCache?: Record<string, HistoricalMatch[]>
): Promise<AnalysisResult> {
  try {
    const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const leagueConfig = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['STANDARD'];

  const [homeRes, awayRes, liveOdds, fittedParams] = await Promise.all([
    resolveTeamData(homeTeam, leagueKey, leagueConfig, asOfDate, fixtureCache),
    resolveTeamData(awayTeam, leagueKey, leagueConfig, asOfDate, fixtureCache),
    historicalOddsOverride ? Promise.resolve([]) : FreeDataService.getLiveOdds(leagueKey),
    fittedOverride ? Promise.resolve(fittedOverride) : Calibration.fitFromAPI(leagueKey, asOfDate, fixtureCache?.[leagueKey])
  ]);

  const mle = Calibration.predictGoals(fittedParams, homeTeam, awayTeam);
  const lambdaHome = mle ? mle.lambdaHome : Math.max(MODEL_CONFIG.MIN_LAMBDA, Math.min(MODEL_CONFIG.MAX_LAMBDA, homeRes.data.attackStrength * awayRes.data.defenseStrength * leagueConfig.goalRate * BASE_GOALS * (1 + leagueConfig.homeAdvantage * HOME_ADVANTAGE_WEIGHT)));
  const muAway = mle ? mle.muAway : Math.max(0.2, Math.min(3.5, awayRes.data.attackStrength * homeRes.data.defenseStrength * leagueConfig.goalRate * BASE_GOALS * (1 - leagueConfig.homeAdvantage * AWAY_DEFENSE_WEIGHT)));
  
  const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, mle ? fittedParams.rho : DEFAULT_RHO);
  const probOver25 = DixonColes.calculateOverUnder(scoreMatrix, 2.5);
  const probUnder25 = 1 - probOver25;

  const { o25: marketOddsOver25, u25: marketOddsUnder25 } = historicalOddsOverride 
    ? { o25: historicalOddsOverride.over25?.bestPrice, u25: historicalOddsOverride.under25?.bestPrice }
    : getBestOdds(liveOdds.find((o: any) => resolveTeam(o.home_team).id === resolveTeam(homeTeam).id));

  const over25Edge = probOver25 - (1 / marketOddsOver25);
  const under25Edge = probUnder25 - (1 / marketOddsUnder25);
  const thresholdBase = MODEL_CONFIG.EDGE_THRESHOLD;
  const isLowConfidence = mle?.lowConfidence || false;

  const pick = !isLowConfidence && over25Edge > under25Edge && over25Edge > thresholdBase
    ? 'OVER_25'
    : !isLowConfidence && under25Edge > thresholdBase
    ? 'UNDER_25'
    : 'NO_BET';

  const edge = pick === 'OVER_25' ? over25Edge : pick === 'UNDER_25' ? under25Edge : 0;
  const marketOdds = pick === 'OVER_25' ? marketOddsOver25 : pick === 'UNDER_25' ? marketOddsUnder25 : null;

  const threshold = EDGE_THRESHOLD;

  const p = pick === 'OVER_25' ? probOver25 : pick === 'UNDER_25' ? probUnder25 : 0;
  const kelly = (marketOdds && edge > threshold) ? Math.min(0.05, ((p * marketOdds - 1) / (marketOdds - 1)) * MODEL_CONFIG.KELLY_FRACTION) : 0;

  return {
    probability: Math.round(p * 100),
    rawProbability: probOver25,
    summary: `Analysis of ${homeTeam} vs ${awayTeam} completed.`,
    homeStats: { name: homeTeam.toUpperCase(), goalsScored: homeRes.data.avgGoalsScored, goalsConceded: homeRes.data.avgGoalsConceded, avgGoalsScored: homeRes.data.avgGoalsScored, avgGoalsConceded: homeRes.data.avgGoalsConceded, defensiveRatingHeuristic: homeRes.data.cleanSheetRate, form: homeRes.data.form, cleanSheets: Math.round(homeRes.data.cleanSheetRate * 20), homeAwayBias: homeRes.data.homeAdvantageHeuristic },
    awayStats: { name: awayTeam.toUpperCase(), goalsScored: awayRes.data.avgGoalsScored, goalsConceded: awayRes.data.avgGoalsConceded, avgGoalsScored: awayRes.data.avgGoalsScored, avgGoalsConceded: awayRes.data.avgGoalsConceded, defensiveRatingHeuristic: awayRes.data.cleanSheetRate, form: awayRes.data.form, cleanSheets: Math.round(awayRes.data.cleanSheetRate * 20), homeAwayBias: awayRes.data.homeAdvantageHeuristic },
    homeExpectedGoals: lambdaHome,
    awayExpectedGoals: muAway,
    predictionType: pick,
    predictionLabel: pick === 'NO_BET' ? 'NO EDGE' : pick,
    marketOdds,
    marketImpliedProb: marketOdds ? 1 / marketOdds : null,
    edge: Math.round(edge * 1000) / 10,
    recommendedStake: Math.round(kelly * 1000) / 10,
    verdict: kelly > 0 ? 'EXECUTE_BET' : 'NO_BET',
    context: { league: leagueKey, homeSeasonGoals: homeRes.data.avgGoalsScored * 20, awaySeasonGoals: awayRes.data.avgGoalsScored * 20, homeSeasonGoalsAgainst: homeRes.data.avgGoalsConceded * 20, awaySeasonGoalsAgainst: awayRes.data.avgGoalsConceded * 20, homeAttackRating: 0, awayAttackRating: 0, date: asOfDate || '', marketOdds: { pinnacleOver25: marketOddsOver25, pinnacleUnder25: marketOddsUnder25 } },
    dataSource: homeRes.dataSource,
    modelSource: mle ? 'MLE_FITTED' : 'HEURISTIC_FALLBACK',
    isLowConfidence,
    scoreMatrix: scoreMatrix.slice(0, 6).map(r => r.slice(0, 6))
  };
  } catch (err: any) {
    logger.error('runPrediction', err, { homeTeam, awayTeam, league });
    throw new Error(`[Engine] Prediction failed: ${err.message}`);
  }
}

/**
 * Run backtest simulation across major leagues to verify model accuracy and profitability.
 * 
 * @returns Summary of backtest results including PnL, yield, and hit rates
 */
export async function runBacktest(): Promise<BacktestSummary> {
  const leagues = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];
  
  // Step 1: Fetch all data ONCE
  const allFixtures: Record<string, HistoricalMatch[]> = {};
  const evalPool: any[] = [];
  
  for (const l of leagues) {
    try {
      // Fetch 150 matches with odds included to warm cache
      const raw = await FreeDataService.getHistoricalFixtures(l, 150, true);
      allFixtures[l] = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // Take a slice for evaluation (last 6 matches per league)
      evalPool.push(...allFixtures[l].slice(-6).map(m => ({ ...m, league: l })));
    } catch (e: any) {
      logger.error('runBacktest_fetch', e, { league: l });
    }
  }

  let totalPnl = 0, totalStake = 0, totalMatches = 0;
  let over25Correct = 0, over25Total = 0, under25Correct = 0, under25Total = 0;
  let brierSum = 0, clvSum = 0, clvCount = 0;

  const segments = [
    { segment: 'Low Edge (0-2%)', min: 0, max: 2, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'Mid Edge (2-5%)', min: 2, max: 5, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'High Edge (5-8%)', min: 5, max: 8, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'Elite Edge (8%+)', min: 8, max: 100, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
  ];

  const results: BacktestMatch[] = [];

  // Parallelize predictions within leagues or handle them sequentially to avoid overwhelming
  for (const match of evalPool) {
    try {
      // Since we fetched odds in getHistoricalFixtures, we use match.takenPrices/closingPrices
      const prediction = await runPrediction(
        match.home, 
        match.away, 
        match.league, 
        null, 
        { takenPrices: match.takenPrices, closingPrices: match.closingPrices }, 
        match.date, 
        allFixtures
      );

      const totalGoals = match.homeGoals + match.awayGoals;
      const isOver25Correct = totalGoals > 2.5;
      const isUnder25Correct = totalGoals < 2.5;

      // Brier score (normalized Over 2.5 prob)
      brierSum += Math.pow(prediction.rawProbability - (isOver25Correct ? 1 : 0), 2);

      // CLV calculation
      let clv = 0;
      const closingPrice = prediction.predictionType === 'OVER_25' ? match.closingPrices?.over25 : match.closingPrices?.under25;
      if (closingPrice && closingPrice > 1 && prediction.marketOdds && prediction.marketOdds > 1) {
        clv = (prediction.marketOdds / closingPrice - 1) * 100;
        clvSum += clv;
        clvCount++;
      }

      // PnL & Yield
      let pnl = 0;
      if (prediction.predictionType !== 'NO_BET' && prediction.marketOdds) {
        const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
        pnl = isHit ? (prediction.recommendedStake * prediction.marketOdds - prediction.recommendedStake) : -prediction.recommendedStake;
        totalPnl += pnl;
        totalStake += prediction.recommendedStake;
        totalMatches++;
      }

      // Accuracy tracking
      if (prediction.predictionType === 'OVER_25') { over25Total++; if (isOver25Correct) over25Correct++; }
      if (prediction.predictionType === 'UNDER_25') { under25Total++; if (isUnder25Correct) under25Correct++; }

      // Edge segments
      const absEdge = Math.abs(prediction.edge || 0);
      const seg = segments.find(s => absEdge >= s.min && absEdge < s.max);
      if (seg && prediction.predictionType !== 'NO_BET') {
        seg.count++;
        seg.edgeSum += absEdge;
        if (clv !== 0) { seg.clvSum += clv; seg.clvCount++; }
        const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
        if (isHit) seg.hits++;
      }

      results.push({
        match: { homeTeam: match.home, awayTeam: match.away, actualScore: [match.homeGoals, match.awayGoals], league: match.league, isReal: true },
        prediction: { predictionType: prediction.predictionType, probability: prediction.probability, rawProbability: prediction.rawProbability },
        marketEdge: prediction.edge ? prediction.edge / 100 : null,
        isOver25Correct,
        isUnder25Correct,
        pnl,
        clv,
        stake: prediction.recommendedStake,
        takenOdds: prediction.marketOdds,
        closingOdds: closingPrice
      });
    } catch (e: any) {
      logger.warn('runBacktest_match', `Failed to process match ${match?.home} vs ${match?.away}: ${e.message}`);
      continue;
    }
  }

  // Finalize segments stats
  segments.forEach(s => {
    s.hitRate = s.count > 0 ? s.hits / s.count : 0;
    s.avgEdge = s.count > 0 ? s.edgeSum / s.count : 0;
    s.avgClv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0;
  });

  return {
    totalMatches,
    brierScore: results.length > 0 ? brierSum / results.length : 0,
    over25Accuracy: over25Total > 0 ? (over25Correct / over25Total) * 100 : 0,
    under25Accuracy: under25Total > 0 ? (under25Correct / under25Total) * 100 : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield: totalStake > 0 ? (totalPnl / totalStake) * 100 : 0,
    avgClv: clvCount > 0 ? clvSum / clvCount : 0,
    edgeSegments: segments,
    matches: results.slice(0, 20)
  };
}
