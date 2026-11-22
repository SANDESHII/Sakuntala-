export type DataSource = 'api-football' | 'the-odds-api';

export interface TeamIdentity {
  id: string;
  apiFootballId?: number;
}

export interface TeamOption {
  id: string;
  displayName: string;
  league: string;
}

export interface HistoricalMatch {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  date: string;
  league: string;
  season?: string;
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
  marketOdds: {
    pinnacleOver25: number | null;
    pinnacleUnder25: number | null;
  };
}

export interface GoalDistribution {
  goals: string;
  probability: number;
}

export interface DerivedMarkets {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  under15: number;
  over25: number;
  under25: number;
  over35: number;
  under35: number;
  bttsYes: number;
  bttsNo: number;
}

export interface ExactScoreProb {
  home: number;
  away: number;
  probability: number;
}

export interface ModelDiagnostics {
  rho: number;
  homeAdvantage: number;
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  homeSampleMatches: number;
  awaySampleMatches: number;
  dataProvider: 'API_FOOTBALL' | 'FOOTBALL_DATA_CSV' | 'STATIC_PRIOR';
}

export interface AnalysisResult {
  homeStats: { name: string; displayName?: string };
  awayStats: { name: string; displayName?: string };
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  predictionType: 'OVER_25' | 'UNDER_25' | 'NO_BET';
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
  kickoff?: string;
  goalDistribution?: GoalDistribution[];
  scoreMatrix?: number[][];
  markets?: DerivedMarkets;
  topScorelines?: ExactScoreProb[];
  diagnostics?: ModelDiagnostics;
}

export interface TeamRatingRow {
  id: string;
  displayName: string;
  attack: number;
  defense: number;
  netRating: number;
  matchCount: number;
  lowConfidence: boolean;
}

export interface LeagueRatingsResponse {
  league: string;
  rho: number;
  homeAdvantage: number;
  matchesUsed: number;
  dataProvider: 'API_FOOTBALL' | 'FOOTBALL_DATA_CSV' | 'STATIC_PRIOR';
  teams: TeamRatingRow[];
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
  date?: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
  };
  prediction: {
    predictionType: string;
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

export interface EquityCurvePoint {
  index: number;
  date: string;
  cumPnl: number;
  drawdown: number;
}

export interface LeagueBacktestStats {
  league: string;
  evaluated: number;
  bets: number;
  pnl: number;
  yieldPct: number;
  avgClv: number;
  brier: number;
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
  leagueBreakdown?: LeagueBacktestStats[];
  equityCurve?: EquityCurvePoint[];
  matches: BacktestMatch[];
  error?: string;
}
