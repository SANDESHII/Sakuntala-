import { AnalysisResult, InternalTeamData, HistoricalMatch, BacktestSummary } from '../types';
import { TEAM_STATS, LEAGUE_CONFIGS, BASE_GOALS, DEFAULT_RHO, HOME_ADVANTAGE_WEIGHT, AWAY_DEFENSE_WEIGHT, EDGE_THRESHOLD } from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from './calibration';
import { FeatureEngine } from './features';
import { resolveTeam } from '../data/teamIds';

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
  const backtestMatches: any[] = [];
  const evalPool: any[] = [];
  const fixtureCache: Record<string, HistoricalMatch[]> = {};

  for (const l of leagues) {
    const raw = await FreeDataService.getHistoricalFixtures(l, 80, false);
    fixtureCache[l] = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    evalPool.push(...fixtureCache[l].slice(-8));
  }

  let totalPnl = 0, totalStake = 0, brierSum = 0, brierCount = 0;
  let o25Hits = 0, o25Total = 0, u25Hits = 0, u25Total = 0, clvSum = 0;
  
  const edgeBuckets: Record<string, { count: number; hits: number; sumEdge: number; sumClv: number }> = {
    '0.0-1.0': { count: 0, hits: 0, sumEdge: 0, sumClv: 0 },
    '1.0-2.0': { count: 0, hits: 0, sumEdge: 0, sumClv: 0 },
    '2.0-3.0': { count: 0, hits: 0, sumEdge: 0, sumClv: 0 },
    '3.0+': { count: 0, hits: 0, sumEdge: 0, sumClv: 0 }
  };

  for (const match of evalPool) {
    const odds = await FreeDataService.getHistoricalOddsForMatch(match.league, match.date, match.home, match.away);
    const prediction = await runPrediction(match.home, match.away, match.league, null, odds?.takenPrices, match.date, fixtureCache);
    
    const actualTotalGoals = match.homeGoals + match.awayGoals;
    const actualOver = actualTotalGoals > 2.5 ? 1 : 0;
    const isHit = (prediction.predictionType === 'OVER_25' && actualOver === 1) || (prediction.predictionType === 'UNDER_25' && actualOver === 0);
    
    brierSum += Math.pow(prediction.rawProbability - actualOver, 2);
    brierCount++;

    const takenOdds = prediction.marketOdds || 0;
    const closingOdds = (prediction.predictionType === 'OVER_25' ? odds?.closingPrices?.over25 : odds?.closingPrices?.under25) || takenOdds;
    const clv = closingOdds > 0 ? takenOdds / closingOdds : 1;
    clvSum += clv;

    if (prediction.predictionType !== 'NO_BET' && takenOdds > 0) {
      const pnl = isHit ? (prediction.recommendedStake * takenOdds - prediction.recommendedStake) : -prediction.recommendedStake;
      totalPnl += pnl;
      totalStake += prediction.recommendedStake;
      
      if (prediction.predictionType === 'OVER_25') { o25Total++; if (isHit) o25Hits++; }
      else { u25Total++; if (isHit) u25Hits++; }

      const edgeVal = prediction.edge || 0;
      let bucket = '0.0-1.0';
      if (edgeVal >= 3.0) bucket = '3.0+';
      else if (edgeVal >= 2.0) bucket = '2.0-3.0';
      else if (edgeVal >= 1.0) bucket = '1.0-2.0';
      
      edgeBuckets[bucket].count++;
      if (isHit) edgeBuckets[bucket].hits++;
      edgeBuckets[bucket].sumEdge += edgeVal;
      edgeBuckets[bucket].sumClv += clv;
    }

    backtestMatches.push({
      match: {
        homeTeam: match.home,
        awayTeam: match.away,
        actualScore: [match.homeGoals, match.awayGoals],
        league: match.league,
        isReal: true
      },
      prediction: {
        predictionType: prediction.predictionType,
        probability: prediction.probability,
        rawProbability: prediction.rawProbability
      },
      marketEdge: prediction.edge,
      isOver25Correct: actualOver === 1,
      isUnder25Correct: actualOver === 0,
      pnl: prediction.predictionType !== 'NO_BET' ? (isHit ? (prediction.recommendedStake * takenOdds - prediction.recommendedStake) : -prediction.recommendedStake) : 0,
      clv,
      stake: prediction.recommendedStake,
      takenOdds,
      closingOdds
    });
  }

  const edgeSegments = Object.entries(edgeBuckets).map(([segment, data]) => {
    const [min, max] = segment.endsWith('+') ? [3, 10] : segment.split('-').map(Number);
    return {
      segment,
      min,
      max: max || 10,
      count: data.count,
      hits: data.hits,
      hitRate: data.count > 0 ? (data.hits / data.count) * 100 : 0,
      avgEdge: data.count > 0 ? data.sumEdge / data.count : 0,
      avgClv: data.count > 0 ? data.sumClv / data.count : 0
    };
  });

  return {
    totalMatches: brierCount,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield: totalStake > 0 ? (totalPnl / totalStake) * 100 : 0,
    brierScore: brierCount > 0 ? brierSum / brierCount : 0,
    over25Accuracy: o25Total > 0 ? (o25Hits / o25Total) * 100 : 0,
    under25Accuracy: u25Total > 0 ? (u25Hits / u25Total) * 100 : 0,
    avgClv: brierCount > 0 ? clvSum / brierCount : 1,
    edgeSegments,
    matches: backtestMatches.slice(-20).reverse()
  };
}
