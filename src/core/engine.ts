import {
  AnalysisResult,
  InternalTeamData,
  HistoricalMatch,
  BacktestSummary,
  BacktestMatch,
  LeagueRatingsResponse,
  TeamRatingRow,
  LeagueBacktestStats,
  EquityCurvePoint,
} from '../types';
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
import { resolveTeam, formatTeamName, LEAGUE_TEAMS } from '../data/teamIds';
import { logger } from '../services/logger';

/**
 * Resolve fallback attack/defense strength multipliers.
 */
async function resolveTeamData(
  teamName: string,
  leagueKey: string,
  asOfDate?: string
): Promise<{ data: InternalTeamData; dataSource: 'LIVE' | 'FALLBACK_STATIC' }> {
  if (asOfDate) {
    return {
      data: { attackStrength: 1.0, defenseStrength: 1.0 },
      dataSource: 'FALLBACK_STATIC',
    };
  }
  const live = await FreeDataService.getTeamStats(teamName, leagueKey);
  const staticData = TEAM_STATS[resolveTeam(teamName).id];
  return {
    data: live || staticData || { attackStrength: 1.0, defenseStrength: 1.0 },
    dataSource: live ? 'LIVE' : 'FALLBACK_STATIC',
  };
}

/**
 * Extract Pinnacle sharp odds (preferred) and best market odds for Over/Under 2.5.
 */
