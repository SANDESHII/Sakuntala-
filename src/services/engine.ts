import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';

export class MatchEngine {
    static calculate(
        home: TeamStats, 
        away: TeamStats, 
        context: MatchContext,
        rhoData = { rho: -0.11, sigmaRho: 0.05 }
    ): AnalysisResult {
        // LEAGUE-SPECIFIC CALIBRATION (The "Correction")
        // These constants are based on multi-season goal averages for Top 5
        const LEAGUE_CONSTANTS: any = {
            'EPL': { goalRate: 1.02, homeAdvantage: 0.28 },
            'LA_LIGA': { goalRate: 0.94, homeAdvantage: 0.32 },
            'SERIE_A': { goalRate: 0.98, homeAdvantage: 0.26 },
            'BUNDESLIGA': { goalRate: 1.12, homeAdvantage: 0.24 },
            'LIGUE_1': { goalRate: 0.92, homeAdvantage: 0.30 }
        };

        const config = LEAGUE_CONSTANTS[context.league || 'EPL'] || { goalRate: 1.0, homeAdvantage: 0.25 };

        // 0. HYBRID xG BLEND (The "Atom Level" Correction)
        // We blend historical goal averages with AI-retrieved season xG (70% weighting to xG)
        let hAttack = home.npxG;
        let aAttack = away.npxG;
        let hDef = home.defensiveStability;
        let aDef = away.defensiveStability;

        if (context.homeSeasonXG) hAttack = (hAttack * 0.3) + (context.homeSeasonXG * 0.7);
        if (context.awaySeasonXG) aAttack = (aAttack * 0.3) + (context.awaySeasonXG * 0.7);
        
        // Defensive stability blend using xGA (Expected Goals Against)
        // High xGA means low stability. Stability = 1 - (xGA / league_avg)
        if (context.homeSeasonXGA) {
            const xgaStability = Math.max(0.3, Math.min(0.9, 1 - (context.homeSeasonXGA / 2.7)));
            hDef = (hDef * 0.4) + (xgaStability * 0.6);
        }
        if (context.awaySeasonXGA) {
            const xgaStability = Math.max(0.3, Math.min(0.9, 1 - (context.awaySeasonXGA / 2.7)));
            aDef = (aDef * 0.4) + (xgaStability * 0.6);
        }

        // Scoring Expectations
        let hL = hAttack * (1 / aDef) * config.goalRate;
        let aM = aAttack * (1 / hDef) * config.goalRate;

        // Apply Home Advantage
        hL += config.homeAdvantage;

        // 1. Fatigue Modifier (Hard Data - Geography)
        const travelPenalty = MatchContextService.calculateTravelFatigue(home.name.toUpperCase(), away.name.toUpperCase());
        aM *= travelPenalty;

        // 2. Weather Modifier (Real-time fetching)
        if (context.weatherData) {
            // High heat (>28C) reduces game pace and pressing intensity
            if (context.weatherData.temperature > 28) {
                hL *= 0.95;
                aM *= 0.95;
            }
            // Extreme cold (<2C) increases "offensive volatility" (slippery, harder to defend)
            if (context.weatherData.temperature < 2) {
                hL *= 1.03;
                aM *= 1.03;
            }
        }

        // 3. Tactical Modifiers
        if (context.referee?.tendency === 'STRICT') { hL *= 1.05; aM *= 1.05; }
        if (context.homeStyle && context.homeStyle.ppda < 10) hL *= 1.1;
        if (context.awayStyle && context.awayStyle.ppda < 10) aM *= 1.1;

        // Core Probability Matrix
        const matrix = DixonColes.calculateScoreMatrix(hL, aM, rhoData.rho);
        const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
        const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);

        const type = (pO15 / 0.72) > (pU35 / 0.76) ? 'OVER_15' : 'UNDER_35';
        const prob = type === 'OVER_15' ? pO15 : pU35;

        // Monte Carlo Variance Simulation
        const sim = MonteCarloSimulator.run(
            hL, aM, 0.15, 0.15, 
            type === 'OVER_15' ? 1.5 : 3.5, 
            type === 'UNDER_35', 
            rhoData.rho, rhoData.sigmaRho
        );

        const purity = (home.dataPurity + away.dataPurity) / 2;
        const isVoid = purity < 0.4 || prob < 0.58;
        const verdict = prob > 0.82 ? 'GOLD' : (prob > 0.72 ? 'SILVER' : 'BRONZE');

        return {
            probability: Math.round(prob * 100),
            summary: isVoid ? "Signal void: Data purity below threshold." : `Converged on ${type === 'OVER_15' ? 'Over 1.5' : 'Under 3.5'} with ${Math.round(prob * 100)}% confidence.`,
            homeStats: home,
            awayStats: away,
            homeXG: hL,
            awayXG: aM,
            minimumExpectancy: sim.confidenceInterval[0],
            potentialCeiling: sim.confidenceInterval[1],
            predictionType: isVoid ? 'VOID' : type,
            predictionLabel: isVoid ? 'VOID' : (type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals'),
            purity: Math.round(purity * 100),
            signalStrength: prob,
            isSureshot: prob > 0.82 && !isVoid,
            context,
            dataSource: 'LIVE',
            surety: { confidenceScore: prob, verdict: isVoid ? 'VOID' : verdict as any }
        };
    }
}
