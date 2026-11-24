/**
 * Dixon-Coles MLE Fitting + Calibration
 */

import * as FreeDataService from '../services/freeDataService';
import { loadRecentLeagueCsvMatches } from '../services/footballDataCsv';
import { HistoricalMatch } from '../types';
import {
  TIME_DECAY_PHI,
  DEFAULT_RHO,
  BASE_GOALS,
  REG_LAMBDA,
  XG_BLEND_WEIGHT,
  OFF_TARGET_SHOT_WEIGHT,
  RED_CARD_MATCH_WEIGHT,
  MODEL_CONFIG,
  LEAGUE_CONFIGS,
} from './constants';
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
  leagueBase?: number;    // BASE_GOALS * leagueConfig.goalRate
  teams: Record<string, FittedTeamParams>;
  matchesUsed?: number;
  dataProvider?: 'API_FOOTBALL' | 'FOOTBALL_DATA_CSV' | 'STATIC_PRIOR';
}

interface MatchData {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  hasRedCard?: boolean;
  daysAgo: number;
}

function getLeagueBase(league?: string): number {
  if (!league) return BASE_GOALS;
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const cfg = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['STANDARD'];
  return BASE_GOALS * cfg.goalRate;
}

/**
 * Fit attack/defense parameters via gradient ascent on
 * the Dixon-Coles log-likelihood with temporal weighting
 * and causal shot-quality xG blending when shot data exists.
 */