function getMarketOdds(matchOdds: any) {
  let bestO25 = 0;
  let bestU25 = 0;
  let pinO25 = 0;
  let pinU25 = 0;
  matchOdds?.bookmakers?.forEach((bm: any) => {
    const market = bm?.markets?.find((m: any) => m?.key === 'totals');
    const o = market?.outcomes?.find((oc: any) => oc?.name === 'Over' && oc?.point === 2.5);
    const u = market?.outcomes?.find((oc: any) => oc?.name === 'Under' && oc?.point === 2.5);
    if (bm?.key === 'pinnacle') {
      if (o?.price > 1) pinO25 = o.price;
      if (u?.price > 1) pinU25 = u.price;
    }
    if (o?.price > bestO25) bestO25 = o.price;
    if (u?.price > bestU25) bestU25 = u.price;
  });
  return {
    o25: pinO25 > 1 ? pinO25 : bestO25,
    u25: pinU25 > 1 ? pinU25 : bestU25,
    bestO25,
    bestU25,
  };
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
    const resolvedHome = resolveTeam(homeTeam);
    const resolvedAway = resolveTeam(awayTeam);

    const [liveOdds, fittedParams] = await Promise.all([
      historicalOddsOverride || asOfDate ? Promise.resolve([]) : FreeDataService.getLiveOdds(leagueKey),
      fittedParamsOverride
        ? Promise.resolve(fittedParamsOverride)
        : Calibration.fitFromAPI(leagueKey, asOfDate, fixtureCache?.[leagueKey]),
    ]);

    const mle = Calibration.predictGoals(fittedParams, homeTeam, awayTeam);
    const [homeRes, awayRes] = mle
      ? [
          { data: { attackStrength: 1.0, defenseStrength: 1.0 }, dataSource: 'FALLBACK_STATIC' as const },
          { data: { attackStrength: 1.0, defenseStrength: 1.0 }, dataSource: 'FALLBACK_STATIC' as const },
        ]
      : await Promise.all([
          resolveTeamData(homeTeam, leagueKey, asOfDate),
          resolveTeamData(awayTeam, leagueKey, asOfDate),
        ]);
    const leagueBase = BASE_GOALS * leagueConfig.goalRate;
    const lambdaHome = mle
      ? mle.lambdaHome
      : Math.max(
          MODEL_CONFIG.MIN_LAMBDA,
          Math.min(
            MODEL_CONFIG.MAX_LAMBDA,
            homeRes.data.attackStrength *
              awayRes.data.defenseStrength *
              leagueBase *
              (1 + leagueConfig.homeAdvantage * HOME_ADVANTAGE_WEIGHT)
          )
        );
    const muAway = mle
      ? mle.muAway
      : Math.max(
          MODEL_CONFIG.MIN_MU,
          Math.min(
            MODEL_CONFIG.MAX_MU,
            awayRes.data.attackStrength *
              homeRes.data.defenseStrength *
              leagueBase *
              (1 - leagueConfig.homeAdvantage * AWAY_DEFENSE_WEIGHT)
          )
        );

    const activeRho = mle ? fittedParams.rho : DEFAULT_RHO;
    const scoreMatrix = DixonColes.calculateScoreMatrix(lambdaHome, muAway, activeRho);
    const markets = DixonColes.calculateDerivedMarkets(scoreMatrix);
    const topScorelines = DixonColes.getTopScorelines(scoreMatrix, 6);
    const probOver25 = markets.over25;
    const probUnder25 = markets.under25;

    let marketOddsOver25 = 0;
    let marketOddsUnder25 = 0;

    if (historicalOddsOverride) {
      marketOddsOver25 = historicalOddsOverride.over25?.bestPrice || 0;
      marketOddsUnder25 = historicalOddsOverride.under25?.bestPrice || 0;
    } else {
      const liveMatchOdds = liveOdds.find(
        (o: any) =>
          o?.home_team &&
          o?.away_team &&
          resolveTeam(o.home_team).id === resolvedHome.id &&
          resolveTeam(o.away_team).id === resolvedAway.id
      );
      const market = getMarketOdds(liveMatchOdds);
      marketOddsOver25 = market.o25;
      marketOddsUnder25 = market.u25;
    }

    const hasTwoWayMarket = marketOddsOver25 > 1 && marketOddsUnder25 > 1;
    let posteriorOver25 = probOver25;
    let posteriorUnder25 = probUnder25;
    if (hasTwoWayMarket) {
      const invO = 1 / marketOddsOver25;
      const invU = 1 / marketOddsUnder25;
      const marketNoVigOver25 = invO / (invO + invU);
      const w = MODEL_CONFIG.BAYESIAN_MODEL_WEIGHT;
      posteriorOver25 = w * probOver25 + (1 - w) * marketNoVigOver25;
      posteriorUnder25 = 1 - posteriorOver25;
    }

    const over25Edge = marketOddsOver25 > 1 ? posteriorOver25 - 1 / marketOddsOver25 : -1;
    const under25Edge = marketOddsUnder25 > 1 ? posteriorUnder25 - 1 / marketOddsUnder25 : -1;
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

    const p = pick === 'OVER_25' ? posteriorOver25 : pick === 'UNDER_25' ? posteriorUnder25 : 0;
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
      rawProbability: probOver25,
      posteriorProbability: posteriorOver25,
      homeStats: { name: resolvedHome.id, displayName: formatTeamName(resolvedHome.id) },
      awayStats: { name: resolvedAway.id, displayName: formatTeamName(resolvedAway.id) },
      homeExpectedGoals: lambdaHome,
      awayExpectedGoals: muAway,
      predictionType: pick,
      marketOdds,
      marketImpliedProb: marketOdds ? 1 / marketOdds : null,
      edge: Math.round(edge * 1000) / 10,
      recommendedStake: Math.round(kelly * 1000) / 10,
      verdict: kelly > 0 ? 'EXECUTE_BET' : 'NO_BET',
      context: {
        league: leagueKey,
        marketOdds: {
          pinnacleOver25: marketOddsOver25 > 1 ? marketOddsOver25 : null,
          pinnacleUnder25: marketOddsUnder25 > 1 ? marketOddsUnder25 : null,
        },
      },
      dataSource: mle
        ? fittedParams.dataProvider === 'STATIC_PRIOR'
          ? 'FALLBACK_STATIC'
          : 'LIVE'
        : homeRes.dataSource,
      modelSource: mle ? 'MLE_FITTED' : 'HEURISTIC_FALLBACK',
      isLowConfidence,
      goalDistribution,
      scoreMatrix: scoreMatrix.slice(0, 6).map((r) => r.slice(0, 6)),
      markets,
      topScorelines,
      diagnostics: {
        rho: activeRho,
        homeAdvantage: mle ? fittedParams.homeAdvantage : 1 + leagueConfig.homeAdvantage * HOME_ADVANTAGE_WEIGHT,
        homeAttack: mle ? mle.homeParams.attack : homeRes.data.attackStrength,
        homeDefense: mle ? mle.homeParams.defense : homeRes.data.defenseStrength,
        awayAttack: mle ? mle.awayParams.attack : awayRes.data.attackStrength,
        awayDefense: mle ? mle.awayParams.defense : awayRes.data.defenseStrength,
        homeSampleMatches: mle ? mle.homeParams.matchCount : 0,
        awaySampleMatches: mle ? mle.awayParams.matchCount : 0,
        dataProvider: mle ? (fittedParams.dataProvider || 'FOOTBALL_DATA_CSV') : 'STATIC_PRIOR',
      },
    };
  } catch (err: unknown) {
    logger.error('runPrediction', err instanceof Error ? err : new Error(String(err)), { homeTeam, awayTeam, league });
    throw new Error(`[Engine] Prediction failed: ${(err as Error).message}`);
  }
}

