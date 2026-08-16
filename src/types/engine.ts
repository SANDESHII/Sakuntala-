import { TeamStats, MatchContext } from './match';

export interface MarketData {
    odds: {
        over15: number;
        under35: number;
    };
    impliedProb: {
        over15: number;
        under35: number;
    };
    edge: {
        over15: number;
        under35: number;
    };
    source: string;
    isSimulated?: boolean;
}

export interface AnalysisConfidence {
    confidenceScore: number;
    verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID';
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
    predictionType: 'OVER_15' | 'UNDER_35' | 'VOID';
    predictionLabel: string;
    purity: number;
    signalStrength: number;
    isSureshot: boolean;
    context: MatchContext;
    marketData?: MarketData;
    surety: AnalysisConfidence;
    dataSource: 'LIVE' | 'FALLBACK_STATIC';
    tacticalEdge?: {
        referee?: {
            name: string;
            tendency: string;
        };
        pressing?: {
            homePPDA: string;
            awayPPDA: string;
            homeLineHeight: string;
            awayLineHeight: string;
        };
    };
}
