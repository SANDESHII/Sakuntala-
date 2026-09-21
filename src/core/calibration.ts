/**
 * Dixon-Coles MLE Fitting + Calibration
 *
 * This ONE module replaces all hand-tuned constants.
 * Feed it real match data → get statistically optimal attack/defense parameters.
 *
 * Usage:
 *   const fitted = await fitFromAPI('EPL');
 *   const goals = predictGoals(fitted, 'ARSENAL', 'CHELSEA');
 *   // → { lambdaHome: 1.87, muAway: 1.12 }
 */

import * as FreeDataService from '../services/freeDataService';

// ── Types ──────────────────────────────────────────────────────

export interface FittedTeamParams {
  attack: number;   // α — attacking strength (1.0 = league average)
  defense: number;  // β — defensive strength (1.0 = league average)
}

export interface FittedLeagueParams {
  homeAdvantage: number;  // γ
  rho: number;            // ρ
  teams: Record<string, FittedTeamParams>;
}

interface MatchData {
  home: string;
  away: string;
  hg: number;
  ag: number;
}

// ── Poisson helpers ────────────────────────────────────────────

const LOG_FACT = [0];
for (let i = 1; i <= 20; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);

function logPoisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 0 : -Infinity;
  if (k < 0 || k >= LOG_FACT.length) return -Infinity;
  return k * Math.log(lambda) - lambda - LOG_FACT[k];
}

export function dcLogLikelihood(
  h: number, a: number,
  lambda: number, mu: number, rho: number
): number {
  let ll = logPoisson(h, lambda) + logPoisson(a, mu);
  // Tau correction for low scores
  if (h === 0 && a === 0) ll += Math.log(Math.max(1 - lambda * mu * rho, 1e-10));
  else if (h === 0 && a === 1) ll += Math.log(Math.max(1 + lambda * rho, 1e-10));
  else if (h === 1 && a === 0) ll += Math.log(Math.max(1 + mu * rho, 1e-10));
  else if (h === 1 && a === 1) ll += Math.log(Math.max(1 - rho, 1e-10));
  return ll;
}

// ── MLE Fitting ────────────────────────────────────────────────

/**
 * Fit attack/defense parameters via gradient ascent on
 * the Dixon-Coles log-likelihood.
 */
export function fitDixonColes(
  matches: MatchData[],
  iterations = 500,
  lr = 0.01
): FittedLeagueParams {
  if (matches.length === 0) return { homeAdvantage: 1.25, rho: -0.13, teams: {} };

  const teamSet = new Set<string>();
  for (const m of matches) { teamSet.add(m.home); teamSet.add(m.away); }
  const teams = Array.from(teamSet);

  // Init at 1.0 (league average)
  const atk: Record<string, number> = {};
  const def: Record<string, number> = {};
  for (const t of teams) { atk[t] = 1.0; def[t] = 1.0; }
  let gamma = 1.25;  // home advantage
  let rho = -0.13;

  for (let iter = 0; iter < iterations; iter++) {
    const gA: Record<string, number> = {};
    const gD: Record<string, number> = {};
    for (const t of teams) { gA[t] = 0; gD[t] = 0; }
    let gG = 0, gR = 0;

    for (const { home, away, hg: h, ag: a } of matches) {
      const lam = Math.max(atk[home] * def[away] * gamma, 1e-10);
      const mu  = Math.max(atk[away] * def[home], 1e-10);

      // d logL / d lambda  and  d logL / d mu
      const dL_lam = h / lam - 1;
      const dL_mu  = a / mu - 1;

      // Tau partial derivatives
      let dt_lam = 0, dt_mu = 0;
      if (h === 0 && a === 0) {
        const d = Math.max(1 - lam * mu * rho, 1e-10);
        dt_lam = (-mu * rho) / d;
        dt_mu  = (-lam * rho) / d;
      } else if (h === 0 && a === 1) {
        dt_lam = rho / Math.max(1 + lam * rho, 1e-10);
      } else if (h === 1 && a === 0) {
        dt_mu = rho / Math.max(1 + mu * rho, 1e-10);
      }

      const grad_lam = dL_lam + dt_lam;
      const grad_mu  = dL_mu  + dt_mu;

      // Chain rule: d lam / d atk_home = def_away * gamma
      gA[home] += grad_lam * def[away] * gamma;
      gD[away] += grad_lam * atk[home] * gamma;
      gA[away] += grad_mu  * def[home];
      gD[home] += grad_mu  * atk[away];

      // d lam / d gamma = atk_home * def_away
      gG += grad_lam * atk[home] * def[away];

      // d logL / d rho
      let dr = 0;
      if (h === 0 && a === 0)      dr = (-lam * mu) / Math.max(1 - lam * mu * rho, 1e-10);
      else if (h === 0 && a === 1) dr = lam / Math.max(1 + lam * rho, 1e-10);
      else if (h === 1 && a === 0) dr = mu  / Math.max(1 + mu * rho, 1e-10);
      else if (h === 1 && a === 1) dr = -1  / Math.max(1 - rho, 1e-10);
      gR += dr;
    }

    // Update (gradient ascent)
    const n = matches.length;
    for (const t of teams) {
      atk[t] = Math.max(0.2, Math.min(3.0, atk[t] + lr * gA[t] / n));
      def[t] = Math.max(0.2, Math.min(3.0, def[t] + lr * gD[t] / n));
    }
    gamma = Math.max(0.8, Math.min(2.0, gamma + lr * gG / n));
    rho   = Math.max(-0.5, Math.min(0.0, rho + lr * gR / n));
    lr *= 0.998;
  }

  // Normalize so average = 1.0
  const avgA = teams.reduce((s, t) => s + atk[t], 0) / teams.length;
  const avgD = teams.reduce((s, t) => s + def[t], 0) / teams.length;

  const result: Record<string, FittedTeamParams> = {};
  for (const t of teams) {
    result[t] = { attack: atk[t] / avgA, defense: def[t] / avgD };
  }

  return { homeAdvantage: gamma, rho, teams: result };
}

