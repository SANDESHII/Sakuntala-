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
  edgeSegments: EdgeSegment[];
  matches: BacktestMatch[];
  error?: string;
}
