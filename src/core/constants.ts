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
  'FINLAND': { attackStrength: 0.85, defenseStrength: 1.15, avgGoalsScored: 0.9, avgGoalsConceded: 1.4, homeAdvantageHeuristic: 0.25, form: [0,1,0,3,0], cleanSheetRate: 0.20 },
  'ENGLAND': { attackStrength: 1.45, defenseStrength: 0.75, avgGoalsScored: 2.1, avgGoalsConceded: 0.9, homeAdvantageHeuristic: 0.35, form: [3,3,1,3,1], cleanSheetRate: 0.45 },
  'FRANCE': { attackStrength: 1.50, defenseStrength: 0.70, avgGoalsScored: 2.3, avgGoalsConceded: 0.8, homeAdvantageHeuristic: 0.38, form: [3,1,3,3,3], cleanSheetRate: 0.48 },
  'BELARUS': { attackStrength: 0.70, defenseStrength: 1.25, avgGoalsScored: 0.7, avgGoalsConceded: 1.6, homeAdvantageHeuristic: 0.20, form: [0,1,1,0,0], cleanSheetRate: 0.15 },
};

/**
 * Team aliases map canonical names to their common variants
 */
export const TEAM_ALIASES: Record<string, string> = {
  'MANCHESTER CITY': 'MAN_CITY',
  'MAN CITY': 'MAN_CITY',
  'MANCHESTER UNITED': 'MAN_UTD',
  'MAN UTD': 'MAN_UTD',
  'ATHLETIC CLUB': 'ATHLETIC_BILBAO',
  'SPURS': 'TOTTENHAM',
  'PSG': 'PSG',
  'PARIS SG': 'PSG',
  'FIN': 'FINLAND',
  'ENG': 'ENGLAND',
  'FRA': 'FRANCE',
  'BLR': 'BELARUS',
};

export const LEAGUE_CONFIGS: Record<string, any> = {
  'EPL': { goalRate: 1.05, homeAdvantage: 0.30 },
  'LA_LIGA': { goalRate: 0.95, homeAdvantage: 0.32 },
  'BUNDESLIGA': { goalRate: 1.15, homeAdvantage: 0.28 },
  'SERIE_A': { goalRate: 0.92, homeAdvantage: 0.35 },
  'LIGUE_1': { goalRate: 0.98, homeAdvantage: 0.30 },
  'NATIONS_LEAGUE': { goalRate: 0.88, homeAdvantage: 0.25 },
  'STANDARD': { goalRate: 1.00, homeAdvantage: 0.28 }
};

export const ELITE_LEAGUES = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];

/**
 * Model Math Constants
 */
export const TIME_DECAY_PHI = 0.0065; 
export const BASE_GOALS = 1.35;
export const DEFAULT_RHO = -0.13;
export const HOME_ADVANTAGE_GAMMA = 1.25;
