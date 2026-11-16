import fs from 'node:fs';
import path from 'node:path';
import { fitFromAPI, predictGoals } from '../src/core/calibration';
import { DixonColes } from '../src/core/math';
import { runPrediction } from '../src/core/engine';
import { BASE_GOALS, DEFAULT_RHO, MODEL_CONFIG } from '../src/core/constants';
import { HistoricalMatch } from '../src/types';

// Deterministic PRNG (Mulberry32)
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

async function runTests() {
  let failures = 0;
  const rng = createRng(42);
  const asOfDate = '2026-10-31T12:00:01.000Z';
  const matchDate = '2026-10-31T12:00:00.000Z';

  // =========================================================================
  // TEST 1 — THE INVARIANT
  // =========================================================================
  console.log('=== TEST 1: THE INVARIANT ===');
  const smallTeams = ['TEAM_A', 'TEAM_B', 'TEAM_C', 'TEAM_D'];
  const smallMatches: HistoricalMatch[] = [];
  // 24 matches (double round-robin x2 so >= 20 matches for fitFromAPI)
  for (let rep = 0; rep < 2; rep++) {
    for (const h of smallTeams) {
      for (const a of smallTeams) {
        if (h === a) continue;
        smallMatches.push({
          home: h,
          away: a,
          homeGoals: samplePoisson(1.25 * BASE_GOALS, rng),
          awayGoals: samplePoisson(BASE_GOALS, rng),
          date: matchDate,
          league: 'TEST',
        });
      }
    }
  }

  const smallFitted = await fitFromAPI('TEST_SMALL', asOfDate, smallMatches);
  const pairH = 'TEAM_A';
  const pairA = 'TEAM_B';
  const pred1 = predictGoals(smallFitted, pairH, pairA);

  // Verify the training loop expression in src/core/calibration.ts matches predictGoals
  const calSrc = fs.readFileSync(path.resolve('src/core/calibration.ts'), 'utf8');
  const hasHomeBaseGoals = /const\s+homeExp\s*=\s*Math\.max\(atk\[home\]\s*\*\s*def\[away\]\s*\*\s*gamma\s*\*\s*BASE_GOALS/.test(calSrc);
  const hasAwayBaseGoals = /const\s+awayExp\s*=\s*Math\.max\(atk\[away\]\s*\*\s*def\[home\]\s*\*\s*BASE_GOALS/.test(calSrc);

  if (!pred1) {
    console.error('FAIL TEST 1: predictGoals returned null');
    failures++;
  } else {
    const expectedLambdaHome =
      smallFitted.teams[pairH].attack *
      smallFitted.teams[pairA].defense *
      smallFitted.homeAdvantage *
      BASE_GOALS;
    const expectedMuAway =
      smallFitted.teams[pairA].attack *
      smallFitted.teams[pairH].defense *
      BASE_GOALS;
    const trainHomeExp = Math.max(
      smallFitted.teams[pairH].attack *
        smallFitted.teams[pairA].defense *
        smallFitted.homeAdvantage *
        (hasHomeBaseGoals ? BASE_GOALS : 1),
      MODEL_CONFIG.PROBABILITY_FLOOR
    );
    const trainAwayExp = Math.max(
      smallFitted.teams[pairA].attack *
        smallFitted.teams[pairH].defense *
        (hasAwayBaseGoals ? BASE_GOALS : 1),
      MODEL_CONFIG.PROBABILITY_FLOOR
    );

    const diffHome = Math.abs(pred1.lambdaHome - expectedLambdaHome);
    const diffAway = Math.abs(pred1.muAway - expectedMuAway);
    const diffTrainHome = Math.abs(pred1.lambdaHome - trainHomeExp);
    const diffTrainAway = Math.abs(pred1.muAway - trainAwayExp);

    console.log(
      `Pair ${pairH} vs ${pairA}: pred=(${pred1.lambdaHome.toFixed(6)}, ${pred1.muAway.toFixed(6)}), trainExp=(${trainHomeExp.toFixed(6)}, ${trainAwayExp.toFixed(6)}), diffTrain=(${diffTrainHome.toExponential(2)}, ${diffTrainAway.toExponential(2)})`
    );
    if (diffHome > 1e-9 || diffAway > 1e-9 || diffTrainHome > 1e-9 || diffTrainAway > 1e-9) {
      console.error('FAIL TEST 1: Training expression vs predictGoals mismatch exceeds 1e-9');
      failures++;
    } else {
      console.log('PASS TEST 1');
    }
  }

  // =========================================================================
  // TEST 2 — SYNTHETIC RECOVERY (20 teams, 380 matches)
  // =========================================================================
  console.log('\n=== TEST 2: SYNTHETIC RECOVERY (20 teams, 380 matches) ===');
  const numTeams = 20;
  const teams = Array.from({ length: numTeams }, (_, i) => `SYNTH_${i + 1}`);
  const rawAtk = teams.map((_, i) => 0.75 + (0.5 * i) / (numTeams - 1));
  const rawDef = teams.map((_, i) => 1.25 - (0.5 * i) / (numTeams - 1));
  const meanAtk = rawAtk.reduce((s, v) => s + v, 0) / numTeams;
  const meanDef = rawDef.reduce((s, v) => s + v, 0) / numTeams;
  const trueAtk = rawAtk.map((v) => v / meanAtk);
  const trueDef = rawDef.map((v) => v / meanDef);
  const gammaTrue = 1.25;

  const synthMatches: HistoricalMatch[] = [];
  let trueHomeSum = 0;
  let trueAwaySum = 0;
  let actualHomeGoalsSum = 0;
  let actualAwayGoalsSum = 0;

  for (let i = 0; i < numTeams; i++) {
    for (let j = 0; j < numTeams; j++) {
      if (i === j) continue;
      const trueHome = trueAtk[i] * trueDef[j] * gammaTrue * BASE_GOALS;
      const trueAway = trueAtk[j] * trueDef[i] * BASE_GOALS;
      const hg = samplePoisson(trueHome, rng);
      const ag = samplePoisson(trueAway, rng);
      trueHomeSum += trueHome;
      trueAwaySum += trueAway;
      actualHomeGoalsSum += hg;
      actualAwayGoalsSum += ag;
      synthMatches.push({
        home: teams[i],
        away: teams[j],
        homeGoals: hg,
        awayGoals: ag,
        date: matchDate,
        league: 'SYNTH',
      });
    }
  }

  const synthFitted = await fitFromAPI('SYNTH_LEAGUE', asOfDate, synthMatches);
  let predHomeSum = 0;
  let predAwaySum = 0;
  let predCount = 0;
  for (let i = 0; i < numTeams; i++) {
    for (let j = 0; j < numTeams; j++) {
      if (i === j) continue;
      const p = predictGoals(synthFitted, teams[i], teams[j]);
      if (p) {
        predHomeSum += p.lambdaHome;
        predAwaySum += p.muAway;
        predCount++;
      }
    }
  }

  const trueHomeAvg = trueHomeSum / synthMatches.length;
  const trueAwayAvg = trueAwaySum / synthMatches.length;
  const actualHomeAvg = actualHomeGoalsSum / synthMatches.length;
  const actualAwayAvg = actualAwayGoalsSum / synthMatches.length;
  const predHomeAvg = predHomeSum / predCount;
  const predAwayAvg = predAwaySum / predCount;
  const homeRatio = predHomeAvg / trueHomeAvg;
  const awayRatio = predAwayAvg / trueAwayAvg;

  console.log(
    `True avg: (${trueHomeAvg.toFixed(4)}, ${trueAwayAvg.toFixed(4)}) | Sampled avg: (${actualHomeAvg.toFixed(4)}, ${actualAwayAvg.toFixed(4)})`
  );
  console.log(
    `Pred avg: (${predHomeAvg.toFixed(4)}, ${predAwayAvg.toFixed(4)}) | Ratio pred/true: home=${homeRatio.toFixed(4)}, away=${awayRatio.toFixed(4)}`
  );
  if (Math.abs(homeRatio - 1.0) > 0.1 || Math.abs(awayRatio - 1.0) > 0.1) {
    console.error('FAIL TEST 2: Predicted average deviates >10% from true average');
    failures++;
  } else {
    console.log('PASS TEST 2');
  }

  // =========================================================================
  // TEST 3 — PROBABILITY SANITY
  // =========================================================================
  console.log('\n=== TEST 3: PROBABILITY SANITY ===');
  // Fitted league-average dataset (20 teams, 380 matches, all true atk=1.0, def=1.0, gamma=1.25)
  const avgTeams = Array.from({ length: 20 }, (_, i) => `AVG_${i + 1}`);
  const avgMatches: HistoricalMatch[] = [];
  for (let i = 0; i < avgTeams.length; i++) {
    for (let j = 0; j < avgTeams.length; j++) {
      if (i === j) continue;
      avgMatches.push({
        home: avgTeams[i],
        away: avgTeams[j],
        homeGoals: samplePoisson(1.0 * 1.0 * 1.25 * BASE_GOALS, rng),
        awayGoals: samplePoisson(1.0 * 1.0 * BASE_GOALS, rng),
        date: matchDate,
        league: 'AVG',
      });
    }
  }
  const avgFitted = await fitFromAPI('AVG_LEAGUE', asOfDate, avgMatches);
  let over25Sum = 0;
  let pairCount = 0;
  for (let i = 0; i < avgTeams.length; i++) {
    for (let j = 0; j < avgTeams.length; j++) {
      if (i === j) continue;
      const p = predictGoals(avgFitted, avgTeams[i], avgTeams[j]);
      if (p) {
        const m = DixonColes.calculateScoreMatrix(p.lambdaHome, p.muAway, avgFitted.rho);
        over25Sum += DixonColes.calculateOverUnder(m, 2.5);
        pairCount++;
      }
    }
  }
  const meanFittedOver25 = over25Sum / pairCount;

  const unitPred = predictGoals(
    {
      homeAdvantage: 1.25,
      rho: DEFAULT_RHO,
      teams: {
        AVG_HOME: { attack: 1.0, defense: 1.0, matchCount: 20, lowConfidence: false },
        AVG_AWAY: { attack: 1.0, defense: 1.0, matchCount: 20, lowConfidence: false },
      },
    },
    'AVG_HOME',
    'AVG_AWAY'
  )!;
  const unitMatrix = DixonColes.calculateScoreMatrix(unitPred.lambdaHome, unitPred.muAway, DEFAULT_RHO);
  const unitOver25 = DixonColes.calculateOverUnder(unitMatrix, 2.5);

  console.log(
    `Fitted 20-team league-avg mean P(Over2.5)=${meanFittedOver25.toFixed(4)} | Exact unit fixture xG=(${unitPred.lambdaHome.toFixed(4)}, ${unitPred.muAway.toFixed(4)}) P(Over2.5)=${unitOver25.toFixed(4)}`
  );
  if (meanFittedOver25 < 0.5 || meanFittedOver25 > 0.68 || unitOver25 < 0.5 || unitOver25 > 0.68) {
    console.error('FAIL TEST 3: P(Over2.5) outside [0.50, 0.68]');
    failures++;
  } else {
    console.log('PASS TEST 3');
  }

  // =========================================================================
  // TEST 4 — REGRESSION ON THE REAL FALLBACK
  // =========================================================================
  console.log('\n=== TEST 4: REGRESSION ON REAL FALLBACK ===');
  const origFootballKey = process.env.API_FOOTBALL_KEY;
  const origOddsKey = process.env.ODDS_API_KEY;
  delete process.env.API_FOOTBALL_KEY;
  delete process.env.ODDS_API_KEY;
  const fallbackRes = await runPrediction('ARSENAL', 'CHELSEA', 'EPL');
  if (origFootballKey) process.env.API_FOOTBALL_KEY = origFootballKey;
  if (origOddsKey) process.env.ODDS_API_KEY = origOddsKey;

  console.log(
    `ARSENAL vs CHELSEA (EPL fallback): homeExpectedGoals=${fallbackRes.homeExpectedGoals.toFixed(4)}, awayExpectedGoals=${fallbackRes.awayExpectedGoals.toFixed(4)}, modelSource=${fallbackRes.modelSource}`
  );
  if (
    fallbackRes.homeExpectedGoals < 1.6 ||
    fallbackRes.homeExpectedGoals > 2.2 ||
    fallbackRes.awayExpectedGoals < 0.9 ||
    fallbackRes.awayExpectedGoals > 1.4
  ) {
    console.error('FAIL TEST 4: Fallback xG outside expected bounds');
    failures++;
  } else {
    console.log('PASS TEST 4');
  }

  console.log(`\nTotal failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
