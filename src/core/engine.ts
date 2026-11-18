import { AnalysisResult, InternalTeamData, HistoricalMatch, BacktestSummary, BacktestMatch } from '../types';
import {
  TEAM_STATS,
  LEAGUE_CONFIGS,
  BASE_GOALS,
  DEFAULT_RHO,
  HOME_ADVANTAGE_WEIGHT,
  AWAY_DEFENSE_WEIGHT,
  MODEL_CONFIG,
  BACKTEST_CONFIG,
} from './constants';
import { DixonColes } from './math';
import * as FreeDataService from '../services/freeDataService';
import { loadBacktestDataset, CsvHistoricalMatch, assertDistinctSnapshots } from '../services/footballDataCsv';
import * as Calibration from './calibration';
import { resolveTeam } from '../data/teamIds';
import { logger } from '../services/logger';

/**
 * Resolve fallback attack/defense strength multipliers.
 */
async function resolveTeamData(
  teamName: string,
  leagueKey: string,
  asOfDate?: string
): Promise<{ data: InternalTeamData; isGeneric: boolean; dataSource: 'LIVE' | 'FALLBACK_STATIC' }> {
  if (asOfDate) {
    return {
      data: { attackStrength: 1.0, defenseStrength: 1.0 },
      isGeneric: true,
      dataSource: 'FALLBACK_STATIC',
    };
  }
  const live = await FreeDataService.getTeamStats(teamName, leagueKey);
  const staticData = TEAM_STATS[resolveTeam(teamName).id];
  return {
    data: live || staticData || { attackStrength: 1.0, defenseStrength: 1.0 },
    isGeneric: !live && !staticData,
    dataSource: live ? 'LIVE' : 'FALLBACK_STATIC',
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
 */
export async function runPrediction(
  homeTeam: string,
  awayTeam: string,
  league: string,
  historicalOddsOverride: { over25?: { bestPrice: number }; under25?: { bestPrice: number } } | null = null,
  asOfDate?: string,
  fixtureCache?: Record<string, HistoricalMatch[]>,
  fittedParamsOverride?: Calibration.FittedLeagueParams
): Promise<AnalysisResult> {
  try {
    const leagueKey = league.toUpperCase().replace(/ /g, '_');
    const leagueConfig = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['STANDARD'];

    const [homeRes, awayRes, liveOdds, fittedParams] = await Promise.all([
      fittedParamsOverride
        ? Promise.resolve({ data: { attackStrength: 1.0, defenseStrength: 1.0 }, isGeneric: true, dataSource: 'FALLBACK_STATIC' as const })
        : resolveTeamData(homeTeam, leagueKey, asOfDate),
      fittedParamsOverride
        ? Promise.resolve({ data: { attackStrength: 1.0, defenseStrength: 1.0 }, isGeneric: true, dataSource: 'FALLBACK_STATIC' as const })
        : resolveTeamData(awayTeam, leagueKey, asOfDate),
      historicalOddsOverride ? Promise.resolve([]) : FreeDataService.getLiveOdds(leagueKey),
      fittedParamsOverride
        ? Promise.resolve(fittedParamsOverride)
        : Calibration.fitFromAPI(leagueKey, asOfDate, fixtureCache?.[leagueKey]),
    ]);

    const mle = Calibration.predictGoals(fittedParams, homeTeam, awayTeam);
    const leagueBase = BASE_GOALS * leagueConfig.goalRate;
    const lambdaHome = mle
      ? mle.lambdaHome
      : Math.max(
          MODEL_CONFIG.MIN_LAMBDA,
          Math.min(
            MODEL_CONFIG.MAX_LAMBDA,
            homeRes.data.attackStrength * awayRes.data.defenseStrength * leagueBase * (1 + leagueConfig.homeAdvantage * HOME_ADVANTAGE_WEIGHT)
          )
        );
    const muAway = mle
      ? mle.muAway
      : Math.max(
          MODEL_CONFIG.MIN_MU,
          Math.min(
            MODEL_CONFIG.MAX_MU,
            awayRes.data.attackStrength * homeRes.data.defenseStrength * leagueBase * (1 - leagueConfig.homeAdvantage * AWAY_DEFENSE_WEIGHT)
          )
        );

    const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, mle ? fittedParams.rho : DEFAULT_RHO);
    const probOver25 = DixonColes.calculateOverUnder(scoreMatrix, 2.5);
    const probUnder25 = 1 - probOver25;

    let marketOddsOver25 = 0;
    let marketOddsUnder25 = 0;
    let marketSourceName: string | undefined;

    if (historicalOddsOverride) {
      marketOddsOver25 = historicalOddsOverride.over25?.bestPrice || 0;
      marketOddsUnder25 = historicalOddsOverride.under25?.bestPrice || 0;
      marketSourceName = 'Historical Feed';
    } else {
      const liveMatchOdds = liveOdds.find((o: any) => resolveTeam(o.home_team).id === resolveTeam(homeTeam).id);
      const best = getBestOdds(liveMatchOdds);
      marketOddsOver25 = best.o25;
      marketOddsUnder25 = best.u25;
      if (marketOddsOver25 > 1 || marketOddsUnder25 > 1) {
        marketSourceName = liveMatchOdds?.bookmakers?.[0]?.title || 'The Odds API';
      }
    }

    const over25Edge = marketOddsOver25 > 1 ? probOver25 - 1 / marketOddsOver25 : -1;
    const under25Edge = marketOddsUnder25 > 1 ? probUnder25 - 1 / marketOddsUnder25 : -1;
    const threshold = MODEL_CONFIG.EDGE_THRESHOLD;
    const isLowConfidence = mle?.lowConfidence || false;

    const pick =
      !isLowConfidence && over25Edge > under25Edge && over25Edge > threshold
        ? 'OVER_25'
        : !isLowConfidence && under25Edge > threshold
        ? 'UNDER_25'
        : 'NO_BET';

    const edge = pick === 'OVER_25' ? over25Edge : pick === 'UNDER_25' ? under25Edge : 0;
    const marketOdds = pick === 'OVER_25' ? marketOddsOver25 : pick === 'UNDER_25' ? marketOddsUnder25 : null;

    const p = pick === 'OVER_25' ? probOver25 : pick === 'UNDER_25' ? probUnder25 : 0;
    const kelly =
      marketOdds && edge > threshold
        ? Math.min(MODEL_CONFIG.MAX_KELLY_STAKE, ((p * marketOdds - 1) / (marketOdds - 1)) * MODEL_CONFIG.KELLY_FRACTION)
        : 0;

    const goalBuckets = [0, 0, 0, 0, 0, 0];
    for (let h = 0; h < scoreMatrix.length; h++) {
      for (let a = 0; a < scoreMatrix[h].length; a++) {
        const idx = Math.min(5, h + a);
        goalBuckets[idx] += scoreMatrix[h][a] || 0;
      }
    }
    const goalDistribution = goalBuckets.map((prob, idx) => ({
      goals: idx === 5 ? '5+' : String(idx),
      probability: Math.round(prob * 1000) / 10,
    }));

    return {
      probability: Math.round(p * 100),
      rawProbability: probOver25,
      homeStats: { name: homeTeam.toUpperCase() },
      awayStats: { name: awayTeam.toUpperCase() },
      homeExpectedGoals: lambdaHome,
      awayExpectedGoals: muAway,
      predictionType: pick,
      predictionLabel: pick === 'NO_BET' ? 'NO EDGE' : pick,
      marketOdds,
      marketImpliedProb: marketOdds ? 1 / marketOdds : null,
      edge: Math.round(edge * 1000) / 10,
      recommendedStake: Math.round(kelly * 1000) / 10,
      verdict: kelly > 0 ? 'EXECUTE_BET' : 'NO_BET',
      context: {
        league: leagueKey,
        date: asOfDate || '',
        marketOdds: {
          pinnacleOver25: marketOddsOver25,
          pinnacleUnder25: marketOddsUnder25,
          source: marketSourceName,
        },
      },
      dataSource: homeRes.dataSource,
      modelSource: mle ? 'MLE_FITTED' : 'HEURISTIC_FALLBACK',
      isLowConfidence,
      degraded: homeRes.isGeneric || awayRes.isGeneric || !mle,
      goalDistribution,
      scoreMatrix: scoreMatrix.slice(0, 6).map((r) => r.slice(0, 6)),
    };
  } catch (err: unknown) {
    logger.error('runPrediction', err instanceof Error ? err : new Error(String(err)), { homeTeam, awayTeam, league });
    throw new Error(`[Engine] Prediction failed: ${(err as Error).message}`);
  }
}

export interface BacktestOptions {
  leagues?: readonly string[];
  trainSeasons?: readonly string[];
  evalSeasons?: readonly string[];
  preloadedMatches?: Record<string, (HistoricalMatch & { season?: string })[]>;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Run walk-forward backtest simulation on free football-data.co.uk CSVs.
 */
export async function runBacktest(options?: BacktestOptions): Promise<BacktestSummary> {
  const leagues = [...(options?.leagues || BACKTEST_CONFIG.LEAGUES)];
  const trainSeasons = [...(options?.trainSeasons || BACKTEST_CONFIG.TRAIN_SEASONS)];
  const evalSeasons = [...(options?.evalSeasons || BACKTEST_CONFIG.EVAL_SEASONS)];
  const allSeasons = [...new Set([...trainSeasons, ...evalSeasons])];

  let allFixtures: Record<string, CsvHistoricalMatch[]> = {};
  let matchesDownloaded = 0;

  if (options?.preloadedMatches) {
    for (const l of leagues) {
      const rows = (options.preloadedMatches[l] || []).map((m) => ({
        ...m,
        home: resolveTeam(m.home).id,
        away: resolveTeam(m.away).id,
        season: m.season || evalSeasons[0] || '2425',
      }));
      rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      allFixtures[l] = rows;
      matchesDownloaded += rows.length;
    }
  } else {
    const dataset = await loadBacktestDataset(allSeasons, leagues);
    allFixtures = dataset.matchesByLeague;
    matchesDownloaded = dataset.matchesDownloaded;
  }

  let totalPnl = 0, totalStake = 0, totalMatches = 0, matchesEvaluated = 0;
  let over25Correct = 0, over25Total = 0, under25Correct = 0, under25Total = 0;
  let brierSum = 0, marketBrierSum = 0, marketBrierCount = 0;
  let clvSum = 0, clvCount = 0, clvNoVigSum = 0, clvNoVigCount = 0;
  let mleFitted = 0, heuristicFallback = 0, d4Mismatches = 0;

  const clvValues: number[] = [];
  const betRois: number[] = [];
  const betPnls: { ts: number; pnl: number }[] = [];

  const segments = [
    { segment: 'Low Edge (0-2%)', min: 0, max: 2, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'Mid Edge (2-5%)', min: 2, max: 5, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'High Edge (5-8%)', min: 5, max: 8, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'Elite Edge (8%+)', min: 8, max: 100, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
  ];

  const results: BacktestMatch[] = [];
  const matchdayFitCache = new Map<string, Calibration.FittedLeagueParams>();

  for (const league of leagues) {
    const leagueHistory = allFixtures[league] || [];
    const evalMatches = leagueHistory.filter((m) => evalSeasons.includes(m.season));
    if (evalMatches.length === 0) continue;

    const matchdays = new Map<string, CsvHistoricalMatch[]>();
    for (const m of evalMatches) {
      const dayKey = m.date.split('T')[0];
      const bucket = matchdays.get(dayKey);
      if (bucket) bucket.push(m);
      else matchdays.set(dayKey, [m]);
    }

    const priorCounts: Record<string, number> = {};
    let histCursor = 0;

    for (const [dayKey, dayMatches] of matchdays.entries()) {
      const cutoffIso = `${dayKey}T00:00:00.000Z`;
      const cutoffMs = new Date(cutoffIso).getTime();

      while (histCursor < leagueHistory.length && new Date(leagueHistory[histCursor].date).getTime() < cutoffMs) {
        const hm = leagueHistory[histCursor];
        priorCounts[hm.home] = (priorCounts[hm.home] || 0) + 1;
        priorCounts[hm.away] = (priorCounts[hm.away] || 0) + 1;
        histCursor++;
      }

      const priorHistory = leagueHistory.slice(0, histCursor);
      const priorFixtureCache = { [league]: priorHistory };

      const cacheKey = `${league}_${dayKey}`;
      let fittedParams = matchdayFitCache.get(cacheKey);
      if (!fittedParams) {
        fittedParams = await Calibration.fitFromAPI(league, cutoffIso, priorHistory);
        matchdayFitCache.set(cacheKey, fittedParams);
      }

      for (const match of dayMatches) {
        try {
          const prediction = await runPrediction(
            match.home,
            match.away,
            league,
            {
              over25: { bestPrice: match.takenPrices?.over25 || 0 },
              under25: { bestPrice: match.takenPrices?.under25 || 0 },
            },
            cutoffIso,
            priorFixtureCache,
            fittedParams
          );

          if (prediction.modelSource === 'MLE_FITTED') {
            mleFitted++;
          } else {
            heuristicFallback++;
            const hPrior = priorCounts[match.home] || 0;
            const aPrior = priorCounts[match.away] || 0;
            if (hPrior >= 6 && aPrior >= 6) {
              d4Mismatches++;
              logger.warn(
                'runBacktest_D4_ASSERT',
                `HEURISTIC_FALLBACK despite >=6 prior matches (${match.home}=${hPrior}, ${match.away}=${aPrior}) in ${league} on ${dayKey}`
              );
            }
          }

          const totalGoals = match.homeGoals + match.awayGoals;
          const isOver25Correct = totalGoals > 2.5;
          const isUnder25Correct = totalGoals < 2.5;

          matchesEvaluated++;
          brierSum += Math.pow(prediction.rawProbability - (isOver25Correct ? 1 : 0), 2);

          const closeOver = match.closingPrices?.over25;
          const closeUnder = match.closingPrices?.under25;
          if (closeOver && closeOver > 1 && closeUnder && closeUnder > 1) {
            const pMarket = 1 / closeOver / (1 / closeOver + 1 / closeUnder);
            marketBrierSum += Math.pow(pMarket - (isOver25Correct ? 1 : 0), 2);
            marketBrierCount++;
          }

          let clv: number | null = null;
          let clvNoVig: number | null = null;
          let validClosingPrice: number | null = null;
          const closingPrice =
            prediction.predictionType === 'OVER_25'
              ? match.closingPrices?.over25
              : prediction.predictionType === 'UNDER_25'
              ? match.closingPrices?.under25
              : null;

          if (match.closingPrices) {
            try {
              assertDistinctSnapshots(match.takenPrices, match.closingPrices, match.takenAt, match.closedAt);

              if (
                prediction.predictionType !== 'NO_BET' &&
                closingPrice &&
                closingPrice > 1 &&
                prediction.marketOdds &&
                prediction.marketOdds > 1
              ) {
                validClosingPrice = closingPrice;
                clv = (prediction.marketOdds / closingPrice - 1) * 100;
                clvSum += clv;
                clvCount++;
                clvValues.push(clv);
              }

              const takenNoVig =
                prediction.predictionType === 'OVER_25'
                  ? match.takenPrices?.over25NoVig
                  : prediction.predictionType === 'UNDER_25'
                  ? match.takenPrices?.under25NoVig
                  : null;
              const closingNoVig =
                prediction.predictionType === 'OVER_25'
                  ? match.closingPrices?.over25NoVig
                  : prediction.predictionType === 'UNDER_25'
                  ? match.closingPrices?.under25NoVig
                  : null;

              if (
                prediction.predictionType !== 'NO_BET' &&
                takenNoVig &&
                takenNoVig > 1 &&
                closingNoVig &&
                closingNoVig > 1
              ) {
                clvNoVig = (takenNoVig / closingNoVig - 1) * 100;
                clvNoVigSum += clvNoVig;
                clvNoVigCount++;
              }
            } catch (err: unknown) {
              logger.warn('runBacktest_clv', `Skipping invalid CLV snapshot for ${match.home} vs ${match.away}: ${(err as Error).message}`);
            }
          }

          let pnl = 0;
          if (prediction.predictionType !== 'NO_BET' && prediction.marketOdds && prediction.recommendedStake > 0) {
            const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
            pnl = isHit
              ? prediction.recommendedStake * prediction.marketOdds - prediction.recommendedStake
              : -prediction.recommendedStake;
            totalPnl += pnl;
            totalStake += prediction.recommendedStake;
            totalMatches++;
            betRois.push((pnl / prediction.recommendedStake) * 100);
            betPnls.push({ ts: new Date(match.date).getTime(), pnl });
          }

          if (prediction.predictionType === 'OVER_25') { over25Total++; if (isOver25Correct) over25Correct++; }
          if (prediction.predictionType === 'UNDER_25') { under25Total++; if (isUnder25Correct) under25Correct++; }

          const absEdge = Math.abs(prediction.edge || 0);
          const seg = segments.find((s) => absEdge >= s.min && absEdge < s.max);
          if (seg && prediction.predictionType !== 'NO_BET') {
            seg.count++;
            seg.edgeSum += absEdge;
            if (clv !== null) { seg.clvSum += clv; seg.clvCount++; }
            const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
            if (isHit) seg.hits++;
          }

          results.push({
            match: {
              homeTeam: match.home,
              awayTeam: match.away,
              actualScore: [match.homeGoals, match.awayGoals],
              league,
              isReal: true,
            },
            prediction: {
              predictionType: prediction.predictionType,
              probability: prediction.probability,
              rawProbability: prediction.rawProbability,
            },
            modelSource: prediction.modelSource,
            marketEdge: prediction.edge ? prediction.edge / 100 : null,
            isOver25Correct,
            isUnder25Correct,
            pnl,
            clv,
            clvNoVig,
            stake: prediction.recommendedStake,
            takenOdds: prediction.marketOdds,
            closingOdds: validClosingPrice,
          });
        } catch (e: unknown) {
          logger.warn('runBacktest_match', `Failed to process match ${match?.home} vs ${match?.away}: ${(e as Error).message}`);
        }
      }
    }
  }

  segments.forEach((s) => {
    s.hitRate = s.count > 0 ? s.hits / s.count : 0;
    s.avgEdge = s.count > 0 ? s.edgeSum / s.count : 0;
    s.avgClv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0;
  });

  const brierScore = matchesEvaluated > 0 ? brierSum / matchesEvaluated : 0;
  const marketBrier = marketBrierCount > 0 ? marketBrierSum / marketBrierCount : null;
  const brierVsMarket = marketBrier !== null ? brierScore - marketBrier : null;
  const totalYield = totalStake > 0 ? (totalPnl / totalStake) * 100 : 0;
  const avgClv = clvCount > 0 ? clvSum / clvCount : 0;

  let clvStats: BacktestSummary['clvStats'] = null;
  if (clvValues.length > 0) {
    const clvStdErr = clvValues.length >= 2 ? sampleStdDev(clvValues) / Math.sqrt(clvValues.length) : 0;
    clvStats = {
      avg: avgClv,
      stdErr: clvStdErr,
      ci95Low: avgClv - 1.96 * clvStdErr,
      ci95High: avgClv + 1.96 * clvStdErr,
      n: clvValues.length,
    };
  }

  const roiStdErr = betRois.length >= 2 ? sampleStdDev(betRois) / Math.sqrt(betRois.length) : 0;
  const roi95CI = {
    low: totalYield - 1.96 * roiStdErr,
    high: totalYield + 1.96 * roiStdErr,
    stdErr: roiStdErr,
    nBets: betRois.length,
  };

  betPnls.sort((a, b) => a.ts - b.ts);
  let cumPnl = 0, peakPnl = 0, maxDrawdown = 0;
  for (const bp of betPnls) {
    cumPnl += bp.pnl;
    if (cumPnl > peakPnl) peakPnl = cumPnl;
    const dd = peakPnl - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const failingConditions: string[] = [];
  if (matchesEvaluated < 100) failingConditions.push(`matchesEvaluated (${matchesEvaluated}) < 100`);
  if (totalMatches < 30) failingConditions.push(`placedBets (${totalMatches}) < 30`);
  if (brierVsMarket === null) failingConditions.push('marketBrier unavailable');
  else if (brierVsMarket >= 0) failingConditions.push(`brierVsMarket (${brierVsMarket.toFixed(5)}) >= 0`);
  if (clvCount === 0) failingConditions.push('no closing prices for CLV');
  else if (avgClv <= 0) failingConditions.push(`avgClv (${avgClv.toFixed(2)}%) <= 0`);
  if (roi95CI.low <= 0) failingConditions.push(`roi95CI.low (${roi95CI.low.toFixed(2)}%) <= 0`);

  let verdictStatus: 'PROMISING' | 'NO_EDGE' | 'INCONCLUSIVE';
  if (
    brierVsMarket !== null &&
    brierVsMarket < 0 &&
    clvCount > 0 &&
    avgClv > 0 &&
    roi95CI.low > 0 &&
    matchesEvaluated >= 100 &&
    totalMatches >= 30
  ) {
    verdictStatus = 'PROMISING';
  } else if (matchesEvaluated < 100 || totalMatches < 30 || brierVsMarket === null || clvCount === 0) {
    verdictStatus = 'INCONCLUSIVE';
  } else if (brierVsMarket < 0 || avgClv > 0) {
    verdictStatus = 'INCONCLUSIVE';
  } else {
    verdictStatus = 'NO_EDGE';
  }

  return {
    totalMatches,
    brierScore,
    marketBrier,
    brierVsMarket,
    over25Accuracy: over25Total > 0 ? (over25Correct / over25Total) * 100 : 0,
    under25Accuracy: under25Total > 0 ? (under25Correct / under25Total) * 100 : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalYield,
    avgClv,
    clvCoverage: totalMatches > 0 ? (clvCount / totalMatches) * 100 : 0,
    avgClvNoVig: clvNoVigCount > 0 ? clvNoVigSum / clvNoVigCount : 0,
    clvStats,
    roi95CI,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    modelBreakdown: {
      mleFitted,
      heuristicFallback,
      d4Mismatches,
    },
    dataLineage: {
      source: 'football-data.co.uk',
      seasons: allSeasons,
      leagues,
      matchesDownloaded,
      matchesEvaluated,
    },
    verdict: {
      status: verdictStatus,
      failingConditions,
    },
    edgeSegments: segments,
    matches: results.slice(0, 50),
  };
}
