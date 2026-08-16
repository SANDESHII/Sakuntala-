import { ProfileService } from './profileService';
import { MatchEngine } from './engine';
import { DataService } from './dataService';
import { AnalysisResult } from '../types';

export interface BacktestSummary {
    totalMatches: number;
    over15Accuracy: number;
    under35Accuracy: number;
    brierScore: number;
    highPurityBrierScore: number;
    highPurityMatches: number;
    edgeSegments: any[];
    matches: Array<{
        match: any;
        prediction: AnalysisResult;
        isOver15Correct: boolean;
        isUnder35Correct: boolean;
        marketEdge?: number;
    }>;
}

export class BacktestService {
    static async runBacktest(league: string = 'EPL'): Promise<BacktestSummary> {
        const { matches: all } = await DataService.getLeagueContext(league);
        const samples = all.filter(m => m.homeGoals != null).slice(-150);
        
        let totalB = 0, hpB = 0, hpC = 0, ovC = 0, unC = 0, ovT = 0, unT = 0;
        const results: any[] = [];

        for (const m of samples) {
            const h = DataService.standardize({ ...ProfileService.computeBaseline(m.homeTeam, all), name: m.homeTeam });
            const a = DataService.standardize({ ...ProfileService.computeBaseline(m.awayTeam, all), name: m.awayTeam });
            
            const math = MatchEngine.calculate(h, a, { stakes: "STANDARD", date: m.date });
            const tg = (m.homeGoals || 0) + (m.awayGoals || 0);
            const isO15 = tg > 1.5, isU35 = tg < 3.5;
            const outcome = math.predictionType === 'OVER_15' ? isO15 : isU35;
            const brier = Math.pow((math.probability / 100) - (outcome ? 1 : 0), 2);

            totalB += brier;
            if (h.dataPurity >= 0.8 && a.dataPurity >= 0.8) { hpB += brier; hpC++; }
            if (math.predictionType === 'OVER_15') { ovT++; if (isO15) ovC++; }
            if (math.predictionType === 'UNDER_35') { unT++; if (isU35) unC++; }

            results.push({ 
                match: { ...m, actualScore: [m.homeGoals, m.awayGoals] }, 
                prediction: math, 
                isOver15Correct: isO15, 
                isUnder35Correct: isU35 
            });
        }

        return {
            totalMatches: samples.length,
            over15Accuracy: ovT > 0 ? (ovC / ovT) * 100 : 0,
            under35Accuracy: unT > 0 ? (unC / unT) * 100 : 0,
            brierScore: totalB / samples.length,
            highPurityBrierScore: hpC > 0 ? hpB / hpC : 0,
            highPurityMatches: hpC,
            edgeSegments: [],
            matches: results
        };
    }
}
