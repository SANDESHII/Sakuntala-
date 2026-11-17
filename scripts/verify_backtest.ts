/**
 * Verification Suite for Football-Data.co.uk Backtest Rebuild (T1-T7)
 */

import * as Constants from '../src/core/constants';
import * as Calibration from '../src/core/calibration';
import { runBacktest } from '../src/core/engine';
import type { HistoricalMatch } from '../src/types';

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err: unknown) {
    failures++;
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function getCsvModule(): Promise<{
  parseFootballDataCsv: (csv: string, league: string, season: string) => (HistoricalMatch & { season?: string })[];
  clearCsvCache: () => void;
}> {
  const mod = await import('../src/services/footballDataCsv');
  return mod as any;
}

async function main() {
  // T1 — NO-LOOKAHEAD
  await runTest('T1 NO-LOOKAHEAD', async () => {
    const csvMod = await getCsvModule();
    csvMod.clearCsvCache();

    // Build 26 matches across 4 teams on distinct dates in 2324 and 2425
    const teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City'];
    const baseLines: string[] = ['Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,Max>2.5,Max<2.5,MaxC>2.5,MaxC<2.5'];
    let dayOffset = 0;
    for (let rep = 0; rep < 3; rep++) {
      for (const h of teams) {
        for (const a of teams) {
          if (h === a) continue;
          const dt = new Date(Date.UTC(2023, 8, 1 + dayOffset));
          const dd = String(dt.getUTCDate()).padStart(2, '0');
          const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const yyyy = dt.getUTCFullYear();
          baseLines.push(`E0,${dd}/${mm}/${yyyy},15:00,${h},${a},2,1,2.10,1.80,2.00,1.90`);
          dayOffset += 3;
        }
      }
    }
    // Target eval match M (index 0 of 2425) + future match F strictly after M
    const csv2324 = baseLines.join('\n');
    const csv2425Original = [
      'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,Max>2.5,Max<2.5,MaxC>2.5,MaxC<2.5',
      'E0,17/08/2024,15:00,Arsenal,Chelsea,2,1,2.10,1.80,2.00,1.90',
      'E0,24/08/2024,15:00,Arsenal,Liverpool,1,0,2.05,1.85,1.95,1.95',
    ].join('\n');
    const csv2425Mutated = [
      'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,Max>2.5,Max<2.5,MaxC>2.5,MaxC<2.5',
      'E0,17/08/2024,15:00,Arsenal,Chelsea,2,1,2.10,1.80,2.00,1.90',
      'E0,24/08/2024,15:00,Arsenal,Liverpool,9,8,2.05,1.85,1.95,1.95',
    ].join('\n');

    const origMatches = [
      ...csvMod.parseFootballDataCsv(csv2324, 'EPL', '2324'),
      ...csvMod.parseFootballDataCsv(csv2425Original, 'EPL', '2425'),
    ];
    const mutatedMatches = [
      ...csvMod.parseFootballDataCsv(csv2324, 'EPL', '2324'),
      ...csvMod.parseFootballDataCsv(csv2425Mutated, 'EPL', '2425'),
    ];

    const resA = await (runBacktest as any)({
      leagues: ['EPL'],
      trainSeasons: ['2324'],
      evalSeasons: ['2425'],
      preloadedMatches: { EPL: origMatches },
    });
    const resB = await (runBacktest as any)({
      leagues: ['EPL'],
      trainSeasons: ['2324'],
      evalSeasons: ['2425'],
      preloadedMatches: { EPL: mutatedMatches },
    });

    assert(resA.matches.length === 2 && resB.matches.length === 2, `Expected 2 eval matches, got ${resA.matches.length}`);
    const mA = resA.matches[0];
    const mB = resB.matches[0];
    assert(
      mA.prediction.rawProbability === mB.prediction.rawProbability &&
        mA.prediction.predictionType === mB.prediction.predictionType,
      `Lookahead leak: rawProb changed from ${mA.prediction.rawProbability} to ${mB.prediction.rawProbability}`
    );
    console.log(`  -> Match M rawProb=${mA.prediction.rawProbability.toFixed(6)} identical after mutating future match`);
  });

  // T2 & T3 — SCALE + ZERO API CALLS (default config against live football-data.co.uk)
  let defaultSummary: any = null;
  await runTest('T3 ZERO API CALLS', async () => {
    const origFootballKey = process.env.API_FOOTBALL_KEY;
    const origOddsKey = process.env.ODDS_API_KEY;
    delete process.env.API_FOOTBALL_KEY;
    delete process.env.ODDS_API_KEY;

    const fetchedUrls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchedUrls.push(url);
      return origFetch(input, init);
    }) as typeof fetch;

    try {
      defaultSummary = await runBacktest();
    } finally {
      globalThis.fetch = origFetch;
      if (origFootballKey) process.env.API_FOOTBALL_KEY = origFootballKey;
      if (origOddsKey) process.env.ODDS_API_KEY = origOddsKey;
    }

    assert(fetchedUrls.length > 0, 'Expected CSV fetches to football-data.co.uk, got 0 fetch calls');
    const forbidden = fetchedUrls.filter(
      (u) =>
        u.includes('api-football') ||
        u.includes('api-sports') ||
        u.includes('rapidapi') ||
        u.includes('the-odds-api')
    );
    assert(forbidden.length === 0, `Forbidden API calls detected: ${forbidden.join(', ')}`);
    const allCsv = fetchedUrls.every((u) => u.includes('football-data.co.uk'));
    assert(allCsv, `Unexpected non-CSV fetch URLs: ${fetchedUrls.filter((u) => !u.includes('football-data.co.uk')).join(', ')}`);
    console.log(`  -> ${fetchedUrls.length} fetches, 0 API-Football/Odds-API calls, works with no API keys`);
  });

  await runTest('T2 SCALE', async () => {
    assert(!!defaultSummary, 'Default backtest did not run');
    assert(defaultSummary.dataLineage?.source === 'football-data.co.uk', `Unexpected source: ${defaultSummary.dataLineage?.source}`);
    assert(
      defaultSummary.dataLineage?.matchesEvaluated >= 1000,
      `Expected matchesEvaluated >= 1000, got ${defaultSummary.dataLineage?.matchesEvaluated}`
    );
    assert(
      defaultSummary.dataLineage?.matchesDownloaded > defaultSummary.dataLineage?.matchesEvaluated,
      `Expected matchesDownloaded > matchesEvaluated`
    );
    assert(typeof defaultSummary.marketBrier === 'number' && defaultSummary.marketBrier > 0, `Invalid marketBrier: ${defaultSummary.marketBrier}`);
    assert(typeof defaultSummary.brierVsMarket === 'number', `Invalid brierVsMarket: ${defaultSummary.brierVsMarket}`);
    assert(!!defaultSummary.verdict && ['PROMISING', 'NO_EDGE', 'INCONCLUSIVE'].includes(defaultSummary.verdict.status), `Invalid verdict`);
    console.log(
      `  -> downloaded=${defaultSummary.dataLineage.matchesDownloaded}, evaluated=${defaultSummary.dataLineage.matchesEvaluated}, bets=${defaultSummary.totalMatches}, brier=${defaultSummary.brierScore.toFixed(4)}, marketBrier=${defaultSummary.marketBrier.toFixed(4)}, verdict=${defaultSummary.verdict.status}`
    );
  });

  // T4 — CSV ROBUSTNESS
  await runTest('T4 CSV ROBUSTNESS', async () => {
    const csvMod = await getCsvModule();
    const csv = [
      '\uFEFFDiv,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,Max>2.5,Max<2.5',
      'E0,15/02/2025,15:00,Arsenal,Chelsea,2,1,2.10,1.80',
      'E0,16/02/2025,15:00,Liverpool,Man City,,,2.00,1.90',
    ].join('\n');

    const rows = csvMod.parseFootballDataCsv(csv, 'EPL', '2425');
    assert(rows.length === 1, `Expected 1 valid row (missing FTHG skipped), got ${rows.length}`);
    assert(rows[0].closingPrices === null, `Expected closingPrices === null when closing cols missing, got ${JSON.stringify(rows[0].closingPrices)}`);
    assert(rows[0].date.startsWith('2025-02-15'), `Expected ISO date 2025-02-15..., got ${rows[0].date}`);
    assert(
      Math.abs((rows[0].takenPrices?.over25NoVig || 0) - (1 + 2.10 / 1.80)) < 1e-6,
      `Expected opposite-side noVig formula 1+2.10/1.80, got ${rows[0].takenPrices?.over25NoVig}`
    );

    const summary = await (runBacktest as any)({
      leagues: ['EPL'],
      trainSeasons: [],
      evalSeasons: ['2425'],
      preloadedMatches: { EPL: rows },
    });
    assert(summary.matches.length === 1 && summary.matches[0].clv === null, `Expected clv === null for missing close, got ${summary.matches[0]?.clv}`);
    console.log(`  -> missing FTHG skipped, missing closing cols => closingPrices=null & clv=null, DD/MM/YYYY => ${rows[0].date}`);
  });

  // T5 — CLV FROM CSV
  await runTest('T5 CLV FROM CSV', async () => {
    const csvMod = await getCsvModule();
    const csv = [
      'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,Max>2.5,Max<2.5,MaxC>2.5,MaxC<2.5',
      'E0,15/02/2025,15:00,Arsenal,Chelsea,3,1,2.10,1.80,2.00,1.90',
    ].join('\n');
    const rows = csvMod.parseFootballDataCsv(csv, 'EPL', '2425');
    const summary = await (runBacktest as any)({
      leagues: ['EPL'],
      trainSeasons: [],
      evalSeasons: ['2425'],
      preloadedMatches: { EPL: rows },
    });
    assert(summary.matches.length === 1, `Expected 1 match, got ${summary.matches.length}`);
    const m = summary.matches[0];
    assert(m.prediction.predictionType === 'OVER_25', `Expected OVER_25 pick, got ${m.prediction.predictionType}`);
    assert(m.clv !== null && Math.abs(m.clv - 5.0) <= 0.001, `Expected clv=+5.0 (±0.001), got ${m.clv}`);
    console.log(`  -> CSV opening 2.10 vs closing 2.00 => engine CLV=${m.clv?.toFixed(4)}%`);
  });

  // T6 — TEAM-KEY NORMALIZATION
  await runTest('T6 TEAM-KEY', async () => {
    const trainMatches: HistoricalMatch[] = [];
    const pairs: [string, string][] = [
      ['Man United', 'Arsenal'],
      ['Arsenal', 'Man United'],
      ['Man United', 'Chelsea'],
      ['Chelsea', 'Man United'],
      ['Man United', 'Liverpool'],
      ['Liverpool', 'Man United'],
      ['Arsenal', 'Chelsea'],
      ['Chelsea', 'Arsenal'],
      ['Arsenal', 'Liverpool'],
      ['Liverpool', 'Arsenal'],
      ['Chelsea', 'Liverpool'],
      ['Liverpool', 'Chelsea'],
    ];
    let idx = 0;
    for (let rep = 0; rep < 2; rep++) {
      for (const [h, a] of pairs) {
        const dt = new Date(Date.UTC(2024, 0, 1 + idx++)).toISOString();
        trainMatches.push({ home: h, away: a, homeGoals: 2, awayGoals: 1, date: dt, league: 'EPL' });
      }
    }
    const fitted = await Calibration.fitFromAPI('EPL', '2024-12-01T00:00:00.000Z', trainMatches);
    const pred = Calibration.predictGoals(fitted, 'Man Utd', 'Arsenal');
    assert(pred !== null, `predictGoals returned null for 'Man Utd' when trained on 'Man United'`);

    const evalMatch: HistoricalMatch & { season?: string } = {
      home: 'Man Utd',
      away: 'Arsenal',
      homeGoals: 2,
      awayGoals: 1,
      date: '2024-12-01T15:00:00.000Z',
      league: 'EPL',
      season: '2425',
      takenPrices: { over25: 2.10, under25: 1.80, over25NoVig: 2.1667, under25NoVig: 1.8571 },
      closingPrices: { over25: 2.00, under25: 1.90, over25NoVig: 2.0526, under25NoVig: 1.95 },
      takenAt: '2024-11-30T15:00:00.000Z',
      closedAt: '2024-12-01T15:00:00.000Z',
    };
    const summary = await (runBacktest as any)({
      leagues: ['EPL'],
      trainSeasons: ['2324'],
      evalSeasons: ['2425'],
      preloadedMatches: { EPL: [...trainMatches.map((m) => ({ ...m, season: '2324' })), evalMatch] },
    });
    assert(summary.modelBreakdown?.mleFitted === 1 && summary.modelBreakdown?.heuristicFallback === 0, `Expected MLE_FITTED=1, got ${JSON.stringify(summary.modelBreakdown)}`);
    console.log(`  -> 'Man United' in train + 'Man Utd' in eval => MLE_FITTED`);
  });

  // T7 — REGRESSION SHAPE
  await runTest('T7 REGRESSION', async () => {
    const requiredKeys = [
      'totalMatches',
      'brierScore',
      'over25Accuracy',
      'under25Accuracy',
      'totalPnl',
      'totalYield',
      'avgClv',
      'clvCoverage',
      'avgClvNoVig',
      'edgeSegments',
      'matches',
      'marketBrier',
      'brierVsMarket',
      'clvStats',
      'roi95CI',
      'maxDrawdown',
      'modelBreakdown',
      'dataLineage',
      'verdict',
    ];
    assert(!!defaultSummary, 'Missing defaultSummary');
    for (const k of requiredKeys) {
      assert(k in defaultSummary, `Missing BacktestSummary field: ${k}`);
    }
    assert(Array.isArray(Constants.LEAGUE_CONFIGS ? defaultSummary.edgeSegments : []), 'Invalid edgeSegments');
    console.log(`  -> all ${requiredKeys.length} BacktestSummary fields present`);
  });

  if (defaultSummary) {
    const printable = {
      ...defaultSummary,
      matches: defaultSummary.matches.slice(0, 3),
    };
    console.log('\n=== REAL BACKTEST SUMMARY JSON ===');
    console.log(JSON.stringify(printable, null, 2));
  }

  console.log(`\nTotal failures: ${failures}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
