import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';

export class MatchEngine {
    static calculate(
        home: TeamStats, 
        away: TeamStats, 
        context: MatchContext,
        rhoData = { rho: -0.11, sigmaRho: 0.05, varHG: 0.25, varAG: 0.25 }
    ): AnalysisResult {
        const LEAGUE_CONSTANTS: any = {
            'EPL': { goalRate: 1.02, homeAdvantage: 0.28 },
            'LA_LIGA': { goalRate: 0.94, homeAdvantage: 0.32 },
            'SERIE_A': { goalRate: 0.98, homeAdvantage: 0.26 },
            'BUNDESLIGA': { goalRate: 1.12, homeAdvantage: 0.24 },
            'LIGUE_1': { goalRate: 0.92, homeAdvantage: 0.30 }
        };

        const config = LEAGUE_CONSTANTS[context.league || 'EPL'] || { goalRate: 1.0, homeAdvantage: 0.25 };

        let hAttack = home.npxG;
        let aAttack = away.npxG;
        let hDef = home.defensiveStability;
        let aDef = away.defensiveStability;

        if (context.homeSeasonXG) hAttack = (hAttack * 0.3) + (context.homeSeasonXG * 0.7);
        if (context.awaySeasonXG) aAttack = (aAttack * 0.3) + (context.awaySeasonXG * 0.7);
        
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

        // BAYESIAN MOMENTUM WEIGHTING
        // We apply the clinical edge but cap its influence to prevent 90%+ saturation.
        // Formula: ShrunkMultiplier = 1 + sign(Edge) * sqrt(abs(Edge))
        // The sqrt() dampens extreme surges while preserving directionality.
        const hMomentum = (home.clinicalEdge || 0);
        const aMomentum = (away.clinicalEdge || 0);
        
        hL *= (1 + (Math.sign(hMomentum) * Math.sqrt(Math.abs(hMomentum))));
        aM *= (1 + (Math.sign(aMomentum) * Math.sqrt(Math.abs(aMomentum))));

        // Apply Home Advantage with Regression to Mean
        // We pull the home advantage back toward a league average of 0.25
        const shrunkHomeAdv = (config.homeAdvantage * 0.7) + (0.25 * 0.3);
        hL += shrunkHomeAdv;

        const travelPenalty = MatchContextService.calculateTravelFatigue(home.name.toUpperCase(), away.name.toUpperCase());
        aM *= travelPenalty;

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

        if (context.referee?.tendency === 'STRICT') { hL *= 1.05; aM *= 1.05; }
        if (context.homeStyle && context.homeStyle.ppda < 10) hL *= 1.1;
        if (context.awayStyle && context.awayStyle.ppda < 10) aM *= 1.1;

        const matrix = DixonColes.calculateScoreMatrix(hL, aM, rhoData.rho);
        const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
        const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);

        // MARKET EDGE DETECTION (Pinnacle/Betfair tethering)
        const marketProbO15 = context.marketOdds?.pinnacleOver15 ? (1 / context.marketOdds.pinnacleOver15) : 0.71;
        const marketProbU35 = context.marketOdds?.pinnacleUnder35 ? (1 / context.marketOdds.pinnacleUnder35) : 0.75;

        const edgeO15 = pO15 - marketProbO15;
        const edgeU35 = pU35 - marketProbU35;

        let type: 'OVER_15' | 'UNDER_35' | 'NO_BET' = 'NO_BET';
        let edge = 0;
        let prob = 0;

        if (edgeO15 > 0.04 && edgeO15 > edgeU35) {
            type = 'OVER_15';
            edge = edgeO15;
            prob = pO15;
        } else if (edgeU35 > 0.04) {
            type = 'UNDER_35';
            edge = edgeU35;
            prob = pU35;
        } else {
            prob = Math.max(pO15, pU35);
            edge = 0;
        }

        const sim = MonteCarloSimulator.run(
            hL, aM, rhoData.varHG || 0.25, rhoData.varAG || 0.25, 
            type === 'UNDER_35' ? 3.5 : 1.5, 
            type === 'UNDER_35', 
            rhoData.rho, rhoData.sigmaRho
        );

        const purity = (home.dataPurity + away.dataPurity) / 2;
        const isVolatile = purity < 0.4 || prob < 0.62;
        
        let finalSummary = "";
        if (type === 'NO_BET') {
            finalSummary = "Market Efficiency Detected: Neural probability is within the variance threshold of Pinnacle/Betfair price. No statistical advantage present.";
        } else {
            const volatileNote = isVolatile ? " [VOLATILITY ALERT: Data purity is low] " : "";
            finalSummary = `Syndicate Alpha Detected:${volatileNote} Model probability exceeds market baseline by ${Math.round(edge * 1000) / 10}%. Converged on ${type === 'OVER_15' ? 'Over 1.5' : 'Under 3.5'}.`;
        }

        return {
            probability: Math.round(prob * 100),
            summary: finalSummary,
            homeStats: home,
            awayStats: away,
            homeXG: hL,
            awayXG: aM,
            minimumExpectancy: sim.confidenceInterval[0],
            potentialCeiling: sim.confidenceInterval[1],
            predictionType: type,
            predictionLabel: type === 'NO_BET' ? 'Market Efficient (No Bet)' : (type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals'),
            purity: Math.round(purity * 100),
            signalStrength: prob,
            context,
            dataSource: (home.dataPurity <= 0.1 && away.dataPurity <= 0.1) ? 'FALLBACK_STATIC' : 'LIVE',
            surety: { confidenceScore: prob, edgeValue: Math.round(edge * 1000) / 10 }
        };
    }
}
