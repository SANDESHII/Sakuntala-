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
  const matches: any[] = [];
  const evalPool: any[] = [];
  const fixtureCache: Record<string, HistoricalMatch[]> = {};

  for (const l of leagues) {
    const raw = await FreeDataService.getHistoricalFixtures(l, 80, false);
    fixtureCache[l] = raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    evalPool.push(...fixtureCache[l].slice(-6));
  }

  let totalPnl = 0, totalStake = 0, totalMatches = 0;

  for (const match of evalPool) {
    const odds = await FreeDataService.getHistoricalOddsForMatch(match.league, match.date, match.home, match.away);
    const prediction = await runPrediction(match.home, match.away, match.league, null, odds?.takenPrices, match.date, fixtureCache);
    const isHit = (prediction.predictionType === 'OVER_25' && (match.homeGoals + match.awayGoals) > 2.5) || (prediction.predictionType === 'UNDER_25' && (match.homeGoals + match.awayGoals) < 2.5);
    
    if (prediction.predictionType !== 'NO_BET' && prediction.marketOdds) {
      const pnl = isHit ? (prediction.recommendedStake * prediction.marketOdds - prediction.recommendedStake) : -prediction.recommendedStake;
      totalPnl += pnl;
      totalStake += prediction.recommendedStake;
      totalMatches++;
    }

    matches.push({ match, prediction, isHit });
  }

  return {
    totalMatches,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield: totalStake > 0 ? (totalPnl / totalStake) * 100 : 0,
    edgeSegments: [],
    matches: matches.slice(0, 20),
    brierScore: 0,
    over25Accuracy: 0,
    under25Accuracy: 0,
    avgClv: 0
  };
}
