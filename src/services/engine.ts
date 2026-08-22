import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';
import { DATA_CONSTANTS, LEAGUE_CONFIGS } from '../core/constants';

export class MatchEngine {
    static calculate(home: TeamStats, away: TeamStats, context: MatchContext, rhoData = { rho: -0.11, sigmaRho: 0.05, varHG: 0.25, varAG: 0.25 }): AnalysisResult {
        const config = LEAGUE_CONFIGS[context.league || 'EPL'] || LEAGUE_CONFIGS.STANDARD;
        let hA = context.homeSeasonXG || home.npxG, aA = context.awaySeasonXG || away.npxG;
        const lAvg = DATA_CONSTANTS.DEFAULT_LEAGUE_AVG, hXGA = context.homeSeasonXGA || home.avgXGA, aXGA = context.awaySeasonXGA || away.avgXGA;

        const hD = (hXGA / lAvg) * 0.6 + (home.defensiveStability / 0.65) * 0.4;
        const aD = (aXGA / lAvg) * 0.6 + (away.defensiveStability / 0.65) * 0.4;

        let hL = lAvg * (hA / lAvg) * aD * (1 + config.homeAdvantage / lAvg) * config.goalRate;
        let aM = lAvg * (aA / lAvg) * hD * config.goalRate;

        // POLISH: Apply Team-Specific Home/Away Bias (Dampened)
        const hBias = Math.pow(home.homeAwayBias || 1.0, 0.4);
        const aBias = Math.pow(away.homeAwayBias || 1.0, 0.4);
        hL *= hBias;
        aM *= (1 / aBias);

        const hM = (home.clinicalEdge || 0), aM_ = (away.clinicalEdge || 0);
        hL *= (1 + Math.sign(hM) * Math.min(Math.sqrt(Math.abs(hM)), DATA_CONSTANTS.MOMENTUM_CAP));
        aM *= (1 + Math.sign(aM_) * Math.min(Math.sqrt(Math.abs(aM_)), DATA_CONSTANTS.MOMENTUM_CAP)) * MatchContextService.calculateTravelFatigue(home.name.toUpperCase(), away.name.toUpperCase());

        if (context.weatherData) {
            const t = context.weatherData.temperature;
            if (t > 28 || t < 2) { hL *= (t > 28 ? 0.95 : 1.03); aM *= (t > 28 ? 0.95 : 1.03); }
        }

        if (context.referee) { 
            const rE = 1 + (context.referee.avgPenaltiesPerGame - 0.2) * 0.2; // Dampened from 0.5
            hL *= rE; aM *= rE; 
        }
        
        // Stabilized Tactical Multipliers (Dampened from 1.1)
        if (context.homeStyle?.ppda && context.homeStyle.ppda < 10) { hL *= 1.04; aM *= 1.02; }
        if (context.awayStyle?.ppda && context.awayStyle.ppda < 10) { aM *= 1.04; hL *= 1.02; }

        const matrix = DixonColes.calculateScoreMatrix(hL, aM, rhoData.rho);
        const pO15 = DixonColes.calculateOverUnder(matrix, 1.5), pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);
        
        const type = pO15 > 0.65 ? 'OVER_15' : 'UNDER_35';
        let rawP = type === 'OVER_15' ? pO15 : pU35;

        // --- NEW: BAYESIAN MARKET BLENDING (THE "RENTECH" ANCHOR) ---
        const mOdds = (type === 'OVER_15' ? context.marketOdds?.pinnacleOver15 : context.marketOdds?.pinnacleUnder35) || 1.50;
        
        // --- POLISH: OVERROUND REMOVAL (POWER METHOD APPROXIMATION) ---
        // Since we only have one side of the market usually, we assume a standard 3.5% overround
        // to approximate the "True" Market Probability.
        const overround = 0.035; 
        const mP_raw = 1 / mOdds;
        const mP = mP_raw / (1 + overround); 
        
        const purity = ((home.dataPurity || 0.1) + (away.dataPurity || 0.1)) / 2;
        
        // If purity is 1.0, we use 85% model / 15% market. 
        // If purity is 0.1, we use 5% model / 95% market.
        const modelWeight = 0.05 + (purity * 0.8); 
        const p = (rawP * modelWeight) + (mP * (1 - modelWeight));

        const edge = p - mP_raw, b = mOdds - 1;
        // POLISH: Dynamic Kelly scaling based on surety and edge quality
        const kellyFraction = 0.12 * Math.min(1.5, Math.max(0.5, purity + (rawP > 0.7 ? 0.2 : 0)));
        const stake = Math.max(0, (b * p - (1 - p)) / b) * kellyFraction; 
        const hasEdge = edge > 0.025; // Professional threshold

        const sim = MonteCarloSimulator.run(hL, aM, rhoData.varHG || 0.25, rhoData.varAG || 0.25, type === 'UNDER_35' ? 3.5 : 1.5, type === 'UNDER_35', rhoData.rho);
        
        return {
            probability: Math.round(p * 100),
            summary: hasEdge ? `Edge detected. Model sees ${Math.round(p * 100)}% true probability. Market implies ${Math.round(mP * 100)}%.` : `No Edge. Market odds (${mOdds.toFixed(2)}) are efficient.`,
            homeStats: home, awayStats: away, homeXG: hL, awayXG: aM,
            minimumExpectancy: sim.confidenceInterval[0], potentialCeiling: sim.confidenceInterval[1],
            predictionType: type, predictionLabel: type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals',
            marketOdds: mOdds, marketImpliedProb: Math.round(mP * 100), edge: Math.round(edge * 100), 
            recommendedStake: Math.round(stake * 1000) / 10, verdict: hasEdge ? 'EXECUTE_BET' : 'NO_BET',
            purity: Math.round(purity * 100), signalStrength: p, context,
            dataSource: (home.dataPurity <= 0.1 && away.dataPurity <= 0.1) ? 'FALLBACK_STATIC' : 'LIVE',
            surety: { confidenceScore: p, edgeValue: Math.round(edge * 100) }
        };
    }
}
