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
import { TIME_DECAY_PHI, DEFAULT_RHO, BASE_GOALS, REG_LAMBDA } from './constants';
import { logger } from '../services/logger';

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
      const homeExp = Math.max(atk[home] * def[away] * gamma, 1e-10);
      const awayExp = Math.max(atk[away] * def[home], 1e-10);

      const dL_home = homeGoals / homeExp - 1;
      const dL_away = awayGoals / awayExp - 1;

      let dt_home = 0, dt_away = 0;
      const minRhoMatch = -1 / Math.max(homeExp, awayExp, 1);
      const safeRhoMatch = Math.max(minRhoMatch + 0.001, rho);

      if (homeGoals === 0 && awayGoals === 0) {
        const d = 1 - homeExp * awayExp * safeRhoMatch;
        dt_home = (-awayExp * safeRhoMatch) / d;
        dt_away = (-homeExp * safeRhoMatch) / d;
      } else if (homeGoals === 0 && awayGoals === 1) {
        dt_home = safeRhoMatch / (1 + homeExp * safeRhoMatch);
      } else if (homeGoals === 1 && awayGoals === 0) {
        dt_away = safeRhoMatch / (1 + awayExp * safeRhoMatch);
      }

      const gradHome = weight * (dL_home + dt_home);
      const gradAway = weight * (dL_away + dt_away);

      gradientAttack[home] += gradHome * def[away] * gamma;
      gradientDefense[away] += gradHome * atk[home] * gamma;
      gradientAttack[away] += gradAway * def[home];
      gradientDefense[home] += gradAway * atk[away];

      gradientGamma += gradHome * atk[home] * def[away];

      let dr = 0;
      if (homeGoals === 0 && awayGoals === 0)      dr = weight * ((-homeExp * awayExp) / (1 - homeExp * awayExp * safeRhoMatch));
      else if (homeGoals === 0 && awayGoals === 1) dr = weight * (homeExp / (1 + homeExp * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 0) dr = weight * (awayExp / (1 + awayExp * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 1) dr = weight * (-1 / (1 - safeRhoMatch));
      gradientRho += dr;
    }

    // Update (gradient ascent)
    const n = matches.length;
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

const fittedCache = new Map<string, { params: FittedLeagueParams; ts: number }>();
const FITTED_TTL = 6 * 60 * 60 * 1000; // 6 hours

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
  const isLive = !asOfDate && !historicalMatches;
  if (isLive) {
    const cached = fittedCache.get(league);
    if (cached && Date.now() - cached.ts < FITTED_TTL) return cached.params;
  }

  const raw = historicalMatches || await (async () => {
    try {
      return await FreeDataService.getHistoricalFixtures(league, 150);
    } catch (err: any) {
      logger.error('fitFromAPI_fetch', err, { league });
      return [];
    }
  })();
  if (raw.length < 20) return { homeAdvantage: HOME_ADVANTAGE_GAMMA, rho: DEFAULT_RHO, teams: {} };

  const cutoff = asOfDate ? new Date(asOfDate).getTime() : Date.now();
  const filtered = raw.filter(m => new Date(m.date).getTime() < cutoff);
  
  if (filtered.length < 20) {
     return { homeAdvantage: HOME_ADVANTAGE_GAMMA, rho: DEFAULT_RHO, teams: {} };
  }

  const matches: MatchData[] = filtered.map(m => ({
    home: m.home,
    away: m.away,
    homeGoals: m.homeGoals || 0,
    awayGoals: m.awayGoals || 0,
    daysAgo: Math.max(0, (cutoff - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24))
  }));

  const params = fitDixonColes(matches, 500, 0.01);
  if (isLive) fittedCache.set(league, { params, ts: Date.now() });
  return params;
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
  
  const homeParams = fitted.teams[hKey];
  const awayParams = fitted.teams[aKey];
  
  if (!homeParams || !awayParams) return null;

  // MLE lambda/mu calculation
  // Param semantics: attack/defense are multipliers on league average
  let lambdaHome = homeParams.attack * awayParams.defense * fitted.homeAdvantage * BASE_GOALS;
  let muAway = awayParams.attack * homeParams.defense * BASE_GOALS;

  // Sanity Clamps (consistent with MODEL_CONFIG in engine.ts)
  lambdaHome = Math.max(0.3, Math.min(4.0, lambdaHome));
  muAway = Math.max(0.2, Math.min(3.5, muAway));

  return {
    lambdaHome,
    muAway,
    lowConfidence: homeParams.lowConfidence || awayParams.lowConfidence
  };
}
