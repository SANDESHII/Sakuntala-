/**
 * Verification Suite for CLV (Closing Line Value) Fix
 * Tests 1-5: Formula, Signs, No Fake Zeros, Anti-Copy Guard, Regression.
 */

// Ensure live-capable check passes in offline test environment using mocked fetch
process.env.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '0'.repeat(32);
process.env.ODDS_API_KEY = process.env.ODDS_API_KEY || 'test_odds_api_key_for_mock_tests';

import * as Constants from '../src/core/constants';
import * as FreeDataService from '../src/services/freeDataService';
import { runBacktest } from '../src/core/engine';
import type { HistoricalMatch } from '../src/types';

type MockFixtureSpec = {
  id: number;
  kickoff: string;
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  homeOddsName: string;
  awayOddsName: string;
  takenOver25?: number;
  takenUnder25?: number;
  closingOver25?: number | null;
  closingUnder25?: number | null;
};

let activeFixtures: MockFixtureSpec[] = [];
const requestedOddsDates: string[] = [];

function buildOddsMatch(spec: MockFixtureSpec, over25: number, under25: number) {
  return {
    id: `odds-${spec.id}`,
    sport_key: 'soccer_epl',
    commence_time: spec.kickoff,
    home_team: spec.homeOddsName,
    away_team: spec.awayOddsName,
    bookmakers: [
      {
        key: 'pinnacle',
        title: 'Pinnacle',
        markets: [
          {
            key: 'totals',
            outcomes: [
              { name: 'Over', point: 2.5, price: over25 },
              { name: 'Under', point: 2.5, price: under25 },
            ],
          },
        ],
      },
    ],
  };
}