/**
 * Return fitted Dixon-Coles attack/defense power ratings for all teams in a league.
 */
export async function getLeagueRatings(league: string): Promise<LeagueRatingsResponse> {
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const fitted = await Calibration.fitFromAPI(leagueKey);
  const fittedEntries = Object.entries(fitted.teams);

  let teams: TeamRatingRow[] = [];

  if (fittedEntries.length > 0) {
    teams = fittedEntries.map(([id, p]) => ({
      id,
      displayName: formatTeamName(id),
      attack: p.attack,
      defense: p.defense,
      netRating: p.attack / Math.max(p.defense, 0.2),
      matchCount: p.matchCount,
      lowConfidence: p.lowConfidence,
    }));
  } else {
    const knownIds = LEAGUE_TEAMS[leagueKey] || [];
    teams = knownIds.map((id) => {
      const prior = TEAM_STATS[id] || { attackStrength: 1.0, defenseStrength: 1.0 };
      return {
        id,
        displayName: formatTeamName(id),
        attack: prior.attackStrength,
        defense: prior.defenseStrength,
        netRating: prior.attackStrength / Math.max(prior.defenseStrength, 0.2),
        matchCount: 0,
        lowConfidence: true,
      };
    });
  }

  teams.sort((a, b) => b.netRating - a.netRating);

  return {
    league: leagueKey,
    rho: fitted.rho,
    homeAdvantage: fitted.homeAdvantage,
    matchesUsed: fitted.matchesUsed || 0,
    dataProvider: fitted.dataProvider || 'STATIC_PRIOR',
    teams,
  };
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

  let totalPnl = 0;
  let totalStake = 0;
  let totalMatches = 0;
  let matchesEvaluated = 0;
  let over25Correct = 0;
  let over25Total = 0;
  let under25Correct = 0;
  let under25Total = 0;
  let brierSum = 0;
  let marketBrierSum = 0;
  let marketBrierCount = 0;
  let modelBrierMatchedSum = 0; // model Brier on the SAME matches that have closing prices
  let clvSum = 0;
  let clvCount = 0;
  let clvNoVigSum = 0;
  let clvNoVigCount = 0;
  let mleFitted = 0;
  let heuristicFallback = 0;
  let d4Mismatches = 0;

  const clvValues: number[] = [];
  const betRois: number[] = [];
  const betPnls: { ts: number; date: string; pnl: number }[] = [];

  const segments = [
    { segment: 'Threshold Edge (3-5%)', min: 3, max: 5, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'High Edge (5-8%)', min: 5, max: 8, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
    { segment: 'Elite Edge (8%+)', min: 8, max: 100, count: 0, hits: 0, avgEdge: 0, avgClv: 0, edgeSum: 0, clvSum: 0, clvCount: 0, hitRate: 0 },
  ];

  const leagueAccum = new Map<
    string,
    { evaluated: number; bets: number; pnl: number; stake: number; clvSum: number; clvCount: number; brierSum: number }
  >();

  const results: BacktestMatch[] = [];
  const matchdayFitCache = new Map<string, Calibration.FittedLeagueParams>();

  for (const league of leagues) {
    const leagueHistory = allFixtures[league] || [];
    const evalMatches = leagueHistory.filter((m) => evalSeasons.includes(m.season));
    if (evalMatches.length === 0) continue;

    if (!leagueAccum.has(league)) {
      leagueAccum.set(league, { evaluated: 0, bets: 0, pnl: 0, stake: 0, clvSum: 0, clvCount: 0, brierSum: 0 });
    }
    const lStats = leagueAccum.get(league)!;

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

          const brierVal = Math.pow(prediction.rawProbability - (isOver25Correct ? 1 : 0), 2);
          matchesEvaluated++;
          brierSum += brierVal;
          lStats.evaluated++;
          lStats.brierSum += brierVal;

          const closeOver = match.closingPrices?.over25;
          const closeUnder = match.closingPrices?.under25;
          if (closeOver && closeOver > 1 && closeUnder && closeUnder > 1) {
            const pMarket = 1 / closeOver / (1 / closeOver + 1 / closeUnder);
            marketBrierSum += Math.pow(pMarket - (isOver25Correct ? 1 : 0), 2);
            modelBrierMatchedSum += brierVal;
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
                lStats.clvSum += clv;
                lStats.clvCount++;
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
            lStats.bets++;
            lStats.pnl += pnl;
            lStats.stake += prediction.recommendedStake;
            betRois.push((pnl / prediction.recommendedStake) * 100);
            betPnls.push({ ts: new Date(match.date).getTime(), date: dayKey, pnl });
          }

          if (prediction.predictionType === 'OVER_25') {
            over25Total++;
            if (isOver25Correct) over25Correct++;
          }
          if (prediction.predictionType === 'UNDER_25') {
            under25Total++;
            if (isUnder25Correct) under25Correct++;
          }

          const absEdge = Math.abs(prediction.edge || 0);
          const seg = segments.find((s) => absEdge >= s.min && absEdge < s.max);
          if (seg && prediction.predictionType !== 'NO_BET') {
            seg.count++;
            seg.edgeSum += absEdge;
            if (clv !== null) {
              seg.clvSum += clv;
              seg.clvCount++;
            }
            const isHit = prediction.predictionType === 'OVER_25' ? isOver25Correct : isUnder25Correct;
            if (isHit) seg.hits++;
          }

          results.push({
            date: dayKey,
            match: {
              homeTeam: match.home,
              awayTeam: match.away,
              actualScore: [match.homeGoals, match.awayGoals],
              league,
            },
            prediction: {
              predictionType: prediction.predictionType,
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

  const leagueBreakdown: LeagueBacktestStats[] = Array.from(leagueAccum.entries()).map(([league, s]) => ({
    league,
    evaluated: s.evaluated,
    bets: s.bets,
    pnl: Math.round(s.pnl * 100) / 100,
    yieldPct: s.stake > 0 ? (s.pnl / s.stake) * 100 : 0,
    avgClv: s.clvCount > 0 ? s.clvSum / s.clvCount : 0,
    brier: s.evaluated > 0 ? s.brierSum / s.evaluated : 0,
  }));

  const brierScore = matchesEvaluated > 0 ? brierSum / matchesEvaluated : 0;
  const marketBrier = marketBrierCount > 0 ? marketBrierSum / marketBrierCount : null;
  const modelBrierMatched = marketBrierCount > 0 ? modelBrierMatchedSum / marketBrierCount : null;
  const brierVsMarket = marketBrier !== null && modelBrierMatched !== null ? modelBrierMatched - marketBrier : null;
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
  let cumPnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;
  const rawEquityCurve: EquityCurvePoint[] = [];

  for (let i = 0; i < betPnls.length; i++) {
    const bp = betPnls[i];
    cumPnl += bp.pnl;
    if (cumPnl > peakPnl) peakPnl = cumPnl;
    const dd = peakPnl - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
    rawEquityCurve.push({
      index: i + 1,
      date: bp.date,
      cumPnl: Math.round(cumPnl * 100) / 100,
      drawdown: Math.round(dd * 100) / 100,
    });
  }

  // Downsample equity curve cleanly to max ~120 points if huge while preserving endpoints
  let equityCurve = rawEquityCurve;
  if (rawEquityCurve.length > 120) {
    const step = (rawEquityCurve.length - 1) / 119;
    const sampled: EquityCurvePoint[] = [];
    for (let i = 0; i < 120; i++) {
      sampled.push(rawEquityCurve[Math.round(i * step)]);
    }
    equityCurve = sampled;
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

  // Sort results newest-first and cap at 200 rows for payload crispness
  const recentMatches = [...results]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 200);

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
    leagueBreakdown,
    equityCurve,
    matches: recentMatches,
  };
}
