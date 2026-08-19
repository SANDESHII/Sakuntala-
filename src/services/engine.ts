import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';
import { DATA_CONSTANTS, LEAGUE_CONFIGS } from '../core/constants';

export class MatchEngine {
    static calculate(
        home: TeamStats, 
        away: TeamStats, 
        context: MatchContext,
        rhoData = { rho: -0.11, sigmaRho: 0.05, varHG: 0.25, varAG: 0.25 }
    ): AnalysisResult {
        const config = LEAGUE_CONFIGS[context.league || 'EPL'] || LEAGUE_CONFIGS.STANDARD;

        let hAttack = home.npxG;
        let aAttack = away.npxG;
        const leagueAvgXG = DATA_CONSTANTS.DEFAULT_LEAGUE_AVG; 

        if (context.homeSeasonXG) hAttack = context.homeSeasonXG;
        if (context.awaySeasonXG) aAttack = context.awaySeasonXG;
        
        const hSeasonXGA = context.homeSeasonXGA || home.avgXGA;
        const aSeasonXGA = context.awaySeasonXGA || away.avgXGA;

        const hAttackRatio = hAttack / leagueAvgXG;
        const aAttackRatio = aAttack / leagueAvgXG;
        
        const hStabilityRatio = home.defensiveStability / 0.65;
        const aStabilityRatio = away.defensiveStability / 0.65;

        const hDefenseRatio = (hSeasonXGA / leagueAvgXG) * 0.6 + hStabilityRatio * 0.4;
        const aDefenseRatio = (aSeasonXGA / leagueAvgXG) * 0.6 + aStabilityRatio * 0.4;

        let hL = leagueAvgXG * hAttackRatio * aDefenseRatio * (1 + config.homeAdvantage / leagueAvgXG) * config.goalRate;
        let aM = leagueAvgXG * aAttackRatio * hDefenseRatio * config.goalRate;

        const hMomentum = (home.clinicalEdge || 0);
        const aMomentum = (away.clinicalEdge || 0);
        
        const hMomentumAdj = Math.sign(hMomentum) * Math.min(Math.sqrt(Math.abs(hMomentum)), DATA_CONSTANTS.MOMENTUM_CAP);
        const aMomentumAdj = Math.sign(aMomentum) * Math.min(Math.sqrt(Math.abs(aMomentum)), DATA_CONSTANTS.MOMENTUM_CAP);

        hL *= (1 + hMomentumAdj);
        aM *= (1 + aMomentumAdj);

        const travelPenalty = MatchContextService.calculateTravelFatigue(home.name.toUpperCase(), away.name.toUpperCase());
        aM *= travelPenalty;

        if (context.weatherData) {
            if (context.weatherData.temperature > 28) {
                hL *= 0.95;
                aM *= 0.95;
            }
            if (context.weatherData.temperature < 2) {
                hL *= 1.03;
                aM *= 1.03;
            }
        }

        if (context.referee) {
            const refEffect = 1 + (context.referee.avgPenaltiesPerGame - 0.2) * 0.5;
            hL *= refEffect;
            aM *= refEffect;
        }
        if (context.homeStyle && context.homeStyle.ppda < 10) {
            hL *= 1.1; 
            aM *= 1.05; 
        }
        if (context.awayStyle && context.awayStyle.ppda < 10) {
            aM *= 1.1; 
            hL *= 1.05; 
        }

        const matrix = DixonColes.calculateScoreMatrix(hL, aM, rhoData.rho);
        const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
        const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);

        const type = pO15 > 0.65 ? 'OVER_15' : 'UNDER_35';
        const modelProb = type === 'OVER_15' ? pO15 : pU35;

        const oddsRaw = type === 'OVER_15' ? context.marketOdds?.pinnacleOver15 : context.marketOdds?.pinnacleUnder35;
        const marketOdds = oddsRaw || 1.50; 
        const marketImpliedProb = 1 / marketOdds;
        const edge = modelProb - marketImpliedProb;

        const b = marketOdds - 1;
        const p = modelProb;
        const q = 1 - p;
        const rawKelly = Math.max(0, (b * p - q) / b);
        const recommendedStake = rawKelly * 0.25; 

        const hasEdge = edge > 0.04; 
        const verdict = hasEdge ? 'EXECUTE_BET' : 'NO_BET';

        const sim = MonteCarloSimulator.run(
            hL, aM, rhoData.varHG || 0.25, rhoData.varAG || 0.25, 
            type === 'UNDER_35' ? 3.5 : 1.5, 
            type === 'UNDER_35', 
            rhoData.rho
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
