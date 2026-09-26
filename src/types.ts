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
  clinicalEdge: number;
  quality?: 'high' | 'medium' | 'low' | 'goals-proxy';
}

export type DataSource = 'api-football' | 'the-odds-api' | 'manual-registry' | 'internal-proxy';

export interface Provenance {
  source: DataSource;
  sourceId?: string | number;
  sourceSeason?: string | number;
  fetchedAt: string;
  quality: 'high' | 'medium' | 'low' | 'goals-proxy';
}

export interface TeamIdentity {
  id: string; // Canonical internal ID
  name: string;
  aliases: string[];
  externalIds: {
    apiFootball?: number;
    theOddsApi?: string;
  };
}

export interface MarketPrice {
  price: number;
  impliedProb: number;
  provider: string;
}

export interface OddsLeg {
  bestPrice: number;
  noVigPrice: number;
  bookmakerCount: number;
  timestamp: string;
}

export interface HistoricalPrices {
  over15?: OddsLeg;
  under35?: OddsLeg;
  oneXTwo?: {
    home: OddsLeg;
    draw: OddsLeg;
    away: OddsLeg;
  };
  takenAt?: string;
  closedAt?: string;
}

export class DataGapError extends Error {
  constructor(public entity: string, public context: string) {
    super(`Data Gap: ${entity} missing in ${context}`);
    this.name = 'DataGapError';
  }
}

export class QuotaExceededError extends Error {
  constructor(public provider: DataSource) {
    super(`Quota Exceeded for provider: ${provider}`);
    this.name = 'QuotaExceededError';
  }
}

export interface TeamStats {
  name: string;
  goalsScored: number;
  goalsConceded: number;
  avgXG: number;
  avgXGA: number;
  npxG: number;
  defensiveStability: number;
  form: number[];
  cleanSheets: number;
  clinicalEdge: number;
  homeAwayBias: number;
}

export interface MatchContext {
  league?: string;
  homeSeasonXG?: number;
  awaySeasonXG?: number;
  homeSeasonXGA?: number;
  awaySeasonXGA?: number;
  homeTier?: number;
  awayTier?: number;
  date?: string;
  marketOdds?: {
    pinnacleOver15?: number;
    pinnacleUnder35?: number;
  };
}

export interface GoalDistribution {
  goals: string; // e.g. "0", "1", "2", "3", "4+"
  probability: number;
}

export interface AnalysisResult {
  probability: number;
  summary: string;
  homeStats: TeamStats;
  awayStats: TeamStats;
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
  usedRealOdds?: boolean;
  goalDistribution?: GoalDistribution[];
}

export interface BacktestMatch {
  match: {
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
    isReal?: boolean;
  };
  prediction: {
    predictionType: 'OVER_15' | 'UNDER_35' | 'NO_BET';
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

export interface EdgeSegment {
  segment: string;
  count: number;
  hits: number;
  hitRate: number;
  avgEdge: number;
}

export interface BacktestSummary {
  totalMatches: number;
  brierScore: number;
  over15Accuracy: number;
  under35Accuracy: number;
  totalPnl: number;
  totalYield: number;
  avgClv: number;
  edgeSegments: EdgeSegment[];
  matches: BacktestMatch[];
  error?: string;
}
