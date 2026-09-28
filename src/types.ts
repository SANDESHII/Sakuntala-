export type DataSource = 'api-football' | 'the-odds-api';

export interface Provenance {
  source: DataSource;
  quality: 'high' | 'medium' | 'low';
  timestamp: string;
  season?: string | number;
  sourceSeason?: string | number;
}

export interface OddsLeg {
  name: string;
  price: number;
  point?: number;
}

export interface HistoricalPrices {
  over25: { bestPrice: number; noVigPrice: number };
  under25: { bestPrice: number; noVigPrice: number };
  takenAt: string;
  closedAt?: string;
}

export interface TeamStats {
  played: number;
  goals: {
    for: number;
    against: number;
    homeFor: number;
    awayFor: number;
  };
  cleanSheets: number;
  provenance: Provenance;
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
  };
  closingPrices?: {
    over25?: number;
    under25?: number;
  };
}

export interface FixtureMatch {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  kickoff: string;
  league: string;
  fixtureId: number;
}

export interface MarketOdds {
  over25?: {
    bestPrice: number;
    avgPrice: number;
    count: number;
  };
  under25?: {
    bestPrice: number;
    avgPrice: number;
    count: number;
  };
}

export interface InternalTeamData {
  attackStrength: number;
  defenseStrength: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgXG: number;
  avgXGA: number;
  homeBias: number;
  form: number[];
  cleanSheetRate: number;
  matchCount?: number;
  quality?: 'high' | 'medium' | 'low' | 'goals-proxy';
}

export interface MatchContext {
  league: string;
  homeSeasonXG: number;
  awaySeasonXG: number;
  homeSeasonXGA: number;
  awaySeasonXGA: number;
  homeTier: number;
  awayTier: number;
  date: string;
  marketOdds: {
    pinnacleOver25: number;
    pinnacleUnder25: number;
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
    avgXG: number;
    avgXGA: number;
    defensiveStability: number;
    form: number[];
    cleanSheets: number;
    homeAwayBias: number;
  };
  awayStats: {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgXG: number;
    avgXGA: number;
    defensiveStability: number;
    form: number[];
    cleanSheets: number;
    homeAwayBias: number;
  };
  homeXG: number;
  awayXG: number;
  minimumExpectancy: number;
  potentialCeiling: number;
  predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET';
  predictionLabel: string;
  marketOdds: number;
  marketImpliedProb: number;
  edge: number;
  recommendedStake: number;
  verdict: 'EXECUTE_BET' | 'NO_BET';
  context: MatchContext;
  dataSource: 'LIVE' | 'FALLBACK_STATIC';
  modelSource: 'MLE_FITTED' | 'HEURISTIC_FALLBACK';
  isLowConfidence?: boolean;
  isCalibrated?: boolean;
  usedRealOdds?: boolean;
  goalDistribution?: GoalDistribution[];
  scoreMatrix?: number[][];
  monteCarlo?: {
    probOver25: number;
    probUnder25: number;
    stdDev: number;
    iterations: number;
    uncertainty: number;
  };
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
  };
  marketEdge: number;
  isOver25Correct: boolean;
  isUnder25Correct: boolean;
  pnl: number;
  clv: number;
  stake: number;
  takenOdds: number;
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