function fitDixonColes(
  matches: MatchData[],
  leagueBase = BASE_GOALS,
  iterations = MODEL_CONFIG.DEFAULT_FIT_ITERATIONS,
  lr = MODEL_CONFIG.DEFAULT_LEARNING_RATE
): FittedLeagueParams {
  if (matches.length === 0) {
    return {
      homeAdvantage: MODEL_CONFIG.HOME_ADVANTAGE_GAMMA,
      rho: DEFAULT_RHO,
      leagueBase,
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
  const hgIntArr = new Int32Array(n);
  const agIntArr = new Int32Array(n);
  const hgEffArr = new Float64Array(n);
  const agEffArr = new Float64Array(n);
  const wArr = new Float64Array(n);

  let weightedShotGoals = 0;
  let weightedShotUnits = 0;

  for (let i = 0; i < n; i++) {
    const m = matches[i];
    const hi = idxOf(m.home);
    const ai = idxOf(m.away);
    const w = Math.exp(-TIME_DECAY_PHI * m.daysAgo) * (m.hasRedCard ? RED_CARD_MATCH_WEIGHT : 1.0);
    hIdx[i] = hi;
    aIdx[i] = ai;
    hgIntArr[i] = m.homeGoals;
    agIntArr[i] = m.awayGoals;
    wArr[i] = w;
    matchCounts[hi]++;
    matchCounts[ai]++;

    if (m.homeShotsOnTarget !== undefined && m.awayShotsOnTarget !== undefined) {
      const hOff = Math.max(0, (m.homeShots ?? m.homeShotsOnTarget) - m.homeShotsOnTarget);
      const aOff = Math.max(0, (m.awayShots ?? m.awayShotsOnTarget) - m.awayShotsOnTarget);
      weightedShotGoals += w * (m.homeGoals + m.awayGoals);
      weightedShotUnits += w * (m.homeShotsOnTarget + m.awayShotsOnTarget + OFF_TARGET_SHOT_WEIGHT * (hOff + aOff));
    }
  }

  const shotConversionRate = weightedShotUnits > 0 ? weightedShotGoals / weightedShotUnits : 0;

  for (let i = 0; i < n; i++) {
    const m = matches[i];
    let effH = m.homeGoals;
    let effA = m.awayGoals;
    if (
      XG_BLEND_WEIGHT > 0 &&
      shotConversionRate > 0 &&
      m.homeShotsOnTarget !== undefined &&
      m.awayShotsOnTarget !== undefined
    ) {
      const hOff = Math.max(0, (m.homeShots ?? m.homeShotsOnTarget) - m.homeShotsOnTarget);
      const aOff = Math.max(0, (m.awayShots ?? m.awayShotsOnTarget) - m.awayShotsOnTarget);
      const xgH = Math.min(8.0, shotConversionRate * (m.homeShotsOnTarget + OFF_TARGET_SHOT_WEIGHT * hOff));
      const xgA = Math.min(8.0, shotConversionRate * (m.awayShotsOnTarget + OFF_TARGET_SHOT_WEIGHT * aOff));
      effH = (1 - XG_BLEND_WEIGHT) * m.homeGoals + XG_BLEND_WEIGHT * xgH;
      effA = (1 - XG_BLEND_WEIGHT) * m.awayGoals + XG_BLEND_WEIGHT * xgA;
    }
    hgEffArr[i] = effH;
    agEffArr[i] = effA;
  }

  const numTeams = teams.length;
  const teamWeight = new Float64Array(numTeams);
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const w = wArr[i];
    teamWeight[hIdx[i]] += w;
    teamWeight[aIdx[i]] += w;
    totalWeight += w;
  }
  const safeTotalWeight = Math.max(totalWeight, 1.0);

  const atk = new Float64Array(numTeams).fill(1.0);
  const def = new Float64Array(numTeams).fill(1.0);
  const gradientAttack = new Float64Array(numTeams);
  const gradientDefense = new Float64Array(numTeams);
  let gamma = MODEL_CONFIG.HOME_ADVANTAGE_GAMMA;
  let rho = DEFAULT_RHO;

  let prevObjective = -Infinity;
  for (let iter = 0; iter < iterations; iter++) {
    gradientAttack.fill(0);
    gradientDefense.fill(0);
    let gradientGamma = 0;
    let gradientRho = 0;
    let currentLL = 0;

    for (let i = 0; i < n; i++) {
      const home = hIdx[i];
      const away = aIdx[i];
      const homeInt = hgIntArr[i];
      const awayInt = agIntArr[i];
      const homeTarget = hgEffArr[i];
      const awayTarget = agEffArr[i];
      const weight = wArr[i];
      const homeExp = Math.max(atk[home] * def[away] * gamma * leagueBase, MODEL_CONFIG.PROBABILITY_FLOOR);
      const awayExp = Math.max(atk[away] * def[home] * leagueBase, MODEL_CONFIG.PROBABILITY_FLOOR);

      const dL_home = homeTarget / homeExp - 1;
      const dL_away = awayTarget / awayExp - 1;

      let dt_home = 0;
      let dt_away = 0;
      let tauVal = 1;
      let dr = 0;
      const minRhoMatch = -1 / Math.max(homeExp, awayExp, 1);
      const maxRhoMatch = Math.min(1, 1 / (homeExp * awayExp || 1));
      const safeRhoMatch = Math.max(minRhoMatch + 0.001, Math.min(maxRhoMatch - 0.001, rho));

      if (homeInt === 0 && awayInt === 0) {
        tauVal = 1 - homeExp * awayExp * safeRhoMatch;
        dt_home = (-awayExp * safeRhoMatch) / tauVal;
        dt_away = (-homeExp * safeRhoMatch) / tauVal;
        dr = weight * ((-homeExp * awayExp) / tauVal);
      } else if (homeInt === 0 && awayInt === 1) {
        tauVal = 1 + homeExp * safeRhoMatch;
        dt_home = safeRhoMatch / tauVal;
        dr = weight * (homeExp / tauVal);
      } else if (homeInt === 1 && awayInt === 0) {
        tauVal = 1 + awayExp * safeRhoMatch;
        dt_away = safeRhoMatch / tauVal;
        dr = weight * (awayExp / tauVal);
      } else if (homeInt === 1 && awayInt === 1) {
        tauVal = 1 - safeRhoMatch;
        dr = weight * (-1 / tauVal);
      }

      currentLL +=
        weight *
        (homeTarget * Math.log(homeExp) -
          homeExp +
          awayTarget * Math.log(awayExp) -
          awayExp +
          Math.log(Math.max(tauVal, MODEL_CONFIG.PROBABILITY_FLOOR)));

      const gradHome = weight * (dL_home + dt_home);
      const gradAway = weight * (dL_away + dt_away);

      gradientAttack[home] += gradHome * def[away] * gamma * leagueBase;
      gradientDefense[away] += gradHome * atk[home] * gamma * leagueBase;
      gradientAttack[away] += gradAway * def[home] * leagueBase;
      gradientDefense[home] += gradAway * atk[away] * leagueBase;

      gradientGamma += gradHome * atk[home] * def[away] * leagueBase;
      gradientRho += dr;
    }

    let meanDef = 0;
    for (let t = 0; t < numTeams; t++) meanDef += def[t];
    meanDef /= numTeams;

    let regPenalty = 0;
    for (let t = 0; t < numTeams; t++) {
      regPenalty += REG_LAMBDA * (Math.pow(atk[t] - 1, 2) + Math.pow(def[t] - meanDef, 2));
    }

    const currentObjective = currentLL - regPenalty;
    if (iter > 10 && Math.abs(currentObjective - prevObjective) < 1e-6) break;
    prevObjective = currentObjective;

    for (let t = 0; t < numTeams; t++) {
      const denom = Math.max(teamWeight[t], 1.0);
      const penaltyA = -2 * REG_LAMBDA * (atk[t] - 1);
      const penaltyD = -2 * REG_LAMBDA * (def[t] - meanDef);

      atk[t] = Math.max(0.2, Math.min(3.0, atk[t] + lr * (gradientAttack[t] + penaltyA) / denom));
      def[t] = Math.max(0.2, Math.min(3.0, def[t] + lr * (gradientDefense[t] + penaltyD) / denom));
    }

    let sumA = 0;
    for (let t = 0; t < numTeams; t++) sumA += atk[t];
    const currentAvgA = sumA / numTeams;
    for (let t = 0; t < numTeams; t++) {
      atk[t] /= currentAvgA;
      def[t] *= currentAvgA;
    }

    gamma = Math.max(0.8, Math.min(2.0, gamma + lr * gradientGamma / safeTotalWeight));
    rho = Math.max(-0.5, Math.min(0.0, rho + lr * gradientRho / safeTotalWeight));
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

  return { homeAdvantage: gamma, rho, leagueBase, teams: result, matchesUsed: n };
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
  const leagueBase = getLeagueBase(league);
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
      leagueBase,
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
      leagueBase,
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
    homeShots: m.homeShots,
    awayShots: m.awayShots,
    homeShotsOnTarget: m.homeShotsOnTarget,
    awayShotsOnTarget: m.awayShotsOnTarget,
    hasRedCard: m.hasRedCard,
    daysAgo: Math.max(0, (cutoff - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  const params = fitDixonColes(matches, leagueBase);
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

  const leagueBase = fitted.leagueBase ?? BASE_GOALS;
  let lambdaHome = homeParams.attack * awayParams.defense * fitted.homeAdvantage * leagueBase;
  let muAway = awayParams.attack * homeParams.defense * leagueBase;

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
