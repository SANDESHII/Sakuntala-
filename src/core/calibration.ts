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
import { HistoricalMatch } from '../types';
import { TIME_DECAY_PHI, DEFAULT_RHO, BASE_GOALS } from './constants';

const HOME_ADVANTAGE_GAMMA = 1.25;

export interface FittedTeamParams {
  attack: number;   // α — attacking strength (1.0 = league average)
  defense: number;  // β — defensive strength (1.0 = league average)
  matchCount: number;
  lowConfidence: boolean;
}

export interface FittedLeagueParams {
  homeAdvantage: number;  // γ
  rho: number;            // ρ
  teams: Record<string, FittedTeamParams>;
}

interface MatchData {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  daysAgo: number; // For temporal weighting
}

/**
 * Fit attack/defense parameters via gradient ascent on
 * the Dixon-Coles log-likelihood with temporal weighting.
 * 
 * @param matches - Historical match data with goals and temporal information
 * @param iterations - Number of gradient ascent iterations
 * @param lr - Learning rate
 * @returns Fitted league and team parameters
 */
export function fitDixonColes(
  matches: MatchData[],
  iterations = 500,
  lr = 0.01
): FittedLeagueParams {
  if (matches.length === 0) return { homeAdvantage: HOME_ADVANTAGE_GAMMA, rho: DEFAULT_RHO, teams: {} };

  const teamSet = new Set<string>();
  const matchCounts: Record<string, number> = {};
  for (const m of matches) { 
    teamSet.add(m.home); 
    teamSet.add(m.away); 
    matchCounts[m.home] = (matchCounts[m.home] || 0) + 1;
    matchCounts[m.away] = (matchCounts[m.away] || 0) + 1;
  }
  const teams = Array.from(teamSet);

  // Init at 1.0 (league average)
  const atk: Record<string, number> = {};
  const def: Record<string, number> = {};
  for (const t of teams) { atk[t] = 1.0; def[t] = 1.0; }
  let gamma = HOME_ADVANTAGE_GAMMA;  // home advantage
  let rho = DEFAULT_RHO;

  for (let iter = 0; iter < iterations; iter++) {
    const gradientAttack: Record<string, number> = {};
    const gradientDefense: Record<string, number> = {};
    for (const t of teams) { gradientAttack[t] = 0; gradientDefense[t] = 0; }
    let gradientGamma = 0, gradientRho = 0;

    for (const { home, away, homeGoals, awayGoals, daysAgo } of matches) {
      const weight = Math.exp(-TIME_DECAY_PHI * daysAgo);
      const lambda = Math.max(atk[home] * def[away] * gamma, 1e-10);
      const muAway = Math.max(atk[away] * def[home], 1e-10);

      // d logL / d lambda  and  d logL / d mu
      const dL_lambda = homeGoals / lambda - 1;
      const dL_muAway = awayGoals / muAway - 1;

      // Tau partial derivatives with safety bounds
      let dt_lambda = 0, dt_muAway = 0;
      const minRhoMatch = -1 / Math.max(lambda, muAway, 1);
      const safeRhoMatch = Math.max(minRhoMatch + 0.001, rho);

      if (homeGoals === 0 && awayGoals === 0) {
        const d = 1 - lambda * muAway * safeRhoMatch;
        dt_lambda = (-muAway * safeRhoMatch) / d;
        dt_muAway = (-lambda * safeRhoMatch) / d;
      } else if (homeGoals === 0 && awayGoals === 1) {
        dt_lambda = safeRhoMatch / (1 + lambda * safeRhoMatch);
      } else if (homeGoals === 1 && awayGoals === 0) {
        dt_muAway = safeRhoMatch / (1 + muAway * safeRhoMatch);
      }

      const grad_lambda = weight * (dL_lambda + dt_lambda);
      const grad_muAway = weight * (dL_muAway + dt_muAway);

      // Chain rule: d lam / d atk_home = def_away * gamma
      gradientAttack[home] += grad_lambda * def[away] * gamma;
      gradientDefense[away] += grad_lambda * atk[home] * gamma;
      gradientAttack[away] += grad_muAway * def[home];
      gradientDefense[home] += grad_muAway * atk[away];

      // d lam / d gamma = atk_home * def_away
      gradientGamma += grad_lambda * atk[home] * def[away];

      // d logL / d rho with safety bounds
      let dr = 0;
      if (homeGoals === 0 && awayGoals === 0)      dr = weight * ((-lambda * muAway) / (1 - lambda * muAway * safeRhoMatch));
      else if (homeGoals === 0 && awayGoals === 1) dr = weight * (lambda / (1 + lambda * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 0) dr = weight * (muAway / (1 + muAway * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 1) dr = weight * (-1 / (1 - safeRhoMatch));
      gradientRho += dr;
    }

    // Update (gradient ascent)
    const n = matches.length;
    const REG_LAMBDA = 0.5; // L2 penalty coefficient for shrinkage towards 1.0
    for (const t of teams) {
      // Shrinkage: d/d(param) [ -REG_LAMBDA * (param - 1)^2 ] = -2 * REG_LAMBDA * (param - 1)
      const penaltyA = -2 * REG_LAMBDA * (atk[t] - 1);
      const penaltyD = -2 * REG_LAMBDA * (def[t] - 1);

      atk[t] = Math.max(0.2, Math.min(3.0, atk[t] + lr * (gradientAttack[t] + penaltyA) / n));
      def[t] = Math.max(0.2, Math.min(3.0, def[t] + lr * (gradientDefense[t] + penaltyD) / n));
    }

    // Resolve identifiability Scale Symmetry: Ensure mean(atk) = 1.0 by shifting scale to defense
    // This ensures the model remains identifiable and the normalization doesn't happen "after" optimization
    const currentAvgA = teams.reduce((s, t) => s + atk[t], 0) / teams.length;
    for (const t of teams) {
      atk[t] /= currentAvgA;
      def[t] *= currentAvgA;
    }

    gamma = Math.max(0.8, Math.min(2.0, gamma + lr * gradientGamma / n));
    rho   = Math.max(-0.5, Math.min(0.0, rho + lr * gradientRho / n));
    lr *= 0.998;
  }

  const result: Record<string, FittedTeamParams> = {};
  for (const t of teams) {
    const count = matchCounts[t] || 0;
    result[t] = { 
      attack: atk[t], 
      defense: def[t],
      matchCount: count,
      lowConfidence: count < 6
    };
  }

  return { homeAdvantage: gamma, rho, teams: result };
}

// ── API Integration ────────────────────────────────────────────

/**
 * Fit parameters from real historical data via API.
 * 
 * @param league - League identifier (e.g., 'EPL')
 * @param asOfDate - Optional cutoff date for walk-forward testing
 * @param historicalMatches - Optional pre-fetched historical matches
 * @returns Fitted league parameters
 */
export async function fitFromAPI(
  league: string, 
  asOfDate?: string, 
  historicalMatches?: HistoricalMatch[]
): Promise<FittedLeagueParams> {
  const raw = historicalMatches || await FreeDataService.getHistoricalFixtures(league, 150);
  if (raw.length < 20) return { homeAdvantage: HOME_ADVANTAGE_GAMMA, rho: DEFAULT_RHO, teams: {} };

  const cutoff = asOfDate ? new Date(asOfDate).getTime() : Date.now();
  const filtered = raw.filter(m => new Date(m.date).getTime() < cutoff);
  
  if (filtered.length < 20) {
     return { homeAdvantage: HOME_ADVANTAGE_GAMMA, rho: DEFAULT_RHO, teams: {} };
  }

  const matches: MatchData[] = filtered.map(m => {
    const kickoffTs = new Date(m.date).getTime();
    const diffDays = Math.max(0, (cutoff - kickoffTs) / (1000 * 60 * 60 * 24));
    return {
      home: m.home,
      away: m.away,
      homeGoals: m.homeGoals || 0,
      awayGoals: m.awayGoals || 0,
      daysAgo: diffDays
    };
  });

  return fitDixonColes(matches, 500, 0.01);
}


// ── Prediction ─────────────────────────────────────────────────

/**
 * Compute expected goals (λ, μ) using fitted MLE parameters.
 * Returns null if either team isn't in the fitted data.
 * 
 * Specification:
 * lambda_home = alpha_home * beta_away * gamma (home advantage)
 * mu_away     = alpha_away * beta_home
 * 
 * @param fitted - Result of MLE fitting
 * @param homeTeam - Home team name
 * @param awayTeam - Away team name
 * @returns Predicted expected goals and confidence indicator
 */
export function predictGoals(
  fitted: FittedLeagueParams,
  homeTeam: string,
  awayTeam: string
): { lambdaHome: number; muAway: number; lowConfidence: boolean } | null {
  const hKey = homeTeam.toUpperCase();
  const aKey = awayTeam.toUpperCase();
  
  const h = fitted.teams[hKey];
  const a = fitted.teams[aKey];
  
  if (!h || !a) return null;

  // MLE lambda/mu calculation
  // Param semantics: attack/defense are multipliers on league average
  let lambdaHome = h.attack * a.defense * fitted.homeAdvantage * BASE_GOALS;
  let muAway = a.attack * h.defense * BASE_GOALS;

  // Sanity Clamps (consistent with MODEL_CONFIG in engine.ts)
  lambdaHome = Math.max(0.3, Math.min(4.0, lambdaHome));
  muAway = Math.max(0.2, Math.min(3.5, muAway));

  return {
    lambdaHome,
    muAway,
    lowConfidence: h.lowConfidence || a.lowConfidence
  };
}
