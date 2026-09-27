export type DataSource = 'api-football' | 'the-odds-api';

export interface Provenance {
  source: DataSource;
  quality: 'high' | 'medium' | 'low';
  timestamp: string;
  season?: string | number;
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
  daysAgo: number;
  homeId?: number;
  awayId?: number;
  takenPrices?: {
    over15?: number;
    under35?: number;
  };
  closingPrices?: {
    over15?: number;
    under35?: number;
  };
}

export interface MarketOdds {
  over15?: {
    bestPrice: number;
    avgPrice: number;
    count: number;
  };
  under35?: {
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
  quality?: 'high' | 'low';
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
    pinnacleOver15: number;
    pinnacleUnder35: number;
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
  predictionType: 'OVER_15' | 'UNDER_35' | 'NO_BET';
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
  isOver15Correct: boolean;
  isUnder35Correct: boolean;
  pnl: number;
  clv: number;
  stake: number;
  takenOdds: number;
  closingOdds?: number;
}

export interface BacktestSummary {
  totalMatches: number;
  brierScore: number;
  over15Accuracy: number;
  under35Accuracy: number;
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
  constructor(message: string) {
    super(message);
    this.name = 'DataGapError';
  }
}
