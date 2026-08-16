export interface TeamStats {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgXG: number;
    avgXGA: number;
    npxG: number; 
    defensiveStability: number;
    offensiveVolatility: number;
    form: number[];
    cleanSheets: number;
    dataPurity: number;
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
    weather?: string;
    weatherData?: {
        temperature: number;
        condition: string;
    };
    referee?: RefereeProfile;
    homeStyle?: TeamStyleProfile;
    awayStyle?: TeamStyleProfile;
    stakes: string;
    league?: string;
    homeSeasonXG?: number;
    awaySeasonXG?: number;
    homeSeasonXGA?: number;
    awaySeasonXGA?: number;
    tacticalDrift?: string;
    date?: string;
}

export interface MatchHistory {
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    homeShotsOnTarget?: number;
    awayShotsOnTarget?: number;
    homeCorners?: number;
    awayCorners?: number;
    homeRedCards?: number;
    awayRedCards?: number;
    homeXG?: number;
    awayXG?: number;
    date: string;
    league?: string;
}
