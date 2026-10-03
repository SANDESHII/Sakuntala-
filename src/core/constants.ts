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
};

export const LEAGUE_CONFIGS: Record<string, any> = {
  'EPL': { goalRate: 1.05, homeAdvantage: 0.30 },
  'LA_LIGA': { goalRate: 0.95, homeAdvantage: 0.32 },
  'BUNDESLIGA': { goalRate: 1.15, homeAdvantage: 0.28 },
  'SERIE_A': { goalRate: 0.92, homeAdvantage: 0.35 },
  'LIGUE_1': { goalRate: 0.98, homeAdvantage: 0.30 },
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

// ═══════════════════════════════════════════════════════════════
// ARENA STRATEGY MODIFIERS
// ═══════════════════════════════════════════════════════════════

/**
 * Strategy-specific parameter modifiers
 * Each strategy adjusts the base model parameters differently
 */
export const STRATEGY_MODIFIERS: Record<string, {
  edgeThreshold: number;
  kellyFraction: number;
  confidenceMultiplier: number;
}> = {
  'simplest':            { edgeThreshold: 0.03,  kellyFraction: 0.25, confidenceMultiplier: 0.90 },
  'maximal-rigour':      { edgeThreshold: 0.02,  kellyFraction: 0.40, confidenceMultiplier: 1.10 },
  'user-empathy':        { edgeThreshold: 0.03,  kellyFraction: 0.30, confidenceMultiplier: 1.00 },
  'edge-cases-first':    { edgeThreshold: 0.04,  kellyFraction: 0.20, confidenceMultiplier: 0.85 },
  'speed':               { edgeThreshold: 0.03,  kellyFraction: 0.35, confidenceMultiplier: 0.90 },
  'defensive':           { edgeThreshold: 0.05,  kellyFraction: 0.15, confidenceMultiplier: 0.80 },
  'clarity':             { edgeThreshold: 0.03,  kellyFraction: 0.30, confidenceMultiplier: 1.00 },
  'completeness':        { edgeThreshold: 0.025, kellyFraction: 0.35, confidenceMultiplier: 1.05 },
  'fewest-moving-parts': { edgeThreshold: 0.03,  kellyFraction: 0.30, confidenceMultiplier: 0.95 },
  'explicit-trade-offs': { edgeThreshold: 0.03,  kellyFraction: 0.30, confidenceMultiplier: 1.00 },
  'built-to-last':       { edgeThreshold: 0.025, kellyFraction: 0.35, confidenceMultiplier: 1.05 },
  'concrete-specifics':  { edgeThreshold: 0.03,  kellyFraction: 0.30, confidenceMultiplier: 1.00 },
};

/**
 * Workflow-specific adjustments
 */
export const WORKFLOW_MODIFIERS: Record<string, {
  rhoAdjust: number;
  uncertaintyAdjust: number;
}> = {
  'draft-critique-rewrite':   { rhoAdjust:  0.00, uncertaintyAdjust:  0.00 },
  'outline-first':            { rhoAdjust:  0.00, uncertaintyAdjust: -0.02 },
  'test-first':               { rhoAdjust: -0.02, uncertaintyAdjust: -0.03 },
  'research-then-synthesise': { rhoAdjust:  0.01, uncertaintyAdjust:  0.02 },
  'three-drafts':             { rhoAdjust:  0.01, uncertaintyAdjust:  0.00 },
  'requirements-checklist':   { rhoAdjust:  0.00, uncertaintyAdjust: -0.01 },
  'iterative-deepening':      { rhoAdjust:  0.00, uncertaintyAdjust:  0.01 },
  'build-then-break':         { rhoAdjust: -0.01, uncertaintyAdjust: -0.02 },
  'smallest-version-first':   { rhoAdjust:  0.00, uncertaintyAdjust: -0.02 },
  'options-matrix':           { rhoAdjust:  0.01, uncertaintyAdjust:  0.00 },
  'open-questions-first':     { rhoAdjust:  0.00, uncertaintyAdjust:  0.01 },
  'write-then-restructure':   { rhoAdjust:  0.00, uncertaintyAdjust:  0.00 },
};

/**
 * Reasoning mode parameter adjustments
 */
export const REASONING_MODIFIERS: Record<string, {
  lambdaAdjust: number;
  muAdjust: number;
  formWeight: number;
}> = {
  'first-principles':  { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.00 },
  'inversion':         { lambdaAdjust: -0.10, muAdjust: -0.10, formWeight: 0.10 },
  'analogy':           { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.20 },
  'adversarial':       { lambdaAdjust:  0.05, muAdjust:  0.05, formWeight: 0.15 },
  'constraint-first':  { lambdaAdjust: -0.05, muAdjust: -0.05, formWeight: 0.05 },
  'worked-example':    { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.25 },
  'socratic':          { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.30 },
  'contrarian':        { lambdaAdjust: -0.15, muAdjust: -0.15, formWeight: 0.10 },
  'systems-thinking':  { lambdaAdjust:  0.05, muAdjust:  0.05, formWeight: 0.20 },
  'decomposition':     { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.15 },
  'working-backwards': { lambdaAdjust:  0.10, muAdjust:  0.10, formWeight: 0.10 },
  'probabilistic':     { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.05 },
  'dialectical':       { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.20 },
  'evidence-first':    { lambdaAdjust:  0.00, muAdjust:  0.00, formWeight: 0.00 },
  'expert-panel':      { lambdaAdjust:  0.05, muAdjust:  0.05, formWeight: 0.25 },
};

