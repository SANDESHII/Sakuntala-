/**
 * Static Dixon-Coles fallback strength multipliers (1.0 = league average)
 * Used only when historical MLE sample is insufficient.
 */
export const TEAM_STATS: Record<string, {
  attackStrength: number;
  defenseStrength: number;
}> = {
  // EPL
  'ARSENAL': { attackStrength: 1.44, defenseStrength: 0.70 },
  'MAN_CITY': { attackStrength: 1.56, defenseStrength: 0.68 },
  'LIVERPOOL': { attackStrength: 1.50, defenseStrength: 0.74 },
  'CHELSEA': { attackStrength: 1.28, defenseStrength: 0.86 },
  'TOTTENHAM': { attackStrength: 1.32, defenseStrength: 0.94 },
  'MAN_UTD': { attackStrength: 1.16, defenseStrength: 0.94 },
  'NEWCASTLE': { attackStrength: 1.26, defenseStrength: 0.88 },
  'ASTON_VILLA': { attackStrength: 1.24, defenseStrength: 0.90 },
  'BRIGHTON': { attackStrength: 1.18, defenseStrength: 0.96 },
  'WEST_HAM': { attackStrength: 1.06, defenseStrength: 1.04 },
  'BRENTFORD': { attackStrength: 1.12, defenseStrength: 1.02 },
  'BOURNEMOUTH': { attackStrength: 1.08, defenseStrength: 1.02 },
  'FULHAM': { attackStrength: 1.04, defenseStrength: 0.98 },
  'CRYSTAL_PALACE': { attackStrength: 0.98, defenseStrength: 0.98 },
  'NOTTINGHAM_FOREST': { attackStrength: 1.02, defenseStrength: 0.95 },
  'EVERTON': { attackStrength: 0.88, defenseStrength: 0.96 },
  'WOLVES': { attackStrength: 0.94, defenseStrength: 1.08 },
  // La Liga
  'REAL_MADRID': { attackStrength: 1.52, defenseStrength: 0.70 },
  'BARCELONA': { attackStrength: 1.56, defenseStrength: 0.76 },
  'ATLETICO': { attackStrength: 1.32, defenseStrength: 0.74 },
  'ATHLETIC_BILBAO': { attackStrength: 1.18, defenseStrength: 0.82 },
  'VILLARREAL': { attackStrength: 1.22, defenseStrength: 0.96 },
  'REAL_SOCIEDAD': { attackStrength: 1.10, defenseStrength: 0.86 },
  'BETIS': { attackStrength: 1.08, defenseStrength: 0.92 },
  'GIRONA': { attackStrength: 1.20, defenseStrength: 0.98 },
  'SEVILLA': { attackStrength: 0.98, defenseStrength: 1.00 },
  'VALENCIA': { attackStrength: 0.94, defenseStrength: 0.98 },
  // Bundesliga
  'BAYERN': { attackStrength: 1.64, defenseStrength: 0.74 },
  'LEVERKUSEN': { attackStrength: 1.48, defenseStrength: 0.78 },
  'DORTMUND': { attackStrength: 1.36, defenseStrength: 0.90 },
  'RB_LEIPZIG': { attackStrength: 1.32, defenseStrength: 0.88 },
  'STUTTGART': { attackStrength: 1.28, defenseStrength: 0.92 },
  'FRANKFURT': { attackStrength: 1.22, defenseStrength: 0.96 },
  'FREIBURG': { attackStrength: 1.06, defenseStrength: 0.96 },
  'WOLFSBURG': { attackStrength: 1.04, defenseStrength: 1.02 },
  // Serie A
  'INTER': { attackStrength: 1.46, defenseStrength: 0.68 },
  'NAPOLI': { attackStrength: 1.32, defenseStrength: 0.78 },
  'ATALANTA': { attackStrength: 1.38, defenseStrength: 0.86 },
  'JUVENTUS': { attackStrength: 1.20, defenseStrength: 0.74 },
  'MILAN': { attackStrength: 1.26, defenseStrength: 0.86 },
  'LAZIO': { attackStrength: 1.18, defenseStrength: 0.90 },
  'ROMA': { attackStrength: 1.14, defenseStrength: 0.88 },
  'FIORENTINA': { attackStrength: 1.14, defenseStrength: 0.90 },
  'BOLOGNA': { attackStrength: 1.10, defenseStrength: 0.88 },
  // Ligue 1
  'PSG': { attackStrength: 1.66, defenseStrength: 0.70 },
  'MONACO': { attackStrength: 1.34, defenseStrength: 0.90 },
  'MARSEILLE': { attackStrength: 1.28, defenseStrength: 0.92 },
  'LILLE': { attackStrength: 1.22, defenseStrength: 0.84 },
  'LYON': { attackStrength: 1.20, defenseStrength: 0.96 },
  'NICE': { attackStrength: 1.12, defenseStrength: 0.84 },
  'LENS': { attackStrength: 1.10, defenseStrength: 0.88 },
  'RENNES': { attackStrength: 1.08, defenseStrength: 0.98 },
};

interface LeagueConfig {
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
export const BASE_GOALS = 1.35;
export const DEFAULT_RHO = -0.13;
export const HOME_ADVANTAGE_WEIGHT = 0.5;
export const AWAY_DEFENSE_WEIGHT = 0.3;
export const REG_LAMBDA = 0.5;

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

export const DECISION_LEAD_MS = 24 * 60 * 60 * 1000;

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
  CSV_TIMEOUT_MS: 12000,
  CSV_RETRIES: 1,
};
