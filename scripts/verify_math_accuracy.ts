/**
 * Offline mathematical & algorithmic verification suite for Sakuntala Dixon-Coles O/U 2.5.
 * Verifies Poisson PMF, tau correction, score matrix, derived markets, predictGoals,
 * MLE analytic gradients vs finite differences, Bayesian posterior/edge/Kelly chain,
 * H1/H2/H3b guardrails, and backtest summary arithmetic.
 *
 * Run: npx tsx scripts/verify_math_accuracy.ts
 */
import { DixonColes } from '../src/core/math';
import { predictGoals, FittedLeagueParams } from '../src/core/calibration';
import { runPrediction, runBacktest } from '../src/core/engine';
import {
  TEAM_STATS,
  LEAGUE_CONFIGS,
  BASE_GOALS,
  HOME_ADVANTAGE_WEIGHT,
  TIME_DECAY_PHI,
  REG_LAMBDA,
  MODEL_CONFIG,
} from '../src/core/constants';
import { HistoricalMatch } from '../src/types';

let passes = 0;
let failures = 0;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passes++;
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

// Lanczos approximation for ln(Gamma(z))
function lgamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function refPoisson(k: number, lam: number): number {
  return Math.exp(k * Math.log(lam) - lam - lgamma(k + 1));
}

