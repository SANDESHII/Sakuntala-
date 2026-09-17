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
  dataPurity: number;
  redCardPropensity: number;
  clinicalEdge: number;
  homeAwayBias: number;
}

export interface Citation {
  source: string;
  url: string;
  value: number;
  timestamp: string;
}

export interface MatchContext {
  league?: string;
  homeSeasonXG?: number;
  awaySeasonXG?: number;
  homeSeasonXGA?: number;
  awaySeasonXGA?: number;
  homeTier?: number;
  awayTier?: number;
  isDerby?: boolean;
  sampleSize?: number;
  date?: string;
  marketOdds?: {
    pinnacleOver15?: number;
    pinnacleUnder15?: number;
    pinnacleUnder35?: number;
    pinnacleOver35?: number;
  };
  groundingLog?: {
    citations: Citation[];
    varianceAlerts: string[];
  };
  audit?: {
    signalIntegrity: string;
    alphaAdjustment: string;
    dataReliability: string;
    sampleSize: number;
  };
}

export interface AnalysisConfidence {
  confidenceScore: number;
  edgeValue: number;
  groundingCitations?: Citation[];
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
  purity: number;
  signalStrength: number;
  marketOdds: number;
  marketImpliedProb: number;
  edge: number;
  recommendedStake: number;
  verdict: 'EXECUTE_BET' | 'NO_BET';
  context: MatchContext;
  surety: AnalysisConfidence;
  dataSource: 'LIVE' | 'FALLBACK_STATIC';
}

export interface BacktestMatch {
  match: {
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
  };
  prediction: {
    predictionType: 'OVER_15' | 'UNDER_35' | 'NO_BET';
    probability: number;
    purity: number;
  };
  marketEdge: number;
  isOver15Correct: boolean;
  isUnder35Correct: boolean;
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
  highPurityBrierScore: number;
  highPurityMatches: number;
  over15Accuracy: number;
  under35Accuracy: number;
  edgeSegments: EdgeSegment[];
  matches: BacktestMatch[];
}