// ── API Integration ────────────────────────────────────────────

const cache: Record<string, { params: FittedLeagueParams; ts: number }> = {};
const TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fit parameters from real historical data via API.
 * Cached for 6 hours.
 */
export async function fitFromAPI(league: string): Promise<FittedLeagueParams> {
  const c = cache[league];
  if (c && Date.now() - c.ts < TTL) return c.params;

  const raw = await FreeDataService.getHistoricalFixtures(league, 100);
  if (raw.length < 20) return { homeAdvantage: 1.25, rho: -0.13, teams: {} };

  const matches: MatchData[] = raw.map(m => ({
    home: m.home, away: m.away, hg: m.homeGoals, ag: m.awayGoals,
  }));

  const fitted = fitDixonColes(matches, 500, 0.01);
  cache[league] = { params: fitted, ts: Date.now() };
  return fitted;
}

// ── Prediction ─────────────────────────────────────────────────

const BASE_GOALS = 1.35; // league-average goals per game

/**
 * Compute expected goals (λ, μ) using fitted parameters.
 * Returns null if either team isn't in the fitted data.
 */
export function predictGoals(
  fitted: FittedLeagueParams,
  homeTeam: string,
  awayTeam: string
): { lambdaHome: number; muAway: number } | null {
  const h = fitted.teams[homeTeam];
  const a = fitted.teams[awayTeam];
  if (!h || !a) return null;
  return {
    lambdaHome: h.attack * a.defense * fitted.homeAdvantage * BASE_GOALS,
    muAway:     a.attack * h.defense * BASE_GOALS,
  };
}

// ── Calibration ────────────────────────────────────────────────

/**
 * Check if predicted probabilities match actual outcomes.
 *
 * If you predict 70%, did events actually happen ~70% of the time?
 * If not, the model is miscalibrated.
 */
export function checkCalibration(
  predictions: { predicted: number; actual: boolean }[],
  bucketSize = 10
): { bucket: string; predicted: number; actual: number; count: number }[] {
  const buckets: Record<string, { sum: number; hits: number; count: number }> = {};

  for (const p of predictions) {
    const b = Math.floor(p.predicted / bucketSize) * bucketSize;
    const key = `${b}-${b + bucketSize}%`;
    if (!buckets[key]) buckets[key] = { sum: 0, hits: 0, count: 0 };
    buckets[key].sum += p.predicted;
    buckets[key].hits += p.actual ? 1 : 0;
    buckets[key].count++;
  }

  return Object.entries(buckets)
    .map(([bucket, d]) => ({
      bucket,
      predicted: d.sum / d.count,
      actual: (d.hits / d.count) * 100,
      count: d.count,
    }))
    .sort((a, b) => a.predicted - b.predicted);
}
