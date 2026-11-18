/**
 * Static Dixon-Coles fallback strength multipliers (1.0 = league average)
 * Used only when historical MLE sample is insufficient.
 */
export const TEAM_STATS: Record<string, {
  attackStrength: number;
  defenseStrength: number;
}> = {
  'ARSENAL': { attackStrength: 1.42, defenseStrength: 0.72 },
  'MAN_CITY': { attackStrength: 1.55, defenseStrength: 0.68 },
  'LIVERPOOL': { attackStrength: 1.48, defenseStrength: 0.75 },
  'CHELSEA': { attackStrength: 1.25, defenseStrength: 0.88 },
  'TOTTENHAM': { attackStrength: 1.30, defenseStrength: 0.92 },
  'MAN_UTD': { attackStrength: 1.15, defenseStrength: 0.95 },
  'REAL_MADRID': { attackStrength: 1.50, defenseStrength: 0.70 },
  'BARCELONA': { attackStrength: 1.55, defenseStrength: 0.78 },
  'PSG': { attackStrength: 1.65, defenseStrength: 0.70 },
  'BAYERN': { attackStrength: 1.60, defenseStrength: 0.75 },
  'MILAN': { attackStrength: 1.25, defenseStrength: 0.85 },
  'INTER': { attackStrength: 1.40, defenseStrength: 0.70 },
};

export interface LeagueConfig {
  goalRate: number;
  homeAdvantage: number;
}

export const LEAGUE_CONFIGS: Record<string, LeagueConfig> = {
  'EPL': { goalRate: 1.05, homeAdvantage: 0.30 },
  'LA_LIGA': { goalRate: 0.95, homeAdvantage: 0.32 },
  'BUNDESLIGA': { goalRate: 1.15, homeAdvantage: 0.28 },
  'SERIE_A': { goalRate: 0.92, homeAdvantage: 0.35 },
  'LIGUE_1': { goalRate: 0.98, homeAdvantage: 0.30 },
  'STANDARD': { goalRate: 1.00, homeAdvantage: 0.28 },
};

/**
 * Model Math Constants
 */
export const TIME_DECAY_PHI = 0.0065 / 3.5; // 0.001857/day — Dixon & Coles (1997)
// published xi = 0.0065 in HALF-WEEK units (3.5 days), not per day.
export const BASE_GOALS = 1.35;
export const DEFAULT_RHO = -0.13;
export const HOME_ADVANTAGE_WEIGHT = 0.5;
export const AWAY_DEFENSE_WEIGHT = 0.3;
export const REG_LAMBDA = 0.5; // L2 penalty coefficient for shrinkage towards 1.0

export const MODEL_CONFIG = {
  EDGE_THRESHOLD: 0.03,
  MAX_LAMBDA: 4.0,
  MIN_LAMBDA: 0.3,
  MAX_MU: 3.5,
  MIN_MU: 0.2,
  KELLY_FRACTION: 0.35,
  MAX_KELLY_STAKE: 0.05,
  HOME_ADVANTAGE_GAMMA: 1.25,
  DEFAULT_FIT_ITERATIONS: 500,
  DEFAULT_LEARNING_RATE: 0.01,
  PROBABILITY_FLOOR: 1e-10,
};

export const LEAGUE_MAP: Record<string, { apiId: number; oddsKey: string }> = {
  'EPL': { apiId: 39, oddsKey: 'soccer_epl' },
  'LA_LIGA': { apiId: 140, oddsKey: 'soccer_spain_la_liga' },
  'BUNDESLIGA': { apiId: 78, oddsKey: 'soccer_germany_bundesliga' },
  'SERIE_A': { apiId: 135, oddsKey: 'soccer_italy_serie_a' },
  'LIGUE_1': { apiId: 61, oddsKey: 'soccer_france_ligue_one' },
};

export const SEASON_START_MONTH: Record<string, number> = {
  'EPL': 7,
  'LA_LIGA': 7,
  'BUNDESLIGA': 7,
  'SERIE_A': 7,
  'LIGUE_1': 7,
};

export const DECISION_LEAD_MS = 24 * 60 * 60 * 1000; // 24h before kickoff -> "taken" snapshot

export const BACKTEST_CONFIG = {
  TRAIN_SEASONS: ['2122', '2223', '2324'] as readonly string[],
  EVAL_SEASONS: ['2324', '2425'] as readonly string[],
  LEAGUES: ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'] as readonly string[],
  DIVISION_MAP: {
    EPL: 'E0',
    LA_LIGA: 'SP1',
    BUNDESLIGA: 'D1',
    SERIE_A: 'I1',
    LIGUE_1: 'F1',
  } as Record<string, string>,
  CSV_BASE_URL: 'https://www.football-data.co.uk/mmz4281',
  CSV_TIMEOUT_MS: 15000,
  CSV_RETRIES: 2,
};
