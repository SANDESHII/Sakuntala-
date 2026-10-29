/**
 * Team stats with historical statistics
 */
export const TEAM_STATS: Record<string, {
  attackStrength: number;
  defenseStrength: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  homeAdvantageHeuristic: number;
  form: number[];
  cleanSheetRate: number;
}> = {
  'ARSENAL': { attackStrength: 1.42, defenseStrength: 0.72, avgGoalsScored: 2.1, avgGoalsConceded: 0.9, homeAdvantageHeuristic: 0.32, form: [3,1,3,1,0], cleanSheetRate: 0.45 },
  'MAN_CITY': { attackStrength: 1.55, defenseStrength: 0.68, avgGoalsScored: 2.4, avgGoalsConceded: 0.85, homeAdvantageHeuristic: 0.35, form: [3,3,1,3,3], cleanSheetRate: 0.50 },
  'LIVERPOOL': { attackStrength: 1.48, defenseStrength: 0.75, avgGoalsScored: 2.2, avgGoalsConceded: 1.0, homeAdvantageHeuristic: 0.38, form: [3,3,3,1,3], cleanSheetRate: 0.40 },
  'CHELSEA': { attackStrength: 1.25, defenseStrength: 0.88, avgGoalsScored: 1.7, avgGoalsConceded: 1.2, homeAdvantageHeuristic: 0.28, form: [1,3,0,1,3], cleanSheetRate: 0.30 },
  'TOTTENHAM': { attackStrength: 1.30, defenseStrength: 0.92, avgGoalsScored: 1.8, avgGoalsConceded: 1.3, homeAdvantageHeuristic: 0.30, form: [3,0,1,3,1], cleanSheetRate: 0.25 },
  'MAN_UTD': { attackStrength: 1.15, defenseStrength: 0.95, avgGoalsScored: 1.5, avgGoalsConceded: 1.35, homeAdvantageHeuristic: 0.25, form: [0,1,3,0,1], cleanSheetRate: 0.22 },
  'REAL_MADRID': { attackStrength: 1.50, defenseStrength: 0.70, avgGoalsScored: 2.3, avgGoalsConceded: 0.88, homeAdvantageHeuristic: 0.38, form: [3,3,1,3,3], cleanSheetRate: 0.48 },
  'BARCELONA': { attackStrength: 1.55, defenseStrength: 0.78, avgGoalsScored: 2.5, avgGoalsConceded: 1.0, homeAdvantageHeuristic: 0.35, form: [3,3,3,1,3], cleanSheetRate: 0.42 },
  'PSG': { attackStrength: 1.65, defenseStrength: 0.70, avgGoalsScored: 2.7, avgGoalsConceded: 0.85, homeAdvantageHeuristic: 0.40, form: [3,3,3,3,1], cleanSheetRate: 0.55 },
  'BAYERN': { attackStrength: 1.60, defenseStrength: 0.75, avgGoalsScored: 2.6, avgGoalsConceded: 0.9, homeAdvantageHeuristic: 0.35, form: [3,1,3,3,3], cleanSheetRate: 0.45 },
  'MILAN': { attackStrength: 1.25, defenseStrength: 0.85, avgGoalsScored: 1.7, avgGoalsConceded: 1.1, homeAdvantageHeuristic: 0.30, form: [1,3,0,1,3], cleanSheetRate: 0.32 },
  'INTER': { attackStrength: 1.40, defenseStrength: 0.70, avgGoalsScored: 2.0, avgGoalsConceded: 0.8, homeAdvantageHeuristic: 0.35, form: [3,3,3,1,3], cleanSheetRate: 0.52 },
};

/**
 * Team aliases map canonical names to their common variants
 * Moved to teamIds.ts
 */

export const LEAGUE_CONFIGS: Record<string, any> = {
  'EPL': { goalRate: 1.05, homeAdvantage: 0.30 },
  'LA_LIGA': { goalRate: 0.95, homeAdvantage: 0.32 },
  'BUNDESLIGA': { goalRate: 1.15, homeAdvantage: 0.28 },
  'SERIE_A': { goalRate: 0.92, homeAdvantage: 0.35 },
  'LIGUE_1': { goalRate: 0.98, homeAdvantage: 0.30 },
  'STANDARD': { goalRate: 1.00, homeAdvantage: 0.28 }
};

/**
 * Model Math Constants
 */
export const TIME_DECAY_PHI = 0.0065; 
export const BASE_GOALS = 1.35;
export const DEFAULT_RHO = -0.13;
export const HOME_ADVANTAGE_WEIGHT = 0.5;
export const AWAY_DEFENSE_WEIGHT = 0.3;
export const EDGE_THRESHOLD = 0.03;
export const REG_LAMBDA = 0.5; // L2 penalty coefficient for shrinkage towards 1.0

export const DEFAULT_CLEAN_SHEET_RATE = 0.25;
export const DEFAULT_HOME_ADVANTAGE = 0.30;
export const DEFAULT_FORM = [1, 1, 1, 1, 1];

export const MODEL_CONFIG = {
  LEAGUE_AVG_GOALS: BASE_GOALS,
  EDGE_THRESHOLD: EDGE_THRESHOLD,
  MAX_LAMBDA: 4.0,
  MIN_LAMBDA: 0.3,
  MAX_MU: 3.5,
  MIN_MU: 0.2,
  KELLY_FRACTION: 0.35,
};

export const LEAGUE_MAP: Record<string, { apiId: number; oddsKey: string }> = {
  'EPL': { apiId: 39, oddsKey: 'soccer_epl' },
  'LA_LIGA': { apiId: 140, oddsKey: 'soccer_spain_la_liga' },
  'BUNDESLIGA': { apiId: 78, oddsKey: 'soccer_germany_bundesliga' },
  'SERIE_A': { apiId: 135, oddsKey: 'soccer_italy_serie_a' },
  'LIGUE_1': { apiId: 61, oddsKey: 'soccer_france_ligue_one' },
};

export const SEASON_START_MONTH: Record<string, number> = {
  'EPL': 7, 'LA_LIGA': 7, 'BUNDESLIGA': 7, 'SERIE_A': 7, 'LIGUE_1': 7,
  'MLS': 2, 'A_LEAGUE': 9,
};

