/**
 * League-specific goal rates and home advantage factors
 * Source: Historical averages from football-data.co.uk
 */
export const LEAGUE_CONFIGS: Record<string, { goalRate: number; homeAdvantage: number }> = {
  'EPL': { goalRate: 1.02, homeAdvantage: 0.28 },
  'LA_LIGA': { goalRate: 0.94, homeAdvantage: 0.32 },
  'SERIE_A': { goalRate: 0.98, homeAdvantage: 0.26 },
  'BUNDESLIGA': { goalRate: 1.12, homeAdvantage: 0.24 },
  'LIGUE_1': { goalRate: 0.92, homeAdvantage: 0.30 },
  'STANDARD': { goalRate: 1.0, homeAdvantage: 0.25 }
};

/**
 * Supported leagues
 */
export const ELITE_LEAGUES = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];

/**
 * Team database with historical statistics
 * TODO: Add source citations and date ranges for these stats
 */
export const TEAM_DATABASE: Record<string, Record<string, {
  attackStrength: number;
  defenseStrength: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgXG: number;
  avgXGA: number;
  homeBias: number;
  form: number[];
  cleanSheetRate: number;
  clinicalEdge: number;
}>> = {
  'EPL': {
    'ARSENAL': { attackStrength: 1.42, defenseStrength: 0.72, avgGoalsScored: 2.1, avgGoalsConceded: 0.9, avgXG: 2.05, avgXGA: 0.95, homeBias: 0.32, form: [3,1,3,1,0], cleanSheetRate: 0.45, clinicalEdge: 1.08 },
    'MAN CITY': { attackStrength: 1.55, defenseStrength: 0.68, avgGoalsScored: 2.4, avgGoalsConceded: 0.85, avgXG: 2.35, avgXGA: 0.92, homeBias: 0.35, form: [3,3,1,3,3], cleanSheetRate: 0.50, clinicalEdge: 1.12 },
    'LIVERPOOL': { attackStrength: 1.48, defenseStrength: 0.75, avgGoalsScored: 2.2, avgGoalsConceded: 1.0, avgXG: 2.15, avgXGA: 1.05, homeBias: 0.38, form: [3,3,3,1,3], cleanSheetRate: 0.40, clinicalEdge: 1.05 },
    'CHELSEA': { attackStrength: 1.25, defenseStrength: 0.88, avgGoalsScored: 1.7, avgGoalsConceded: 1.2, avgXG: 1.65, avgXGA: 1.25, homeBias: 0.28, form: [1,3,0,1,3], cleanSheetRate: 0.30, clinicalEdge: 0.98 },
    'TOTTENHAM': { attackStrength: 1.30, defenseStrength: 0.92, avgGoalsScored: 1.8, avgGoalsConceded: 1.3, avgXG: 1.75, avgXGA: 1.35, homeBias: 0.30, form: [3,0,1,3,1], cleanSheetRate: 0.25, clinicalEdge: 1.02 },
  },
  'LA_LIGA': {
    'REAL MADRID': { attackStrength: 1.50, defenseStrength: 0.70, avgGoalsScored: 2.3, avgGoalsConceded: 0.88, avgXG: 2.25, avgXGA: 0.92, homeBias: 0.38, form: [3,3,1,3,3], cleanSheetRate: 0.48, clinicalEdge: 1.10 },
    'BARCELONA': { attackStrength: 1.55, defenseStrength: 0.78, avgGoalsScored: 2.5, avgGoalsConceded: 1.0, avgXG: 2.40, avgXGA: 1.05, homeBias: 0.35, form: [3,3,3,1,3], cleanSheetRate: 0.42, clinicalEdge: 1.15 },
  },
  'BUNDESLIGA': {
    'BAYERN': { attackStrength: 1.60, defenseStrength: 0.72, avgGoalsScored: 2.6, avgGoalsConceded: 0.95, avgXG: 2.50, avgXGA: 1.00, homeBias: 0.35, form: [3,3,3,3,1], cleanSheetRate: 0.45, clinicalEdge: 1.18 },
  },
  'SERIE_A': {
    'INTER': { attackStrength: 1.40, defenseStrength: 0.68, avgGoalsScored: 2.0, avgGoalsConceded: 0.82, avgXG: 1.95, avgXGA: 0.88, homeBias: 0.32, form: [3,3,1,3,3], cleanSheetRate: 0.52, clinicalEdge: 1.08 },
  },
  'LIGUE_1': {
    'PSG': { attackStrength: 1.65, defenseStrength: 0.70, avgGoalsScored: 2.7, avgGoalsConceded: 0.85, avgXG: 2.60, avgXGA: 0.90, homeBias: 0.40, form: [3,3,3,3,1], cleanSheetRate: 0.55, clinicalEdge: 1.20 },
  }
};
