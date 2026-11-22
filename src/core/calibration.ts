/**
 * Dixon-Coles MLE Fitting + Calibration
 */

import * as FreeDataService from '../services/freeDataService';
import { loadRecentLeagueCsvMatches } from '../services/footballDataCsv';
import { HistoricalMatch } from '../types';
import { TIME_DECAY_PHI, DEFAULT_RHO, BASE_GOALS, REG_LAMBDA, MODEL_CONFIG } from './constants';
import { resolveTeam } from '../data/teamIds';
import { logger } from '../services/logger';

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
  matchesUsed?: number;
  dataProvider?: 'API_FOOTBALL' | 'FOOTBALL_DATA_CSV' | 'STATIC_PRIOR';
}

interface MatchData {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  daysAgo: number;
}

/**
 * Fit attack/defense parameters via gradient ascent on
 * the Dixon-Coles log-likelihood with temporal weighting.
 */
function fitDixonColes(
  matches: MatchData[],
  iterations = MODEL_CONFIG.DEFAULT_FIT_ITERATIONS,
  lr = MODEL_CONFIG.DEFAULT_LEARNING_RATE
): FittedLeagueParams {
  if (matches.length === 0) {
    return {
      homeAdvantage: MODEL_CONFIG.HOME_ADVANTAGE_GAMMA,
      rho: DEFAULT_RHO,
      teams: {},
      matchesUsed: 0,
      dataProvider: 'STATIC_PRIOR',
    };
  }

  const teams: string[] = [];
  const teamIdx = new Map<string, number>();
  const matchCounts: number[] = [];
  const idxOf = (t: string): number => {
    let idx = teamIdx.get(t);
    if (idx === undefined) {
      idx = teams.length;
      teams.push(t);
      teamIdx.set(t, idx);
      matchCounts.push(0);
    }
    return idx;
  };

  const n = matches.length;
  const hIdx = new Int32Array(n);
  const aIdx = new Int32Array(n);
  const hgArr = new Int32Array(n);
  const agArr = new Int32Array(n);
  const wArr = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const m = matches[i];
    const hi = idxOf(m.home);
    const ai = idxOf(m.away);
    hIdx[i] = hi;
    aIdx[i] = ai;
    hgArr[i] = m.homeGoals;
    agArr[i] = m.awayGoals;
    wArr[i] = Math.exp(-TIME_DECAY_PHI * m.daysAgo);
    matchCounts[hi]++;
    matchCounts[ai]++;
  }

  const numTeams = teams.length;
  const atk = new Float64Array(numTeams).fill(1.0);
  const def = new Float64Array(numTeams).fill(1.0);
  const gradientAttack = new Float64Array(numTeams);
  const gradientDefense = new Float64Array(numTeams);
  let gamma = MODEL_CONFIG.HOME_ADVANTAGE_GAMMA;
  let rho = DEFAULT_RHO;

  let prevLL = -Infinity;
  for (let iter = 0; iter < iterations; iter++) {
    gradientAttack.fill(0);
    gradientDefense.fill(0);
    let gradientGamma = 0;
    let gradientRho = 0;
    let currentLL = 0;

    for (let i = 0; i < n; i++) {
      const home = hIdx[i];
      const away = aIdx[i];
      const homeGoals = hgArr[i];
      const awayGoals = agArr[i];
      const weight = wArr[i];
      const homeExp = Math.max(atk[home] * def[away] * gamma * BASE_GOALS, MODEL_CONFIG.PROBABILITY_FLOOR);
      const awayExp = Math.max(atk[away] * def[home] * BASE_GOALS, MODEL_CONFIG.PROBABILITY_FLOOR);

      currentLL += weight * (homeGoals * Math.log(homeExp) - homeExp + awayGoals * Math.log(awayExp) - awayExp);

      const dL_home = homeGoals / homeExp - 1;
      const dL_away = awayGoals / awayExp - 1;

      let dt_home = 0;
      let dt_away = 0;
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

      gradientAttack[home] += gradHome * def[away] * gamma * BASE_GOALS;
      gradientDefense[away] += gradHome * atk[home] * gamma * BASE_GOALS;
      gradientAttack[away] += gradAway * def[home] * BASE_GOALS;
      gradientDefense[home] += gradAway * atk[away] * BASE_GOALS;

      gradientGamma += gradHome * atk[home] * def[away] * BASE_GOALS;

      let dr = 0;
      if (homeGoals === 0 && awayGoals === 0) dr = weight * ((-homeExp * awayExp) / (1 - homeExp * awayExp * safeRhoMatch));
      else if (homeGoals === 0 && awayGoals === 1) dr = weight * (homeExp / (1 + homeExp * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 0) dr = weight * (awayExp / (1 + awayExp * safeRhoMatch));
      else if (homeGoals === 1 && awayGoals === 1) dr = weight * (-1 / (1 - safeRhoMatch));
      gradientRho += dr;
    }

    if (Math.abs(currentLL - prevLL) < 1e-6) break;
    prevLL = currentLL;

    for (let t = 0; t < numTeams; t++) {
      const penaltyA = -2 * REG_LAMBDA * (atk[t] - 1);
      const penaltyD = -2 * REG_LAMBDA * (def[t] - 1);

      atk[t] = Math.max(0.2, Math.min(3.0, atk[t] + lr * (gradientAttack[t] + penaltyA) / n));
      def[t] = Math.max(0.2, Math.min(3.0, def[t] + lr * (gradientDefense[t] + penaltyD) / n));
    }

    let sumA = 0;
    for (let t = 0; t < numTeams; t++) sumA += atk[t];
    const currentAvgA = sumA / numTeams;
    for (let t = 0; t < numTeams; t++) {
      atk[t] /= currentAvgA;
      def[t] *= currentAvgA;
    }

    gamma = Math.max(0.8, Math.min(2.0, gamma + lr * gradientGamma / n));
    rho = Math.max(-0.5, Math.min(0.0, rho + lr * gradientRho / n));
    lr *= 0.998;
  }

  const result: Record<string, FittedTeamParams> = {};
  for (let t = 0; t < numTeams; t++) {
    const count = matchCounts[t];
    result[teams[t]] = {
      attack: atk[t],
      defense: def[t],
      matchCount: count,
      lowConfidence: count < 6,
    };
  }

  return { homeAdvantage: gamma, rho, teams: result, matchesUsed: n };
}

