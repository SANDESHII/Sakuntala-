export type DataSource = 'api-football' | 'the-odds-api';

export interface Provenance {
  source: DataSource;
  quality: 'high' | 'medium' | 'low';
  timestamp: string;
  season?: string | number;
  sourceSeason?: string | number;
}

export interface HistoricalPrices {
  over25: { bestPrice: number; noVigPrice: number };
  under25: { bestPrice: number; noVigPrice: number };
  takenAt: string;
  closedAt?: string;
}

export interface TeamIdentity {
  id: string;
  name: string;
  league: string;
  country: string;
  aliases?: string[];
  externalIds: {
    apiFootball?: number;
    theOddsApi?: string;
  };
}

export interface HistoricalMatch {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  date: string;
  league: string;
  daysAgo?: number;
  homeId?: number;
  awayId?: number;
  takenPrices?: {
    over25?: number;
    under25?: number;
    over25NoVig?: number;
    under25NoVig?: number;
  };
  closingPrices?: {
    over25?: number;
    under25?: number;
    over25NoVig?: number;
    under25NoVig?: number;
  };
  takenAt?: string;
  closedAt?: string;
}

export interface InternalTeamData {
  attackStrength: number;  // Multiplier on league average (1.0 = average)
  defenseStrength: number; // Multiplier on league average (1.0 = average)
  avgGoalsScored: number;
  avgGoalsConceded: number;
  homeAdvantageHeuristic: number;
  form: number[];
  cleanSheetRate: number;
  matchCount?: number;
  quality?: 'high' | 'medium' | 'low' | 'goals-proxy';
}

export interface MatchContext {
  league: string;
  homeSeasonGoals: number;
  awaySeasonGoals: number;
  homeSeasonGoalsAgainst: number;
  awaySeasonGoalsAgainst: number;
  homeAttackRating: number;
  awayAttackRating: number;
  date: string;
  marketOdds: {
    pinnacleOver25: number | null;
    pinnacleUnder25: number | null;
    source?: string;
    sourceName?: string;
  };
}

export interface GoalDistribution {
  goals: string;
  probability: number;
}

export interface AnalysisResult {
  probability: number;
  summary: string;
  homeStats: {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgGoalsScored: number;
    avgGoalsConceded: number;
    defensiveRatingHeuristic: number;
    form: number[];
    cleanSheets: number;
    homeAwayBias: number;
  };
  awayStats: {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgGoalsScored: number;
    avgGoalsConceded: number;
    defensiveRatingHeuristic: number;
    form: number[];
    cleanSheets: number;
    homeAwayBias: number;
  };
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET';
  predictionLabel: string;
  rawProbability: number;
  marketOdds: number | null;
  marketImpliedProb: number | null;
  edge: number | null;
  recommendedStake: number;
  verdict: 'EXECUTE_BET' | 'NO_BET';
  context: MatchContext;
  dataSource: 'LIVE' | 'FALLBACK_STATIC';
  modelSource: 'MLE_FITTED' | 'HEURISTIC_FALLBACK';
  modelSpecification?: string;
  isLowConfidence?: boolean;
  isThresholdAdaptive?: boolean;
  usedRealOdds?: boolean;
  goalDistribution?: GoalDistribution[];
  scoreMatrix?: number[][];
  arena?: {
    consensus: ConsensusResult;
    predictions: ArenaPrediction[];
  };
}

// ═══════════════════════════════════════════════════════════════
// ARENA SYSTEM TYPES
// ═══════════════════════════════════════════════════════════════

export interface ArenaConfig {
  enableArena: boolean;
  cardCount: number;
  seed?: number;
}

export interface StrategyCard {
  reasoning: {
    id: string;
    name: string;
    how: string;
    footballApplication: string;
    icon?: string;
  };
  workflow: {
    id: string;
    name: string;
    how: string;
    footballApplication: string;
    icon?: string;
  };
  strategy: {
    id: string;
    name: string;
    how: string;
    footballApplication: string;
    icon?: string;
  };
}

export interface ArenaPrediction {
  card: StrategyCard;
  prediction: 'OVER_25' | 'UNDER_25' | 'NO_BET';
  confidence: number;
  edge: number;
  reasoning: string;
  scores: {
    correctness: number;
    completeness: number;
    robustness: number;
    specificity: number;
    clarity: number;
  };
  weightedTotal: number;
  fatal: boolean;
}

export interface ConsensusResult {
  prediction: string;
  confidence: number;
  edge: number;
  agreement: number;
  topReasoning: string;
  surviving: ArenaPrediction[];
  dissenting: ArenaPrediction[];
}

export interface FixtureMatch {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  kickoff: string;
  league: string;
  fixtureId: number;
}

export interface BacktestMatch {
  match: {
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
    isReal: boolean;
  };
  prediction: {
    predictionType: string;
    probability: number;
    rawProbability: number;
  };
  marketEdge: number | null;
  isOver25Correct: boolean;
  isUnder25Correct: boolean;
  pnl: number;
  clv: number;
  stake: number;
  takenOdds: number | null;
  closingOdds?: number;
}

export interface BacktestSummary {
  totalMatches: number;
  brierScore: number;
  over25Accuracy: number;
  under25Accuracy: number;
  totalPnl: number;
  totalYield: number;
  avgClv: number;
  edgeSegments: {
    segment: string;
    min: number;
    max: number;
    count: number;
    hits: number;
    hitRate: number;
    avgEdge: number;
    avgClv: number;
  }[];
  matches: BacktestMatch[];
  error?: string;
}

export class QuotaExceededError extends Error {
  constructor(public source: DataSource) {
    super(`Quota exceeded for ${source}`);
    this.name = 'QuotaExceededError';
  }
}

export class DataGapError extends Error {
  constructor(public field: string, public context?: string) {
    super(`Missing ${field}${context ? ` for ${context}` : ''}`);
    this.name = 'DataGapError';
  }
}
