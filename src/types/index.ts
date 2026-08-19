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
}

export interface RefereeProfile {
    name: string;
    avgCardsPerGame: number;
    avgPenaltiesPerGame: number;
    homeWinRate: number;
    tendency: 'STRICT' | 'LENIENT' | 'AVERAGE';
}

export interface TeamStyleProfile {
    teamId: string;
    ppda: number;
    possessionFinalThird: number;
    purity: number;
}

export interface MatchContext {
    weatherData?: {
        temperature: number;
        condition: string;
    };
    referee?: RefereeProfile;
    homeStyle?: TeamStyleProfile;
    awayStyle?: TeamStyleProfile;
    league?: string;
    homeSeasonXG?: number;
    awaySeasonXG?: number;
    homeSeasonXGA?: number;
    awaySeasonXGA?: number;
    date?: string;
    marketOdds?: {
        pinnacleOver15?: number;
        pinnacleUnder35?: number;
    };
    audit?: {
        signalIntegrity: string;
        alphaAdjustment: string;
        redCardRegime: string;
        dataReliability: string;
        sampleSize: number;
    };
}

export interface MatchHistory {
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    homeXG?: number;
    awayXG?: number;
    homeShotsOnTarget?: number;
    awayShotsOnTarget?: number;
    homeRedCards?: number;
    awayRedCards?: number;
    date: string;
    league?: string;
    weight?: number;
}

export interface AnalysisConfidence {
    confidenceScore: number;
    edgeValue: number;
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
    
    // TRADING METRICS
    marketOdds: number;
    marketImpliedProb: number;
    edge: number;
    recommendedStake: number;
    verdict: 'EXECUTE_BET' | 'NO_BET';

    context: MatchContext;
    surety: AnalysisConfidence;
    dataSource: 'LIVE' | 'FALLBACK_STATIC';
}
