import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';

interface LeagueConfig {
    goalRate: number;
    homeAdvantage: number;
}

export class MatchEngine {
    static calculate(
        home: TeamStats, 
        away: TeamStats, 
        context: MatchContext,
        rhoData = { rho: -0.11, sigmaRho: 0.05, varHG: 0.25, varAG: 0.25 }
    ): AnalysisResult {
        const LEAGUE_CONSTANTS: Record<string, LeagueConfig> = {
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

        // TACTICAL GROUNDING OVERRIDE (Absolute Priority)
        // If real season xG is provided by the Tactical Research Phase, it overrides historical proxies.
        if (context.homeSeasonXG) hAttack = context.homeSeasonXG;
        if (context.awaySeasonXG) aAttack = context.awaySeasonXG;
        
        if (context.homeSeasonXGA) {
            // Convert xGA to a Stability metric (0.0 to 1.0)
            // League average xGA is typically ~1.35. Lower is better (more stable).
            hDef = Math.max(0.1, Math.min(0.95, 1 - (context.homeSeasonXGA / 3.0)));
        }
        if (context.awaySeasonXGA) {
            aDef = Math.max(0.1, Math.min(0.95, 1 - (context.awaySeasonXGA / 3.0)));
        }

        // DIMENSIONAL RATIO CALCULATION (The Fix)
        // We ground all calculations in the League Average Baseline to prevent inflationary drift.
        const leagueAvgXG = 1.35; 

        // Attack Strength (Ratio to League Average)
        const hAttackStrength = hAttack / leagueAvgXG;
        const aAttackStrength = aAttack / leagueAvgXG;

        // Defensive Weakness (Ratio to League Average)
        // High xGA relative to league average = High Weakness (>1.0)
        const hDefWeakness = (context.homeSeasonXGA || home.avgXGA) / leagueAvgXG;
        const aDefWeakness = (context.awaySeasonXGA || away.avgXGA) / leagueAvgXG;

        // Lambdas = League Avg * Attack Strength * Opponent Weakness
        let hL = leagueAvgXG * hAttackStrength * aDefWeakness * config.goalRate;
        let aM = leagueAvgXG * aAttackStrength * hDefWeakness * config.goalRate;

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

        // MARKET SELECTION LOGIC
        const type = pO15 > 0.65 ? 'OVER_15' : 'UNDER_35';
        const modelProb = type === 'OVER_15' ? pO15 : pU35;

        // MARKET EDGE CALCULATION
        const oddsRaw = type === 'OVER_15' ? context.marketOdds?.pinnacleOver15 : context.marketOdds?.pinnacleUnder35;
        const marketOdds = oddsRaw || 1.50; 
        const marketImpliedProb = 1 / marketOdds;
        const edge = modelProb - marketImpliedProb;

        // KELLY CRITERION (Risk Management)
        // Formula: (BP - Q) / B. We use Quarter-Kelly (0.25) for bankroll safety.
        const b = marketOdds - 1;
        const p = modelProb;
        const q = 1 - p;
        const rawKelly = Math.max(0, (b * p - q) / b);
        const recommendedStake = rawKelly * 0.25; 

        // VERDICT BASED ON EDGE, NOT PROBABILITY
        const hasEdge = edge > 0.04; // Only bet if we have a 4% edge over the bookie
        const verdict = hasEdge ? 'EXECUTE_BET' : 'NO_BET';

        const sim = MonteCarloSimulator.run(
            hL, aM, rhoData.varHG || 0.25, rhoData.varAG || 0.25, 
            type === 'UNDER_35' ? 3.5 : 1.5, 
            type === 'UNDER_35', 
            rhoData.rho, rhoData.sigmaRho
        );

        const purity = (home.dataPurity + away.dataPurity) / 2;
        
        return {
            probability: Math.round(modelProb * 100),
            summary: hasEdge 
                ? `Edge detected. Model sees ${Math.round(modelProb * 100)}% true probability. Market implies ${Math.round(marketImpliedProb * 100)}%.` 
                : `No Edge. Market odds (${marketOdds.toFixed(2)}) are efficient. Stay flat.`,
            homeStats: home,
            awayStats: away,
            homeXG: hL,
            awayXG: aM,
            minimumExpectancy: sim.confidenceInterval[0],
            potentialCeiling: sim.confidenceInterval[1],
            predictionType: type,
            predictionLabel: type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals',
            
            // TRADING METRICS
            marketOdds: marketOdds,
            marketImpliedProb: Math.round(marketImpliedProb * 100),
            edge: Math.round(edge * 100), 
            recommendedStake: Math.round(recommendedStake * 1000) / 10, 
            verdict: verdict,
            
            purity: Math.round(purity * 100),
            signalStrength: modelProb,
            context,
            dataSource: (home.dataPurity <= 0.1 && away.dataPurity <= 0.1) ? 'FALLBACK_STATIC' : 'LIVE',
            surety: { confidenceScore: modelProb, edgeValue: Math.round(edge * 100) }
        };
    }
}