const fittedCache = new Map<string, { params: FittedLeagueParams; ts: number }>();
const FITTED_TTL = 6 * 60 * 60 * 1000;

/**
 * Fit parameters from real historical data via API-Football or football-data.co.uk CSVs.
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

  let dataProvider: FittedLeagueParams['dataProvider'] = 'API_FOOTBALL';
  let raw = historicalMatches;

  if (!raw) {
    try {
      raw = await FreeDataService.getHistoricalFixtures(league, 300);
    } catch (err: unknown) {
      logger.warn('fitFromAPI_fetch', `API-Football unavailable for ${league}: ${err instanceof Error ? err.message : String(err)}`);
      raw = [];
    }

    if (raw.length < 20) {
      try {
        const csvMatches = await loadRecentLeagueCsvMatches(league);
        if (csvMatches.length >= 20) {
          raw = csvMatches;
          dataProvider = 'FOOTBALL_DATA_CSV';
        }
      } catch (err: unknown) {
        logger.warn('fitFromAPI_csv', `CSV fallback unavailable for ${league}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    dataProvider = 'FOOTBALL_DATA_CSV';
  }

  if (!raw || raw.length < 20) {
    return {
      homeAdvantage: MODEL_CONFIG.HOME_ADVANTAGE_GAMMA,
      rho: DEFAULT_RHO,
      teams: {},
      matchesUsed: 0,
      dataProvider: 'STATIC_PRIOR',
    };
  }

  const cutoff = asOfDate ? new Date(asOfDate).getTime() : Date.now();
  const filtered = raw.filter((m) => new Date(m.date).getTime() < cutoff);

  if (filtered.length < 20) {
    return {
      homeAdvantage: MODEL_CONFIG.HOME_ADVANTAGE_GAMMA,
      rho: DEFAULT_RHO,
      teams: {},
      matchesUsed: 0,
      dataProvider: 'STATIC_PRIOR',
    };
  }

  const matches: MatchData[] = filtered.map((m) => ({
    home: resolveTeam(m.home).id,
    away: resolveTeam(m.away).id,
    homeGoals: m.homeGoals || 0,
    awayGoals: m.awayGoals || 0,
    daysAgo: Math.max(0, (cutoff - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  const params = fitDixonColes(matches);
  params.dataProvider = dataProvider;
  if (isLive) fittedCache.set(league, { params, ts: Date.now() });
  return params;
}

/**
 * Compute expected goals (λ, μ) using fitted MLE parameters.
 */
export function predictGoals(
  fitted: FittedLeagueParams,
  homeTeam: string,
  awayTeam: string
): {
  lambdaHome: number;
  muAway: number;
  lowConfidence: boolean;
  homeParams: FittedTeamParams;
  awayParams: FittedTeamParams;
} | null {
  const hKey = resolveTeam(homeTeam).id;
  const aKey = resolveTeam(awayTeam).id;

  const homeParams = fitted.teams[hKey];
  const awayParams = fitted.teams[aKey];

  if (!homeParams || !awayParams) return null;

  let lambdaHome = homeParams.attack * awayParams.defense * fitted.homeAdvantage * BASE_GOALS;
  let muAway = awayParams.attack * homeParams.defense * BASE_GOALS;

  lambdaHome = Math.max(MODEL_CONFIG.MIN_LAMBDA, Math.min(MODEL_CONFIG.MAX_LAMBDA, lambdaHome));
  muAway = Math.max(MODEL_CONFIG.MIN_MU, Math.min(MODEL_CONFIG.MAX_MU, muAway));

  return {
    lambdaHome,
    muAway,
    lowConfidence: homeParams.lowConfidence || awayParams.lowConfidence,
    homeParams,
    awayParams,
  };
}
