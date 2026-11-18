export type DataSource = 'api-football' | 'the-odds-api';

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
  season?: string;
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
  } | null;
  takenAt?: string;
  closedAt?: string;
}

export interface InternalTeamData {
  attackStrength: number;  // Multiplier on league average (1.0 = average)
  defenseStrength: number; // Multiplier on league average (1.0 = average)
}

export interface MatchContext {
  league: string;
  date: string;
  marketOdds: {
    pinnacleOver25: number | null;
    pinnacleUnder25: number | null;
    source?: string;
  };
}

export interface GoalDistribution {
  goals: string;
  probability: number;
}

export interface AnalysisResult {
  probability: number;
  homeStats: { name: string };
  awayStats: { name: string };
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
  isLowConfidence?: boolean;
  degraded: boolean;
  kickoff?: string;
  goalDistribution?: GoalDistribution[];
  scoreMatrix?: number[][];
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
  modelSource?: 'MLE_FITTED' | 'HEURISTIC_FALLBACK';
  marketEdge: number | null;
  isOver25Correct: boolean;
  isUnder25Correct: boolean;
  pnl: number;
  clv: number | null;
  clvNoVig?: number | null;
  stake: number;
  takenOdds: number | null;
  closingOdds?: number | null;
}

export interface BacktestSummary {
  totalMatches: number;
  brierScore: number;
  marketBrier: number | null;
  brierVsMarket: number | null;
  over25Accuracy: number;
  under25Accuracy: number;
  totalPnl: number;
  totalYield: number;
  avgClv: number;
  clvCoverage: number;
  avgClvNoVig: number;
  clvStats: {
    avg: number;
    stdErr: number;
    ci95Low: number;
    ci95High: number;
    n: number;
  } | null;
  roi95CI: {
    low: number;
    high: number;
    stdErr: number;
    nBets: number;
  };
  maxDrawdown: number;
  modelBreakdown: {
    mleFitted: number;
    heuristicFallback: number;
    d4Mismatches: number;
  };
  dataLineage: {
    source: 'football-data.co.uk';
    seasons: string[];
    leagues: string[];
    matchesDownloaded: number;
    matchesEvaluated: number;
  };
  verdict: {
    status: 'PROMISING' | 'NO_EDGE' | 'INCONCLUSIVE';
    failingConditions: string[];
  };
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