async function main() {
  // 1. Poisson PMF vs Lanczos-log-gamma reference
  const lambdas = [0.2, 1, 1.35, 2, 3.5, 4, 10];
  let maxPoisErr = 0;
  let maxSumErr = 0;
  for (const lam of lambdas) {
    let sum = 0;
    for (let k = 0; k <= 40; k++) {
      const got = DixonColes.poisson(k, lam);
      const ref = refPoisson(k, lam);
      maxPoisErr = Math.max(maxPoisErr, Math.abs(got - ref));
      sum += got;
    }
    maxSumErr = Math.max(maxSumErr, Math.abs(sum - 1));
  }
  const edgeOk =
    DixonColes.poisson(-1, 1.5) === 0 &&
    DixonColes.poisson(41, 1.5) === 0 &&
    DixonColes.poisson(1.5, 1.5) === 0 &&
    DixonColes.poisson(0, 0) === 1 &&
    DixonColes.poisson(1, 0) === 0 &&
    DixonColes.poisson(0, -1) === 1;
  check(maxPoisErr < 1e-12, '1a. Poisson PMF vs Lanczos log-gamma', `maxErr=${maxPoisErr.toExponential(2)}`);
  check(maxSumErr < 1e-11, '1b. Poisson PMF sums to 1 over k=0..40', `maxSumErr=${maxSumErr.toExponential(2)}`);
  check(edgeOk, '1c. Poisson edge cases (k<0, k>=41, non-int, lam<=0)');

  // 2. tau correction closed form & strict positivity across grid
  let maxTauErr = 0;
  let minTauVal = Infinity;
  for (const lam of [0.3, 0.8, 1.35, 2.5, 4.0]) {
    for (const mu of [0.2, 0.8, 1.35, 2.2, 3.5]) {
      for (const rho of [-0.5, -0.25, -0.13, -0.05, 0]) {
        const minRho = -1 / Math.max(lam, mu, 1);
        const maxRho = Math.min(1, 1 / (lam * mu || 1));
        const inBounds = rho >= minRho + 0.001 && rho <= maxRho - 0.001;
        for (const [h, a] of [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1]] as const) {
          const got = DixonColes.lowScoreCorrection(h, a, lam, mu, rho);
          minTauVal = Math.min(minTauVal, got);
          if (inBounds) {
            const ref =
              h === 0 && a === 0 ? 1 - lam * mu * rho
              : h === 0 && a === 1 ? 1 + lam * rho
              : h === 1 && a === 0 ? 1 + mu * rho
              : h === 1 && a === 1 ? 1 - rho
              : 1;
            maxTauErr = Math.max(maxTauErr, Math.abs(got - ref));
          }
        }
      }
    }
  }
  check(maxTauErr < 1e-14, '2a. tau matches closed form inside validity bounds', `maxErr=${maxTauErr.toExponential(2)}`);
  check(minTauVal > 0, '2b. tau strictly positive over full parameter grid', `minTau=${minTauVal.toExponential(2)}`);

  // 3. Score matrix vs brute-force K=50 DC reference
  const testLam = 1.68;
  const testMu = 1.24;
  const testRho = -0.14;
  const mat = DixonColes.calculateScoreMatrix(testLam, testMu, testRho);
  const K = 50;
  const refGrid: number[][] = Array.from({ length: K + 1 }, () => new Array(K + 1).fill(0));
  let refTotal = 0;
  for (let h = 0; h <= K; h++) {
    for (let a = 0; a <= K; a++) {
      const p = refPoisson(h, testLam) * refPoisson(a, testMu) * DixonColes.lowScoreCorrection(h, a, testLam, testMu, testRho);
      refGrid[h][a] = p;
      refTotal += p;
    }
  }
  let maxMatErr = 0;
  let matSum = 0;
  let minCell = Infinity;
  for (let h = 0; h < mat.length; h++) {
    for (let a = 0; a < mat[h].length; a++) {
      const got = mat[h][a];
      matSum += got;
      minCell = Math.min(minCell, got);
      const ref = refGrid[h][a] / refTotal;
      maxMatErr = Math.max(maxMatErr, Math.abs(got - ref));
    }
  }
  check(maxMatErr < 1e-7, '3a. Score matrix matches K=50 DC reference', `maxErr=${maxMatErr.toExponential(2)}`);
  check(Math.abs(matSum - 1) < 1e-12 && minCell >= 0, '3b. Score matrix sums to 1 & non-negative', `sumErr=${Math.abs(matSum - 1).toExponential(2)}`);

  // 4. Derived markets invariants
  const derived = DixonColes.calculateDerivedMarkets(mat);
  const ou25Fn = DixonColes.calculateOverUnder(mat, 2.5);
  let manualOver25 = 0;
  for (let h = 0; h < mat.length; h++) {
    for (let a = 0; a < mat[h].length; a++) {
      if (h + a >= 3) manualOver25 += mat[h][a];
    }
  }
  const marketsValid =
    Math.abs(derived.homeWin + derived.draw + derived.awayWin - 1) < 1e-12 &&
    Math.abs(derived.over15 + derived.under15 - 1) < 1e-12 &&
    Math.abs(derived.over25 + derived.under25 - 1) < 1e-12 &&
    Math.abs(derived.over35 + derived.under35 - 1) < 1e-12 &&
    Math.abs(derived.bttsYes + derived.bttsNo - 1) < 1e-12 &&
    derived.over15 >= derived.over25 &&
    derived.over25 >= derived.over35 &&
    Math.abs(ou25Fn - derived.over25) < 1e-12 &&
    Math.abs(manualOver25 - derived.over25) < 1e-12;
  check(marketsValid, '4. Derived markets identities, monotonicity & O/U 2.5 sum match');

  // 5. predictGoals() formula and clamping
  const mockFitted: FittedLeagueParams = {
    homeAdvantage: 1.28,
    rho: -0.11,
    leagueBase: 1.42,
    dataProvider: 'FOOTBALL_DATA_CSV',
    teams: {
      TEAM_A: { attack: 1.4, defense: 0.75, matchCount: 25, lowConfidence: false },
      TEAM_B: { attack: 0.9, defense: 1.25, matchCount: 25, lowConfidence: false },
      EXTREME_HI: { attack: 3.0, defense: 3.0, matchCount: 20, lowConfidence: false },
      EXTREME_LO: { attack: 0.1, defense: 0.1, matchCount: 20, lowConfidence: false },
    },
  };
  const pg = predictGoals(mockFitted, 'TEAM_A', 'TEAM_B')!;
  const expLam = 1.4 * 1.25 * 1.28 * 1.42;
  const expMu = 0.9 * 0.75 * 1.42;
  const pgHi = predictGoals(mockFitted, 'EXTREME_HI', 'EXTREME_HI')!;
  const pgLo = predictGoals(mockFitted, 'EXTREME_LO', 'EXTREME_LO')!;
  check(
    Math.abs(pg.lambdaHome - expLam) < 1e-12 &&
      Math.abs(pg.muAway - expMu) < 1e-12 &&
      pgHi.lambdaHome === MODEL_CONFIG.MAX_LAMBDA &&
      pgHi.muAway === MODEL_CONFIG.MAX_MU &&
      pgLo.lambdaHome === MODEL_CONFIG.MIN_LAMBDA &&
      pgLo.muAway === MODEL_CONFIG.MIN_MU,
    '5. predictGoals() exact λ/μ formula & boundary clamps'
  );

  // 6. Gradients vs central finite differences (1e-5 relative tolerance)
  const T = 3;
  const B = BASE_GOALS;
  const synthMatches = [
    { h: 0, a: 1, hg: 0, ag: 0, daysAgo: 5 },
    { h: 1, a: 2, hg: 0, ag: 1, daysAgo: 12 },
    { h: 2, a: 0, hg: 1, ag: 0, daysAgo: 20 },
    { h: 0, a: 2, hg: 1, ag: 1, daysAgo: 35 },
    { h: 1, a: 0, hg: 3, ag: 1, daysAgo: 45 },
  ];
  const atk = [1.18, 0.92, 0.95];
  const def = [0.88, 1.07, 1.05];
  let gamma = 1.24;
  let rho = -0.10;

  const objective = (aArr: number[], dArr: number[], g: number, r: number): number => {
    let ll = 0;
    for (const m of synthMatches) {
      const w = Math.exp(-TIME_DECAY_PHI * m.daysAgo);
      const l = aArr[m.h] * dArr[m.a] * g * B;
      const mu = aArr[m.a] * dArr[m.h] * B;
      const minRho = -1 / Math.max(l, mu, 1);
      const rSafe = Math.max(minRho + 0.001, r);
      const tau =
        m.hg === 0 && m.ag === 0 ? 1 - l * mu * rSafe
        : m.hg === 0 && m.ag === 1 ? 1 + l * rSafe
        : m.hg === 1 && m.ag === 0 ? 1 + mu * rSafe
        : m.hg === 1 && m.ag === 1 ? 1 - rSafe
        : 1;
      ll += w * (m.hg * Math.log(l) - l + m.ag * Math.log(mu) - mu + Math.log(tau));
    }
    const meanD = dArr.reduce((s, x) => s + x, 0) / T;
    let reg = 0;
    for (let t = 0; t < T; t++) {
      reg += REG_LAMBDA * (Math.pow(aArr[t] - 1, 2) + Math.pow(dArr[t] - meanD, 2));
    }
    return ll - reg;
  };

  const gA = new Array(T).fill(0);
  const gD = new Array(T).fill(0);
  let gG = 0;
  let gR = 0;
  const meanD = def.reduce((s, x) => s + x, 0) / T;
  for (const m of synthMatches) {
    const w = Math.exp(-TIME_DECAY_PHI * m.daysAgo);
    const l = atk[m.h] * def[m.a] * gamma * B;
    const mu = atk[m.a] * def[m.h] * B;
    const minRho = -1 / Math.max(l, mu, 1);
    const rSafe = Math.max(minRho + 0.001, rho);
    let dtH = 0;
    let dtA = 0;
    let dr = 0;
    if (m.hg === 0 && m.ag === 0) {
      const d = 1 - l * mu * rSafe;
      dtH = (-mu * rSafe) / d;
      dtA = (-l * rSafe) / d;
      dr = (-w * l * mu) / d;
    } else if (m.hg === 0 && m.ag === 1) {
      const tau = 1 + l * rSafe;
      dtH = rSafe / tau;
      dr = (w * l) / tau;
    } else if (m.hg === 1 && m.ag === 0) {
      const tau = 1 + mu * rSafe;
      dtA = rSafe / tau;
      dr = (w * mu) / tau;
    } else if (m.hg === 1 && m.ag === 1) {
      dr = -w / (1 - rSafe);
    }
    const gradH = w * (m.hg / l - 1 + dtH);
    const gradA = w * (m.ag / mu - 1 + dtA);
    gA[m.h] += gradH * def[m.a] * gamma * B;
    gD[m.a] += gradH * atk[m.h] * gamma * B;
    gA[m.a] += gradA * def[m.h] * B;
    gD[m.h] += gradA * atk[m.a] * B;
    gG += gradH * atk[m.h] * def[m.a] * B;
    gR += dr;
  }
  for (let t = 0; t < T; t++) {
    gA[t] -= 2 * REG_LAMBDA * (atk[t] - 1);
    gD[t] -= 2 * REG_LAMBDA * (def[t] - meanD);
  }

  const hStep = 1e-6;
  let maxRelGradErr = 0;
  for (let t = 0; t < T; t++) {
    const aP = [...atk]; aP[t] += hStep;
    const aM = [...atk]; aM[t] -= hStep;
    const fdA = (objective(aP, def, gamma, rho) - objective(aM, def, gamma, rho)) / (2 * hStep);
    maxRelGradErr = Math.max(maxRelGradErr, Math.abs(gA[t] - fdA) / Math.max(1, Math.abs(fdA)));

    const dP = [...def]; dP[t] += hStep;
    const dM = [...def]; dM[t] -= hStep;
    const fdD = (objective(atk, dP, gamma, rho) - objective(atk, dM, gamma, rho)) / (2 * hStep);
    maxRelGradErr = Math.max(maxRelGradErr, Math.abs(gD[t] - fdD) / Math.max(1, Math.abs(fdD)));
  }
  const fdG = (objective(atk, def, gamma + hStep, rho) - objective(atk, def, gamma - hStep, rho)) / (2 * hStep);
  const fdR = (objective(atk, def, gamma, rho + hStep) - objective(atk, def, gamma, rho - hStep)) / (2 * hStep);
  maxRelGradErr = Math.max(
    maxRelGradErr,
    Math.abs(gG - fdG) / Math.max(1, Math.abs(fdG)),
    Math.abs(gR - fdR) / Math.max(1, Math.abs(fdR))
  );
  check(maxRelGradErr < 1e-5, '6. MLE analytic gradients vs central finite differences', `maxRelErr=${maxRelGradErr.toExponential(2)}`);

  // 7. Edge / posterior / Kelly chain on runPrediction() with over=2.10, under=1.85
  const strongOverFitted: FittedLeagueParams = {
    homeAdvantage: 1.30,
    rho: -0.12,
    leagueBase: BASE_GOALS * LEAGUE_CONFIGS.EPL.goalRate,
    dataProvider: 'FOOTBALL_DATA_CSV',
    teams: {
      ARSENAL: { attack: 1.65, defense: 1.25, matchCount: 30, lowConfidence: false },
      CHELSEA: { attack: 1.45, defense: 1.35, matchCount: 30, lowConfidence: false },
    },
  };
  const predBet = await runPrediction(
    'ARSENAL',
    'CHELSEA',
    'EPL',
    { over25: { bestPrice: 2.10 }, under25: { bestPrice: 1.85 } },
    '2025-02-01T00:00:00.000Z',
    undefined,
    strongOverFitted
  );
  const invO = 1 / 2.10;
  const invU = 1 / 1.85;
  const noVigO = invO / (invO + invU);
  const expPost = 0.45 * predBet.rawProbability + 0.55 * noVigO;
  const expEdgeVal = expPost - invO;
  const expEdgePct = Math.round(expEdgeVal * 1000) / 10;
  const expStakePct = Math.round(
    Math.min(MODEL_CONFIG.MAX_KELLY_STAKE, ((expPost * 2.10 - 1) / (2.10 - 1)) * MODEL_CONFIG.KELLY_FRACTION) * 1000
  ) / 10;
  const predMarketsSumOk =
    !!predBet.markets &&
    Math.abs(predBet.markets.homeWin + predBet.markets.draw + predBet.markets.awayWin - 1) < 1e-12 &&
    Math.abs(predBet.markets.over25 + predBet.markets.under25 - 1) < 1e-12;
  check(
    predBet.predictionType === 'OVER_25' &&
      Math.abs((predBet.posteriorProbability ?? 0) - expPost) < 1e-12 &&
      Math.abs((predBet.marketFairProb ?? 0) - noVigO) < 1e-12 &&
      predBet.edge === expEdgePct &&
      predBet.recommendedStake === expStakePct &&
      predMarketsSumOk,
    '7. Edge/posterior/Kelly/marketFairProb chain on runPrediction()'
  );

  // 8. H1: absent team => HEURISTIC_FALLBACK + isLowConfidence=true + NO_BET + stake=0
  const fallbackRes = await runPrediction(
    'ARSENAL',
    'CHELSEA',
    'EPL',
    { over25: { bestPrice: 2.50 }, under25: { bestPrice: 1.65 } },
    '2025-02-01T00:00:00.000Z',
    undefined,
    { homeAdvantage: 1.25, rho: -0.13, leagueBase: 1.4, teams: {}, dataProvider: 'STATIC_PRIOR' }
  );
  check(
    fallbackRes.modelSource === 'HEURISTIC_FALLBACK' &&
      fallbackRes.isLowConfidence === true &&
      fallbackRes.predictionType === 'NO_BET' &&
      fallbackRes.recommendedStake === 0 &&
      fallbackRes.verdict === 'NO_BET',
    '8. H1 guardrail: fallback prediction closes betting gate'
  );

  // 9. H3b: fallback expected goals use ONE formula matching diagnostics
  const fbDiag = fallbackRes.diagnostics!;
  const eplBase = BASE_GOALS * LEAGUE_CONFIGS.EPL.goalRate;
  const h3bLam = Math.max(
    MODEL_CONFIG.MIN_LAMBDA,
    Math.min(MODEL_CONFIG.MAX_LAMBDA, fbDiag.homeAttack * fbDiag.awayDefense * fbDiag.homeAdvantage * eplBase)
  );
  const h3bMu = Math.max(
    MODEL_CONFIG.MIN_MU,
    Math.min(MODEL_CONFIG.MAX_MU, fbDiag.awayAttack * fbDiag.homeDefense * eplBase)
  );
  check(
    Math.abs(fallbackRes.homeExpectedGoals - h3bLam) < 1e-12 &&
      Math.abs(fallbackRes.awayExpectedGoals - h3bMu) < 1e-12 &&
      Math.abs(fbDiag.homeAdvantage - (1 + LEAGUE_CONFIGS.EPL.homeAdvantage * HOME_ADVANTAGE_WEIGHT)) < 1e-12,
    '9. H3b guardrail: unified fallback lambda/mu formula matches diagnostics'
  );

  // 10. H2: asOfDate fallback reflects TEAM_STATS priors, not 1.0
  check(
    fbDiag.homeAttack === TEAM_STATS['ARSENAL'].attackStrength &&
      fbDiag.homeDefense === TEAM_STATS['ARSENAL'].defenseStrength &&
      fbDiag.awayAttack === TEAM_STATS['CHELSEA'].attackStrength &&
      fbDiag.awayDefense === TEAM_STATS['CHELSEA'].defenseStrength &&
      fbDiag.awayAttack !== 1.0,
    '10. H2 guardrail: asOfDate fallback uses TEAM_STATS priors'
  );

  // 11. Backtest arithmetic check on synthetic preloadedMatches
  const clubs = ['ARSENAL', 'CHELSEA', 'LIVERPOOL', 'MAN_CITY'];
  const rows: HistoricalMatch[] = [];
  for (let i = 0; i < 36; i++) {
    const h = clubs[i % clubs.length];
    const a = clubs[(i + 1 + (i % 3)) % clubs.length];
    const day = new Date(Date.UTC(2024, 7, 1 + i, 15, 0, 0));
    const isEvalWindow = i >= 24;
    // Skew scores high early so model predicts high Over 2.5 vs cheap Over odds on eval days
    const hg = h === 'ARSENAL' || h === 'LIVERPOOL' ? 3 : 2;
    const ag = a === 'CHELSEA' ? 2 : 1;
    rows.push({
      home: h,
      away: a,
      homeGoals: hg,
      awayGoals: ag,
      date: day.toISOString(),
      league: 'EPL',
      season: '2425',
      takenPrices: { over25: isEvalWindow ? 2.40 : 1.90, under25: isEvalWindow ? 1.65 : 2.00 },
      takenAt: new Date(day.getTime() - 86400000).toISOString(),
      closingPrices: { over25: isEvalWindow ? 2.15 : 1.85, under25: isEvalWindow ? 1.78 : 2.05 },
      closedAt: day.toISOString(),
    });
  }

  const bt = await runBacktest({
    leagues: ['EPL'],
    trainSeasons: ['2425'],
    evalSeasons: ['2425'],
    preloadedMatches: { EPL: rows },
  });

  // Match returned rows to preloaded rows by date+teams to recompute exact metrics
  const rowByKey = new Map(rows.map((r) => [`${r.date.split('T')[0]}|${r.home}|${r.away}`, r]));
  let recomputedBrier = 0;
  let recomputedMktBrier = 0;
  let mktCount = 0;
  let recomputedPnl = 0;
  let recomputedStake = 0;
  let recomputedClvSum = 0;
  let recomputedClvCount = 0;

  for (const m of bt.matches) {
    const src = rowByKey.get(`${m.date}|${m.match.homeTeam}|${m.match.awayTeam}`)!;
    const y = src.homeGoals + src.awayGoals > 2.5 ? 1 : 0;
    recomputedBrier += Math.pow(m.prediction.rawProbability - y, 2);
    const cO = src.closingPrices?.over25;
    const cU = src.closingPrices?.under25;
    if (cO && cO > 1 && cU && cU > 1) {
      const pMkt = (1 / cO) / (1 / cO + 1 / cU);
      recomputedMktBrier += Math.pow(pMkt - y, 2);
      mktCount++;
    }
    if (m.prediction.predictionType !== 'NO_BET' && m.stake > 0) {
      recomputedPnl += m.pnl;
      recomputedStake += m.stake;
      if (m.takenOdds && m.closingOdds) {
        recomputedClvSum += (m.takenOdds / m.closingOdds - 1) * 100;
        recomputedClvCount++;
      }
    }
  }
  const meanBrier = recomputedBrier / bt.matches.length;
  const meanMktBrier = recomputedMktBrier / mktCount;
  const meanYield = recomputedStake > 0 ? (recomputedPnl / recomputedStake) * 100 : 0;
  const meanClv = recomputedClvCount > 0 ? recomputedClvSum / recomputedClvCount : 0;

  check(
    bt.matches.length === 36 &&
      bt.totalMatches > 0 &&
      Math.abs(bt.brierScore - meanBrier) < 1e-9 &&
      Math.abs((bt.marketBrier ?? 0) - meanMktBrier) < 1e-9 &&
      Math.abs((bt.brierVsMarket ?? 0) - (meanBrier - meanMktBrier)) < 1e-9 &&
      Math.abs(bt.totalPnl - Math.round(recomputedPnl * 100) / 100) <= 0.01 &&
      Math.abs(bt.totalYield - meanYield) < 1e-9 &&
      Math.abs(bt.avgClv - meanClv) < 1e-9,
    '11. Backtest arithmetic (brier, marketBrier, PnL, yield, avgClv)',
    `eval=${bt.matches.length}, bets=${bt.totalMatches}, yield=${bt.totalYield.toFixed(2)}%`
  );

  console.log(`\nMath verification complete: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