// Install global fetch mock before calling any service functions
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(urlStr);

  // API-Football health check
  if (url.pathname.endsWith('/status')) {
    return new Response(JSON.stringify({ response: { account: { name: 'mock' } }, errors: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The Odds API health check
  if (url.pathname === '/v4/sports/' || url.pathname === '/v4/sports') {
    return new Response(JSON.stringify([{ key: 'soccer_epl', active: true }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // API-Football fixtures
  if (url.pathname.endsWith('/fixtures')) {
    const leagueParam = Number(url.searchParams.get('league'));
    const response =
      leagueParam === 39
        ? activeFixtures.map((f) => ({
            fixture: { id: f.id, date: f.kickoff },
            teams: {
              home: { id: f.homeId, logo: null },
              away: { id: f.awayId, logo: null },
            },
            goals: { home: f.homeGoals, away: f.awayGoals },
          }))
        : [];
    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The Odds API historical odds
  if (url.pathname.includes('/v4/historical/sports/')) {
    const dateParam = url.searchParams.get('date') || '';
    requestedOddsDates.push(dateParam);

    const matched: any[] = [];
    for (const spec of activeFixtures) {
      const kickoffMs = new Date(spec.kickoff).getTime();
      const decisionIso = new Date(kickoffMs - 24 * 60 * 60 * 1000).toISOString();
      const closeIso = new Date(kickoffMs - 5 * 60 * 1000).toISOString();
      const dateOnly = spec.kickoff.split('T')[0];

      if (dateParam === decisionIso && spec.takenOver25 && spec.takenUnder25) {
        matched.push(buildOddsMatch(spec, spec.takenOver25, spec.takenUnder25));
      } else if (dateParam === closeIso && spec.closingOver25 && spec.closingUnder25) {
        matched.push(buildOddsMatch(spec, spec.closingOver25, spec.closingUnder25));
      } else if (dateParam === dateOnly && spec.takenOver25 && spec.takenUnder25) {
        // Only matches old buggy date-only queries
        matched.push(buildOddsMatch(spec, spec.takenOver25, spec.takenUnder25));
      }
    }

    return new Response(JSON.stringify({ timestamp: dateParam, data: matched }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: `Unexpected URL in mock: ${urlStr}` }), { status: 404 });
}) as typeof fetch;

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(msg);
  }
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

async function main() {
  // TEST 1 — FORMULA
  await runTest('TEST 1 (FORMULA)', async () => {
    const kickoff = '2025-01-10T15:00:00.000Z';
    const expectedDecisionTs = '2025-01-09T15:00:00.000Z';
    const expectedCloseTs = '2025-01-10T14:55:00.000Z';

    activeFixtures = [
      {
        id: 1001,
        kickoff,
        homeId: 42, // ARSENAL
        awayId: 49, // CHELSEA
        homeGoals: 2,
        awayGoals: 1,
        homeOddsName: 'Arsenal',
        awayOddsName: 'Chelsea',
        takenOver25: 2.10,
        takenUnder25: 1.80,
        closingOver25: 2.00,
        closingUnder25: 1.90,
      },
    ];
    requestedOddsDates.length = 0;

    const fixtures = await FreeDataService.getHistoricalFixtures('EPL', 10, true);
    assert(fixtures.length === 1, `Expected 1 fixture, got ${fixtures.length}`);
    const f = fixtures[0];
    assert(f.takenAt === expectedDecisionTs, `Expected takenAt=${expectedDecisionTs}, got ${f.takenAt}`);
    assert(f.closedAt === expectedCloseTs, `Expected closedAt=${expectedCloseTs}, got ${f.closedAt}`);
    assert(f.takenPrices?.over25 === 2.10, `Expected takenPrices.over25=2.10, got ${f.takenPrices?.over25}`);
    assert(f.closingPrices?.over25 === 2.00, `Expected closingPrices.over25=2.00, got ${f.closingPrices?.over25}`);
    assert(
      requestedOddsDates.includes(expectedDecisionTs) && requestedOddsDates.includes(expectedCloseTs),
      `Expected both ISO timestamps fetched; got ${JSON.stringify(requestedOddsDates)}`
    );

    const summary = await runBacktest();
    assert(summary.matches.length === 1, `Expected 1 backtest match, got ${summary.matches.length}`);
    const m = summary.matches[0];
    assert(m.prediction.predictionType === 'OVER_25', `Expected OVER_25 pick, got ${m.prediction.predictionType}`);
    assert(m.takenOdds === 2.10, `Expected takenOdds=2.10, got ${m.takenOdds}`);
    assert(m.closingOdds === 2.00, `Expected closingOdds=2.00, got ${m.closingOdds}`);
    assert(m.clv !== null && Math.abs(m.clv - 5.0) <= 0.001, `Expected clv=+5.0 (±0.001), got ${m.clv}`);
    assert(Math.abs(summary.avgClv - 5.0) <= 0.001, `Expected avgClv=5.0, got ${summary.avgClv}`);
    console.log(`  -> takenAt=${f.takenAt}, closedAt=${f.closedAt}, clv=${m.clv?.toFixed(4)}%, avgClvNoVig=${(summary as any).avgClvNoVig?.toFixed?.(4)}%`);
  });

  // TEST 2 — SIGNS
  await runTest('TEST 2 (SIGNS)', async () => {
    activeFixtures = [
      {
        id: 2001,
        kickoff: '2025-02-10T15:00:00.000Z',
        homeId: 42, // ARSENAL
        awayId: 49, // CHELSEA
        homeGoals: 3,
        awayGoals: 1,
        homeOddsName: 'Arsenal',
        awayOddsName: 'Chelsea',
        takenOver25: 2.10,
        takenUnder25: 1.80,
        closingOver25: 1.90, // +10.5263%
        closingUnder25: 2.00,
      },
      {
        id: 2002,
        kickoff: '2025-02-11T15:00:00.000Z',
        homeId: 40, // LIVERPOOL
        awayId: 50, // MAN_CITY
        homeGoals: 1,
        awayGoals: 1,
        homeOddsName: 'Liverpool',
        awayOddsName: 'Manchester City',
        takenOver25: 2.10,
        takenUnder25: 1.80,
        closingOver25: 2.20, // -4.5455%
        closingUnder25: 1.72,
      },
    ];

    const summary = await runBacktest();
    assert(summary.matches.length === 2, `Expected 2 matches, got ${summary.matches.length}`);
    const pos = summary.matches.find((m) => m.match.homeTeam === 'ARSENAL');
    const neg = summary.matches.find((m) => m.match.homeTeam === 'LIVERPOOL');
    assert(!!pos && pos.clv !== null && Math.abs(pos.clv - 10.5263) < 0.01, `Expected positive CLV ~10.53%, got ${pos?.clv}`);
    assert(!!neg && neg.clv !== null && Math.abs(neg.clv - (-4.5455)) < 0.01, `Expected negative CLV ~-4.55%, got ${neg?.clv}`);
    console.log(`  -> positive=${pos!.clv!.toFixed(2)}%, negative=${neg!.clv!.toFixed(2)}%`);
  });

  // TEST 3 — NO FAKE ZEROS
  await runTest('TEST 3 (NO FAKE ZEROS)', async () => {
    activeFixtures = [
      {
        id: 3001,
        kickoff: '2025-03-10T15:00:00.000Z',
        homeId: 42, // ARSENAL
        awayId: 49, // CHELSEA
        homeGoals: 2,
        awayGoals: 1,
        homeOddsName: 'Arsenal',
        awayOddsName: 'Chelsea',
        takenOver25: 2.10,
        takenUnder25: 1.80,
        closingOver25: 2.00, // +5.0%
        closingUnder25: 1.90,
      },
      {
        id: 3002,
        kickoff: '2025-03-11T15:00:00.000Z',
        homeId: 40, // LIVERPOOL
        awayId: 50, // MAN_CITY
        homeGoals: 2,
        awayGoals: 0,
        homeOddsName: 'Liverpool',
        awayOddsName: 'Manchester City',
        takenOver25: 2.10,
        takenUnder25: 1.80,
        closingOver25: null, // NO closing snapshot
        closingUnder25: null,
      },
    ];

    const fixtures = await FreeDataService.getHistoricalFixtures('EPL', 10, true);
    const noCloseFixture = fixtures.find((f) => f.home === 'LIVERPOOL');
    assert(noCloseFixture?.closingPrices === null, `Expected closingPrices === null when close missing, got ${JSON.stringify(noCloseFixture?.closingPrices)}`);

    const summary = await runBacktest();
    const noCloseMatch = summary.matches.find((m) => m.match.homeTeam === 'LIVERPOOL');
    assert(noCloseMatch?.clv === null, `Expected clv === null when close missing, got ${noCloseMatch?.clv}`);
    const cov = (summary as any).clvCoverage;
    assert(typeof cov === 'number' && Math.abs(cov - 50) < 0.001, `Expected clvCoverage === 50, got ${cov}`);
    assert(Math.abs(summary.avgClv - 5.0) < 0.001, `Expected avgClv === 5.0 (only real close), got ${summary.avgClv}`);
    console.log(`  -> noClose.clv=${noCloseMatch?.clv}, clvCoverage=${cov}%, avgClv=${summary.avgClv.toFixed(2)}%`);
  });

  // TEST 4 — ANTI-COPY GUARD
  await runTest('TEST 4 (ANTI-COPY GUARD)', async () => {
    const decisionLead = (Constants as Record<string, unknown>).DECISION_LEAD_MS;
    const closeLead = (Constants as Record<string, unknown>).CLOSE_LEAD_MS;
    assert(decisionLead === 24 * 60 * 60 * 1000, `Expected DECISION_LEAD_MS = 24h, got ${decisionLead}`);
    assert(closeLead === 5 * 60 * 1000, `Expected CLOSE_LEAD_MS = 5min, got ${closeLead}`);

    const sentinel = (FreeDataService as Record<string, unknown>).assertDistinctSnapshots as
      | ((...args: unknown[]) => void)
      | undefined;
    assert(typeof sentinel === 'function', 'assertDistinctSnapshots sentinel is not exported from freeDataService');

    const taken: NonNullable<HistoricalMatch['takenPrices']> = {
      over25: 2.10,
      under25: 1.80,
      over25NoVig: 2.16,
      under25NoVig: 1.85,
    };
    const copied: NonNullable<HistoricalMatch['closingPrices']> = { ...taken };
    const sharedTs = '2025-04-01T15:00:00.000Z';

    let threwSameTs = false;
    try {
      sentinel!(taken, copied, sharedTs, sharedTs);
    } catch {
      threwSameTs = true;
    }
    assert(threwSameTs, 'Sentinel failed to throw when takenAt === closedAt with copied prices');

    let threwSameObj = false;
    try {
      const snapObj = { id: 'same-snapshot' };
      sentinel!(taken, copied, '2025-03-31T15:00:00.000Z', '2025-04-01T14:55:00.000Z', snapObj, snapObj);
    } catch {
      threwSameObj = true;
    }
    assert(threwSameObj, 'Sentinel failed to throw when takenSnapshot === closeSnapshot');
    console.log('  -> sentinel threw on same-timestamp and same-snapshot-object copies');
  });

  // TEST 5 — REGRESSION
  await runTest('TEST 5 (REGRESSION)', async () => {
    const summary = await runBacktest();
    assert(typeof summary.totalMatches === 'number', 'Missing totalMatches');
    assert(typeof summary.totalPnl === 'number' && Number.isFinite(summary.totalPnl), 'Invalid totalPnl');
    assert(typeof summary.totalYield === 'number' && Number.isFinite(summary.totalYield), 'Invalid totalYield');
    assert(typeof summary.brierScore === 'number' && Number.isFinite(summary.brierScore), 'Invalid brierScore');
    assert(typeof summary.avgClv === 'number' && Number.isFinite(summary.avgClv), 'Invalid avgClv');
    assert(typeof (summary as any).avgClvNoVig === 'number' && Number.isFinite((summary as any).avgClvNoVig), 'Missing avgClvNoVig');
    assert(typeof (summary as any).clvCoverage === 'number' && Number.isFinite((summary as any).clvCoverage), 'Missing clvCoverage');
    assert(Array.isArray(summary.edgeSegments) && summary.edgeSegments.length === 4, 'Invalid edgeSegments');
    console.log(
      `  -> totalMatches=${summary.totalMatches}, totalPnl=${summary.totalPnl}, yield=${summary.totalYield.toFixed(2)}%, brier=${summary.brierScore.toFixed(4)}, avgClv=${summary.avgClv.toFixed(2)}%`
    );
  });

  console.log(`Total failures: ${failures}`);
  globalThis.fetch = originalFetch;
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
