/**
 * Team stats with historical statistics
 */
export const TEAM_STATS: Record<string, {
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
}> = {
  'ARSENAL': { attackStrength: 1.42, defenseStrength: 0.72, avgGoalsScored: 2.1, avgGoalsConceded: 0.9, avgXG: 2.05, avgXGA: 0.95, homeBias: 0.32, form: [3,1,3,1,0], cleanSheetRate: 0.45, clinicalEdge: 1.08 },
  'MAN_CITY': { attackStrength: 1.55, defenseStrength: 0.68, avgGoalsScored: 2.4, avgGoalsConceded: 0.85, avgXG: 2.35, avgXGA: 0.92, homeBias: 0.35, form: [3,3,1,3,3], cleanSheetRate: 0.50, clinicalEdge: 1.12 },
  'LIVERPOOL': { attackStrength: 1.48, defenseStrength: 0.75, avgGoalsScored: 2.2, avgGoalsConceded: 1.0, avgXG: 2.15, avgXGA: 1.05, homeBias: 0.38, form: [3,3,3,1,3], cleanSheetRate: 0.40, clinicalEdge: 1.05 },
  'CHELSEA': { attackStrength: 1.25, defenseStrength: 0.88, avgGoalsScored: 1.7, avgGoalsConceded: 1.2, avgXG: 1.65, avgXGA: 1.25, homeBias: 0.28, form: [1,3,0,1,3], cleanSheetRate: 0.30, clinicalEdge: 0.98 },
  'TOTTENHAM': { attackStrength: 1.30, defenseStrength: 0.92, avgGoalsScored: 1.8, avgGoalsConceded: 1.3, avgXG: 1.75, avgXGA: 1.35, homeBias: 0.30, form: [3,0,1,3,1], cleanSheetRate: 0.25, clinicalEdge: 1.02 },
  'MAN_UTD': { attackStrength: 1.15, defenseStrength: 0.95, avgGoalsScored: 1.5, avgGoalsConceded: 1.35, avgXG: 1.45, avgXGA: 1.40, homeBias: 0.25, form: [0,1,3,0,1], cleanSheetRate: 0.22, clinicalEdge: 0.95 },
  'NEWCASTLE': { attackStrength: 1.20, defenseStrength: 0.82, avgGoalsScored: 1.6, avgGoalsConceded: 1.1, avgXG: 1.55, avgXGA: 1.15, homeBias: 0.35, form: [3,1,1,3,0], cleanSheetRate: 0.32, clinicalEdge: 1.00 },
  'ASTON_VILLA': { attackStrength: 1.28, defenseStrength: 0.85, avgGoalsScored: 1.75, avgGoalsConceded: 1.15, avgXG: 1.70, avgXGA: 1.20, homeBias: 0.30, form: [3,3,1,0,3], cleanSheetRate: 0.28, clinicalEdge: 1.04 },
  'BRIGHTON': { attackStrength: 1.18, defenseStrength: 0.90, avgGoalsScored: 1.55, avgGoalsConceded: 1.25, avgXG: 1.50, avgXGA: 1.30, homeBias: 0.22, form: [1,0,3,1,1], cleanSheetRate: 0.20, clinicalEdge: 0.97 },
  'WEST_HAM': { attackStrength: 1.05, defenseStrength: 1.02, avgGoalsScored: 1.3, avgGoalsConceded: 1.5, avgXG: 1.25, avgXGA: 1.25, homeBias: 0.28, form: [0,1,0,3,1], cleanSheetRate: 0.18, clinicalEdge: 0.92 },
  'BRENTFORD': { attackStrength: 1.12, defenseStrength: 0.95, avgGoalsScored: 1.45, avgGoalsConceded: 1.35, avgXG: 1.40, avgXGA: 1.40, homeBias: 0.25, form: [1,0,1,3,1], cleanSheetRate: 0.20, clinicalEdge: 0.95 },
  'CRYSTAL_PALACE': { attackStrength: 1.02, defenseStrength: 0.98, avgGoalsScored: 1.25, avgGoalsConceded: 1.4, avgXG: 1.20, avgXGA: 1.45, homeBias: 0.25, form: [0,1,0,1,3], cleanSheetRate: 0.18, clinicalEdge: 0.90 },
  'EVERTON': { attackStrength: 0.95, defenseStrength: 1.05, avgGoalsScored: 1.1, avgGoalsConceded: 1.6, avgXG: 1.05, avgXGA: 1.65, homeBias: 0.28, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.85 },
  'FULHAM': { attackStrength: 1.08, defenseStrength: 0.95, avgGoalsScored: 1.35, avgGoalsConceded: 1.35, avgXG: 1.30, avgXGA: 1.40, homeBias: 0.25, form: [1,1,0,3,1], cleanSheetRate: 0.22, clinicalEdge: 0.93 },
  'WOLVES': { attackStrength: 1.00, defenseStrength: 1.00, avgGoalsScored: 1.2, avgGoalsConceded: 1.45, avgXG: 1.15, avgXGA: 1.50, homeBias: 0.25, form: [0,1,0,1,0], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'BOURNEMOUTH': { attackStrength: 1.05, defenseStrength: 1.00, avgGoalsScored: 1.3, avgGoalsConceded: 1.45, avgXG: 1.25, avgXGA: 1.50, homeBias: 0.25, form: [1,0,1,0,3], cleanSheetRate: 0.18, clinicalEdge: 0.90 },
  'NOTTINGHAM_FOREST': { attackStrength: 1.08, defenseStrength: 0.92, avgGoalsScored: 1.35, avgGoalsConceded: 1.25, avgXG: 1.30, avgXGA: 1.30, homeBias: 0.28, form: [1,3,0,1,1], cleanSheetRate: 0.25, clinicalEdge: 0.95 },
  'REAL_MADRID': { attackStrength: 1.50, defenseStrength: 0.70, avgGoalsScored: 2.3, avgGoalsConceded: 0.88, avgXG: 2.25, avgXGA: 0.92, homeBias: 0.38, form: [3,3,1,3,3], cleanSheetRate: 0.48, clinicalEdge: 1.10 },
  'BARCELONA': { attackStrength: 1.55, defenseStrength: 0.78, avgGoalsScored: 2.5, avgGoalsConceded: 1.0, avgXG: 2.40, avgXGA: 1.05, homeBias: 0.35, form: [3,3,3,1,3], cleanSheetRate: 0.42, clinicalEdge: 1.15 },
  'ATLETICO': { attackStrength: 1.15, defenseStrength: 0.65, avgGoalsScored: 1.5, avgGoalsConceded: 0.75, avgXG: 1.45, avgXGA: 0.80, homeBias: 0.32, form: [1,3,1,1,3], cleanSheetRate: 0.55, clinicalEdge: 0.95 },
  'SEVILLA': { attackStrength: 1.05, defenseStrength: 0.92, avgGoalsScored: 1.3, avgGoalsConceded: 1.25, avgXG: 1.25, avgXGA: 1.30, homeBias: 0.28, form: [0,1,1,0,3], cleanSheetRate: 0.25, clinicalEdge: 0.90 },
  'REAL_SOCIEDAD': { attackStrength: 1.12, defenseStrength: 0.85, avgGoalsScored: 1.45, avgGoalsConceded: 1.1, avgXG: 1.40, avgXGA: 1.15, homeBias: 0.30, form: [1,1,3,0,1], cleanSheetRate: 0.30, clinicalEdge: 0.98 },
  'VILLARREAL': { attackStrength: 1.20, defenseStrength: 0.88, avgGoalsScored: 1.6, avgGoalsConceded: 1.15, avgXG: 1.55, avgXGA: 1.20, homeBias: 0.28, form: [3,1,0,3,1], cleanSheetRate: 0.28, clinicalEdge: 1.02 },
  'ATHLETIC_BILBAO': { attackStrength: 1.15, defenseStrength: 0.82, avgGoalsScored: 1.45, avgGoalsConceded: 1.05, avgXG: 1.40, avgXGA: 1.10, homeBias: 0.35, form: [1,3,1,1,3], cleanSheetRate: 0.32, clinicalEdge: 0.98 },
  'BETIS': { attackStrength: 1.10, defenseStrength: 0.90, avgGoalsScored: 1.4, avgGoalsConceded: 1.2, avgXG: 1.35, avgXGA: 1.25, homeBias: 0.28, form: [1,0,3,1,1], cleanSheetRate: 0.25, clinicalEdge: 0.95 },
  'VALENCIA': { attackStrength: 1.05, defenseStrength: 0.95, avgGoalsScored: 1.3, avgGoalsConceded: 1.3, avgXG: 1.25, avgXGA: 1.35, homeBias: 0.28, form: [0,1,1,0,3], cleanSheetRate: 0.22, clinicalEdge: 0.92 },
  'GETAFE': { attackStrength: 0.95, defenseStrength: 0.95, avgGoalsScored: 1.1, avgGoalsConceded: 1.3, avgXG: 1.05, avgXGA: 1.35, homeBias: 0.25, form: [0,1,0,1,1], cleanSheetRate: 0.20, clinicalEdge: 0.88 },
  'CELTA_VIGO': { attackStrength: 1.05, defenseStrength: 0.98, avgGoalsScored: 1.3, avgGoalsConceded: 1.4, avgXG: 1.25, avgXGA: 1.45, homeBias: 0.25, form: [1,0,1,0,3], cleanSheetRate: 0.18, clinicalEdge: 0.90 },
  'GIRONA': { attackStrength: 1.18, defenseStrength: 0.88, avgGoalsScored: 1.55, avgGoalsConceded: 1.15, avgXG: 1.50, avgXGA: 1.20, homeBias: 0.28, form: [3,1,3,1,0], cleanSheetRate: 0.28, clinicalEdge: 1.00 },
  'OSASUNA': { attackStrength: 1.00, defenseStrength: 0.95, avgGoalsScored: 1.2, avgGoalsConceded: 1.3, avgXG: 1.15, avgXGA: 1.35, homeBias: 0.28, form: [1,0,1,1,0], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'LAS_PALMAS': { attackStrength: 0.98, defenseStrength: 1.00, avgGoalsScored: 1.15, avgGoalsConceded: 1.4, avgXG: 1.10, avgXGA: 1.45, homeBias: 0.25, form: [0,1,0,1,1], cleanSheetRate: 0.18, clinicalEdge: 0.88 },
  'MALLORCA': { attackStrength: 0.95, defenseStrength: 0.98, avgGoalsScored: 1.1, avgGoalsConceded: 1.35, avgXG: 1.05, avgXGA: 1.40, homeBias: 0.25, form: [0,1,0,1,0], cleanSheetRate: 0.18, clinicalEdge: 0.85 },
  'ALAVES': { attackStrength: 0.92, defenseStrength: 1.02, avgGoalsScored: 1.05, avgGoalsConceded: 1.45, avgXG: 1.00, avgXGA: 1.50, homeBias: 0.25, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.85 },
  'CADIZ': { attackStrength: 0.88, defenseStrength: 1.05, avgGoalsScored: 0.95, avgGoalsConceded: 1.55, avgXG: 0.90, avgXGA: 1.60, homeBias: 0.25, form: [0,0,0,1,0], cleanSheetRate: 0.12, clinicalEdge: 0.82 },
  'GRANADA': { attackStrength: 0.90, defenseStrength: 1.05, avgGoalsScored: 1.0, avgGoalsConceded: 1.55, avgXG: 0.95, avgXGA: 1.60, homeBias: 0.25, form: [0,0,1,0,0], cleanSheetRate: 0.12, clinicalEdge: 0.82 },
  'ALMERIA': { attackStrength: 0.85, defenseStrength: 1.08, avgGoalsScored: 0.9, avgGoalsConceded: 1.65, avgXG: 0.85, avgXGA: 1.70, homeBias: 0.25, form: [0,0,0,0,1], cleanSheetRate: 0.10, clinicalEdge: 0.80 },
  'BAYERN': { attackStrength: 1.60, defenseStrength: 0.72, avgGoalsScored: 2.6, avgGoalsConceded: 0.95, avgXG: 2.50, avgXGA: 1.00, homeBias: 0.35, form: [3,3,3,3,1], cleanSheetRate: 0.45, clinicalEdge: 1.18 },
  'DORTMUND': { attackStrength: 1.38, defenseStrength: 0.88, avgGoalsScored: 2.0, avgGoalsConceded: 1.2, avgXG: 1.95, avgXGA: 1.25, homeBias: 0.32, form: [3,1,3,0,3], cleanSheetRate: 0.30, clinicalEdge: 1.05 },
  'LEVERKUSEN': { attackStrength: 1.45, defenseStrength: 0.75, avgGoalsScored: 2.2, avgGoalsConceded: 0.9, avgXG: 2.15, avgXGA: 0.95, homeBias: 0.30, form: [3,3,3,1,3], cleanSheetRate: 0.42, clinicalEdge: 1.10 },
  'RB_LEIPZIG': { attackStrength: 1.30, defenseStrength: 0.82, avgGoalsScored: 1.85, avgGoalsConceded: 1.05, avgXG: 1.80, avgXGA: 1.10, homeBias: 0.28, form: [3,1,1,3,3], cleanSheetRate: 0.35, clinicalEdge: 1.02 },
  'STUTTGART': { attackStrength: 1.22, defenseStrength: 0.90, avgGoalsScored: 1.7, avgGoalsConceded: 1.2, avgXG: 1.65, avgXGA: 1.25, homeBias: 0.26, form: [1,3,0,1,3], cleanSheetRate: 0.25, clinicalEdge: 0.98 },
  'FRANKFURT': { attackStrength: 1.20, defenseStrength: 0.88, avgGoalsScored: 1.65, avgGoalsConceded: 1.15, avgXG: 1.60, avgXGA: 1.20, homeBias: 0.28, form: [3,1,0,3,1], cleanSheetRate: 0.28, clinicalEdge: 1.00 },
  'WOLFSBURG': { attackStrength: 1.10, defenseStrength: 0.92, avgGoalsScored: 1.4, avgGoalsConceded: 1.25, avgXG: 1.35, avgXGA: 1.30, homeBias: 0.26, form: [1,0,1,3,1], cleanSheetRate: 0.22, clinicalEdge: 0.95 },
  'GLADBACH': { attackStrength: 1.12, defenseStrength: 0.95, avgGoalsScored: 1.45, avgGoalsConceded: 1.3, avgXG: 1.40, avgXGA: 1.35, homeBias: 0.26, form: [1,0,3,1,0], cleanSheetRate: 0.20, clinicalEdge: 0.93 },
  'FREIBURG': { attackStrength: 1.08, defenseStrength: 0.92, avgGoalsScored: 1.35, avgGoalsConceded: 1.25, avgXG: 1.30, avgXGA: 1.30, homeBias: 0.28, form: [1,1,0,3,1], cleanSheetRate: 0.22, clinicalEdge: 0.93 },
  'HOFFENHEIM': { attackStrength: 1.10, defenseStrength: 0.95, avgGoalsScored: 1.4, avgGoalsConceded: 1.3, avgXG: 1.35, avgXGA: 1.35, homeBias: 0.26, form: [0,1,3,1,0], cleanSheetRate: 0.20, clinicalEdge: 0.93 },
  'UNION_BERLIN': { attackStrength: 1.05, defenseStrength: 0.95, avgGoalsScored: 1.3, avgGoalsConceded: 1.3, avgXG: 1.25, avgXGA: 1.35, homeBias: 0.28, form: [1,0,1,0,3], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'BOCHUM': { attackStrength: 0.95, defenseStrength: 1.02, avgGoalsScored: 1.1, avgGoalsConceded: 1.45, avgXG: 1.05, avgXGA: 1.50, homeBias: 0.25, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
  'AUGSBURG': { attackStrength: 0.98, defenseStrength: 1.00, avgGoalsScored: 1.15, avgGoalsConceded: 1.4, avgXG: 1.10, avgXGA: 1.45, homeBias: 0.25, form: [0,1,0,1,1], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'MAINZ': { attackStrength: 1.00, defenseStrength: 0.98, avgGoalsScored: 1.2, avgGoalsConceded: 1.35, avgXG: 1.15, avgXGA: 1.40, homeBias: 0.26, form: [1,0,1,0,3], cleanSheetRate: 0.18, clinicalEdge: 0.90 },
  'HERTHA_BERLIN': { attackStrength: 0.95, defenseStrength: 1.05, avgGoalsScored: 1.1, avgGoalsConceded: 1.5, avgXG: 1.05, avgXGA: 1.55, homeBias: 0.25, form: [0,0,1,0,0], cleanSheetRate: 0.12, clinicalEdge: 0.85 },
  'SCHALKE': { attackStrength: 0.92, defenseStrength: 1.05, avgGoalsScored: 1.05, avgGoalsConceded: 1.5, avgXG: 1.00, avgXGA: 1.55, homeBias: 0.25, form: [0,0,0,1,0], cleanSheetRate: 0.12, clinicalEdge: 0.85 },
  'KOLN': { attackStrength: 0.95, defenseStrength: 1.02, avgGoalsScored: 1.1, avgGoalsConceded: 1.45, avgXG: 1.05, avgXGA: 1.50, homeBias: 0.25, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
  'HEIDENHEIM': { attackStrength: 0.98, defenseStrength: 1.00, avgGoalsScored: 1.15, avgGoalsConceded: 1.4, avgXG: 1.10, avgXGA: 1.45, homeBias: 0.25, form: [0,1,0,1,1], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'DARMSTADT': { attackStrength: 0.90, defenseStrength: 1.05, avgGoalsScored: 1.0, avgGoalsConceded: 1.55, avgXG: 0.95, avgXGA: 1.60, homeBias: 0.25, form: [0,0,0,1,0], cleanSheetRate: 0.12, clinicalEdge: 0.85 },
  'INTER': { attackStrength: 1.40, defenseStrength: 0.68, avgGoalsScored: 2.0, avgGoalsConceded: 0.82, avgXG: 1.95, avgXGA: 0.88, homeBias: 0.32, form: [3,3,1,3,3], cleanSheetRate: 0.52, clinicalEdge: 1.08 },
  'MILAN': { attackStrength: 1.25, defenseStrength: 0.85, avgGoalsScored: 1.7, avgGoalsConceded: 1.1, avgXG: 1.65, avgXGA: 1.15, homeBias: 0.30, form: [1,3,0,1,3], cleanSheetRate: 0.32, clinicalEdge: 1.00 },
  'JUVENTUS': { attackStrength: 1.18, defenseStrength: 0.72, avgGoalsScored: 1.55, avgGoalsConceded: 0.85, avgXG: 1.50, avgXGA: 0.90, homeBias: 0.28, form: [1,1,3,1,1], cleanSheetRate: 0.48, clinicalEdge: 0.95 },
  'NAPOLI': { attackStrength: 1.35, defenseStrength: 0.80, avgGoalsScored: 1.9, avgGoalsConceded: 1.0, avgXG: 1.85, avgXGA: 1.05, homeBias: 0.35, form: [3,3,1,0,3], cleanSheetRate: 0.38, clinicalEdge: 1.06 },
  'ROMA': { attackStrength: 1.12, defenseStrength: 0.90, avgGoalsScored: 1.45, avgGoalsConceded: 1.2, avgXG: 1.40, avgXGA: 1.25, homeBias: 0.28, form: [0,1,3,1,0], cleanSheetRate: 0.25, clinicalEdge: 0.94 },
  'LAZIO': { attackStrength: 1.20, defenseStrength: 0.85, avgGoalsScored: 1.6, avgGoalsConceded: 1.1, avgXG: 1.55, avgXGA: 1.15, homeBias: 0.30, form: [3,1,0,3,1], cleanSheetRate: 0.30, clinicalEdge: 1.00 },
  'ATALANTA': { attackStrength: 1.30, defenseStrength: 0.78, avgGoalsScored: 1.85, avgGoalsConceded: 1.0, avgXG: 1.80, avgXGA: 1.05, homeBias: 0.30, form: [3,3,1,3,0], cleanSheetRate: 0.35, clinicalEdge: 1.05 },
  'FIORENTINA': { attackStrength: 1.15, defenseStrength: 0.88, avgGoalsScored: 1.5, avgGoalsConceded: 1.15, avgXG: 1.45, avgXGA: 1.20, homeBias: 0.28, form: [1,3,0,1,3], cleanSheetRate: 0.28, clinicalEdge: 0.98 },
  'BOLOGNA': { attackStrength: 1.10, defenseStrength: 0.90, avgGoalsScored: 1.4, avgGoalsConceded: 1.2, avgXG: 1.35, avgXGA: 1.25, homeBias: 0.28, form: [1,1,3,0,1], cleanSheetRate: 0.25, clinicalEdge: 0.95 },
  'TORINO': { attackStrength: 1.05, defenseStrength: 0.92, avgGoalsScored: 1.3, avgGoalsConceded: 1.25, avgXG: 1.25, avgXGA: 1.30, homeBias: 0.28, form: [0,1,1,3,0], cleanSheetRate: 0.22, clinicalEdge: 0.93 },
  'MONZA': { attackStrength: 1.02, defenseStrength: 0.95, avgGoalsScored: 1.25, avgGoalsConceded: 1.3, avgXG: 1.20, avgXGA: 1.35, homeBias: 0.26, form: [1,0,1,0,3], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'UDINESE': { attackStrength: 1.00, defenseStrength: 0.95, avgGoalsScored: 1.2, avgGoalsConceded: 1.3, avgXG: 1.15, avgXGA: 1.35, homeBias: 0.26, form: [0,1,1,0,1], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'SASSUOLO': { attackStrength: 1.05, defenseStrength: 0.98, avgGoalsScored: 1.3, avgGoalsConceded: 1.4, avgXG: 1.25, avgXGA: 1.45, homeBias: 0.26, form: [1,0,0,3,1], cleanSheetRate: 0.18, clinicalEdge: 0.90 },
  'EMPOLI': { attackStrength: 0.98, defenseStrength: 0.98, avgGoalsScored: 1.15, avgGoalsConceded: 1.35, avgXG: 1.10, avgXGA: 1.40, homeBias: 0.26, form: [0,1,0,1,1], cleanSheetRate: 0.18, clinicalEdge: 0.88 },
  'CAGLIARI': { attackStrength: 0.95, defenseStrength: 1.00, avgGoalsScored: 1.1, avgGoalsConceded: 1.4, avgXG: 1.05, avgXGA: 1.45, homeBias: 0.26, form: [0,0,1,1,0], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'GENOA': { attackStrength: 1.00, defenseStrength: 0.95, avgGoalsScored: 1.2, avgGoalsConceded: 1.3, avgXG: 1.15, avgXGA: 1.35, homeBias: 0.28, form: [1,0,1,0,3], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'VERONA': { attackStrength: 0.98, defenseStrength: 1.00, avgGoalsScored: 1.15, avgGoalsConceded: 1.4, avgXG: 1.10, avgXGA: 1.45, homeBias: 0.26, form: [0,1,0,1,1], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'LECCE': { attackStrength: 0.95, defenseStrength: 1.02, avgGoalsScored: 1.1, avgGoalsConceded: 1.45, avgXG: 1.05, avgXGA: 1.50, homeBias: 0.26, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
  'SALERNITANA': { attackStrength: 0.90, defenseStrength: 1.05, avgGoalsScored: 1.0, avgGoalsConceded: 1.55, avgXG: 0.95, avgXGA: 1.60, homeBias: 0.26, form: [0,0,0,1,0], cleanSheetRate: 0.12, clinicalEdge: 0.85 },
  'FROSINONE': { attackStrength: 0.95, defenseStrength: 1.02, avgGoalsScored: 1.1, avgGoalsConceded: 1.45, avgXG: 1.05, avgXGA: 1.50, homeBias: 0.26, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
  'PSG': { attackStrength: 1.65, defenseStrength: 0.70, avgGoalsScored: 2.7, avgGoalsConceded: 0.85, avgXG: 2.60, avgXGA: 0.90, homeBias: 0.40, form: [3,3,3,3,1], cleanSheetRate: 0.55, clinicalEdge: 1.20 },
  'MARSEILLE': { attackStrength: 1.20, defenseStrength: 0.88, avgGoalsScored: 1.6, avgGoalsConceded: 1.15, avgXG: 1.55, avgXGA: 1.20, homeBias: 0.32, form: [3,1,0,3,1], cleanSheetRate: 0.28, clinicalEdge: 1.00 },
  'MONACO': { attackStrength: 1.28, defenseStrength: 0.85, avgGoalsScored: 1.75, avgGoalsConceded: 1.1, avgXG: 1.70, avgXGA: 1.15, homeBias: 0.28, form: [1,3,3,1,0], cleanSheetRate: 0.30, clinicalEdge: 1.04 },
  'LYON': { attackStrength: 1.22, defenseStrength: 0.92, avgGoalsScored: 1.65, avgGoalsConceded: 1.25, avgXG: 1.60, avgXGA: 1.30, homeBias: 0.30, form: [3,0,1,3,1], cleanSheetRate: 0.22, clinicalEdge: 0.98 },
  'LILLE': { attackStrength: 1.15, defenseStrength: 0.80, avgGoalsScored: 1.5, avgGoalsConceded: 1.0, avgXG: 1.45, avgXGA: 1.05, homeBias: 0.28, form: [1,1,3,1,3], cleanSheetRate: 0.35, clinicalEdge: 0.96 },
  'RENNES': { attackStrength: 1.12, defenseStrength: 0.88, avgGoalsScored: 1.45, avgGoalsConceded: 1.15, avgXG: 1.40, avgXGA: 1.20, homeBias: 0.28, form: [3,1,0,1,3], cleanSheetRate: 0.28, clinicalEdge: 0.98 },
  'NICE': { attackStrength: 1.10, defenseStrength: 0.85, avgGoalsScored: 1.4, avgGoalsConceded: 1.1, avgXG: 1.35, avgXGA: 1.15, homeBias: 0.28, form: [1,3,1,0,3], cleanSheetRate: 0.30, clinicalEdge: 0.95 },
  'LENS': { attackStrength: 1.15, defenseStrength: 0.82, avgGoalsScored: 1.5, avgGoalsConceded: 1.05, avgXG: 1.45, avgXGA: 1.10, homeBias: 0.30, form: [3,1,3,1,0], cleanSheetRate: 0.32, clinicalEdge: 1.00 },
  'STRASBOURG': { attackStrength: 1.05, defenseStrength: 0.92, avgGoalsScored: 1.3, avgGoalsConceded: 1.25, avgXG: 1.25, avgXGA: 1.30, homeBias: 0.26, form: [1,0,1,3,0], cleanSheetRate: 0.22, clinicalEdge: 0.93 },
  'TOULOUSE': { attackStrength: 1.05, defenseStrength: 0.90, avgGoalsScored: 1.3, avgGoalsConceded: 1.2, avgXG: 1.25, avgXGA: 1.25, homeBias: 0.26, form: [1,1,0,3,1], cleanSheetRate: 0.25, clinicalEdge: 0.93 },
  'MONTPELLIER': { attackStrength: 1.00, defenseStrength: 0.95, avgGoalsScored: 1.2, avgGoalsConceded: 1.3, avgXG: 1.15, avgXGA: 1.35, homeBias: 0.26, form: [0,1,1,0,3], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'NANTES': { attackStrength: 1.00, defenseStrength: 0.95, avgGoalsScored: 1.2, avgGoalsConceded: 1.3, avgXG: 1.15, avgXGA: 1.35, homeBias: 0.26, form: [1,0,1,0,1], cleanSheetRate: 0.20, clinicalEdge: 0.90 },
  'REIMS': { attackStrength: 1.02, defenseStrength: 0.92, avgGoalsScored: 1.25, avgGoalsConceded: 1.25, avgXG: 1.20, avgXGA: 1.30, homeBias: 0.26, form: [1,0,1,3,0], cleanSheetRate: 0.22, clinicalEdge: 0.90 },
  'BREST': { attackStrength: 1.08, defenseStrength: 0.90, avgGoalsScored: 1.35, avgGoalsConceded: 1.2, avgXG: 1.30, avgXGA: 1.25, homeBias: 0.28, form: [3,1,0,1,3], cleanSheetRate: 0.25, clinicalEdge: 0.95 },
  'LORIENT': { attackStrength: 0.95, defenseStrength: 1.00, avgGoalsScored: 1.1, avgGoalsConceded: 1.4, avgXG: 1.05, avgXGA: 1.45, homeBias: 0.26, form: [0,0,1,1,0], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'CLERMONT': { attackStrength: 0.92, defenseStrength: 1.02, avgGoalsScored: 1.05, avgGoalsConceded: 1.45, avgXG: 1.00, avgXGA: 1.50, homeBias: 0.26, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
  'METZ': { attackStrength: 0.95, defenseStrength: 1.00, avgGoalsScored: 1.1, avgGoalsConceded: 1.4, avgXG: 1.05, avgXGA: 1.45, homeBias: 0.26, form: [0,1,0,1,1], cleanSheetRate: 0.17, clinicalEdge: 0.88 },
  'LE_HAVRE': { attackStrength: 0.92, defenseStrength: 1.02, avgGoalsScored: 1.05, avgGoalsConceded: 1.45, avgXG: 1.00, avgXGA: 1.50, homeBias: 0.26, form: [0,0,1,0,1], cleanSheetRate: 0.15, clinicalEdge: 0.88 },
};

/**
 * Team aliases map canonical names to their common variants
 */
export const TEAM_ALIASES: Record<string, string> = {
  'MANCHESTER CITY': 'MAN_CITY',
  'MAN CITY': 'MAN_CITY',
  'SPURS': 'TOTTENHAM',
  'MANCHESTER UNITED': 'MAN_UTD',
  'MAN UTD': 'MAN_UTD',
  'MADRID': 'REAL_MADRID',
  'BARCA': 'BARCELONA',
  'FC_BARCELONA': 'BARCELONA',
  'BARCELONA_FC': 'BARCELONA',
  'ATLETICO MADRID': 'ATLETICO',
  'ATLETICO_MADRID': 'ATLETICO',
  'ATLÉTICO': 'ATLETICO',
  'ATLÉTICO MADRID': 'ATLETICO',
  'BAYER LEVERKUSEN': 'LEVERKUSEN',
  'BORUSSIA DORTMUND': 'DORTMUND',
  'BVB': 'DORTMUND',
  'BAYERN MUNICH': 'BAYERN',
  'BAYERN MUNCHEN': 'BAYERN',
  'NOTTM FOREST': 'NOTTINGHAM_FOREST',
  'FOREST': 'NOTTINGHAM_FOREST',
  'WEST HAM UNITED': 'WEST_HAM',
  'BRIGHTON AND HOVE ALBION': 'BRIGHTON',
  'AFC BOURNEMOUTH': 'BOURNEMOUTH',
  'NEWCASTLE UNITED': 'NEWCASTLE',
  'WOLVERHAMPTON': 'WOLVES',
  'REAL SOCIEDAD': 'REAL_SOCIEDAD',
  'SOCIEDAD': 'REAL_SOCIEDAD',
  'VILLARREAL_CF': 'VILLARREAL',
  'REAL BETIS': 'BETIS',
  'SEVILLA_FC': 'SEVILLA',
  'MAINZ 05': 'MAINZ',
  'BORUSSIA MONCHENGLADBACH': 'GLADBACH',
  'ASTON VILLA': 'ASTON_VILLA',
  'RB LEIPZIG': 'RB_LEIPZIG',
  'LEIPZIG': 'RB_LEIPZIG',
  'EINTRACHT FRANKFURT': 'FRANKFURT',
  'UNION BERLIN': 'UNION_BERLIN',
  'HERTHA BERLIN': 'HERTHA_BERLIN',
  'INTER MILAN': 'INTER',
  'AC MILAN': 'MILAN',
  'JUVE': 'JUVENTUS',
  'AS ROMA': 'ROMA',
  'PARIS SAINT GERMAIN': 'PSG',
  'PARIS SG': 'PSG',
  'OLYMPIQUE MARSEILLE': 'MARSEILLE',
  'AS MONACO': 'MONACO',
  'OLYMPIQUE LYON': 'LYON',
  'LOSC LILLE': 'LILLE',
  'RC LENS': 'LENS',
};

/**
 * League-specific goal rates and home advantage factors
 */
export const LEAGUE_CONFIGS: Record<string, { goalRate: number; homeAdvantage: number }> = {
  'EPL': { 
    goalRate: 1.02, 
    homeAdvantage: 0.28, 
  },
  'LA_LIGA': { 
    goalRate: 0.94, 
    homeAdvantage: 0.32, 
  },
  'SERIE_A': { 
    goalRate: 0.98, 
    homeAdvantage: 0.26, 
  },
  'BUNDESLIGA': { 
    goalRate: 1.12, 
    homeAdvantage: 0.24, 
  },
  'LIGUE_1': { 
    goalRate: 0.92, 
    homeAdvantage: 0.30, 
  },
  'STANDARD': { goalRate: 1.0, homeAdvantage: 0.25 }
};

/**
 * Supported leagues
 */
export const ELITE_LEAGUES = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'];
