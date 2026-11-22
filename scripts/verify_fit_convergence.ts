/**
 * Convergence check for the Dixon-Coles MLE fit.
 * Builds a synthetic league with KNOWN team strengths, fits it with the repo's
 * fitFromAPI(), and checks the fitted strengths are close to the truth.
 * Fails if the optimizer is under-trained (team strengths squashed toward 1.0).
 *
 * Run: npm run verify:fit
 */
import { fitFromAPI } from '../src/core/calibration';

const BASE = 1.35;
const T = 20;
const TRUE_GAMMA = 1.3;
const TRUE_RHO = -0.12;

// Seeded RNG so the test is repeatable
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

function poissonPmf(k: number, l: number) {
  let lf = 0;
  for (let i = 2; i <= k; i++) lf += Math.log(i);
  return Math.exp(k * Math.log(l) - l - lf);
}
function tau(x: number, y: number, l: number, m: number, r: number) {
  if (x === 0 && y === 0) return 1 - l * m * r;
  if (x === 0 && y === 1) return 1 + l * r;
  if (x === 1 && y === 0) return 1 + m * r;
  if (x === 1 && y === 1) return 1 - r;
  return 1;
}
function sampleScore(l: number, m: number): [number, number] {
  const K = 14;
  let total = 0;
  const cells: number[] = [];
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
    const p = poissonPmf(i, l) * poissonPmf(j, m) * tau(i, j, l, m, TRUE_RHO);
    cells.push(p);
    total += p;
  }
  let u = rand() * total;
  for (let c = 0; c < cells.length; c++) {
    u -= cells[c];
    if (u <= 0) return [Math.floor(c / K), c % K];
  }
  return [0, 0];
}

const std = (v: number[]) => {
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};

async function main() {
  let atk = Array.from({ length: T }, () => Math.exp(gauss() * 0.28));
  const aMean = atk.reduce((s, x) => s + x, 0) / T;
  atk = atk.map((x) => x / aMean);
  let def = Array.from({ length: T }, () => Math.exp(gauss() * 0.22));
  const dMean = def.reduce((s, x) => s + x, 0) / T;
  def = def.map((x) => (x / dMean) * 0.95);

  const matches: any[] = [];
  const end = Date.UTC(2026, 10, 1);
  for (let s = 0; s < 3; s++) {
    const start = end - 365 * (3 - s) * 86400000;
    for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
      if (i === j) continue;
      const d = new Date(start + Math.floor(rand() * 330) * 86400000).toISOString();
      const [hg, ag] = sampleScore(atk[i] * def[j] * TRUE_GAMMA * BASE, atk[j] * def[i] * BASE);
      matches.push({ home: `T${String(i).padStart(2, '0')}`, away: `T${String(j).padStart(2, '0')}`, homeGoals: hg, awayGoals: ag, date: d });
    }
  }

  const fit = await fitFromAPI('EPL', '2026-11-02T00:00:00.000Z', matches);
  const fa = Array.from({ length: T }, (_, i) => fit.teams[`T${String(i).padStart(2, '0')}`].attack);
  const ratio = std(fa) / std(atk);

  let failures = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
    if (!ok) failures++;
  };
  console.log(`attack spread: true ${std(atk).toFixed(3)} | fitted ${std(fa).toFixed(3)} | ratio ${ratio.toFixed(2)}`);
  console.log(`home advantage: true ${TRUE_GAMMA} | fitted ${fit.homeAdvantage.toFixed(3)}`);
  console.log(`rho: true ${TRUE_RHO} | fitted ${fit.rho.toFixed(3)}`);
  check(ratio > 0.8, `fitted attack spread is at least 80% of the true spread (got ${(ratio * 100).toFixed(0)}%)`);
  check(Math.abs(fit.homeAdvantage - TRUE_GAMMA) < 0.12, 'home advantage within 0.12 of truth');
  check(Math.abs(fit.rho - TRUE_RHO) < 0.05, 'rho within 0.05 of truth');
  console.log(failures ? `\nTotal failures: ${failures}` : '\nTotal failures: 0');
  process.exit(failures ? 1 : 0);
}
main();
