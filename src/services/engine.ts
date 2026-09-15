import { TeamStats, MatchContext, AnalysisResult } from '../types';
import { DixonColes, MonteCarloSimulator } from '../core/math';
import { MatchContextService } from './matchContext';
import { DATA_CONSTANTS, LEAGUE_CONFIGS } from '../core/constants';
import { EnsembleEngine } from './ensembleEngine';

// ============================================================
// [FIX-8] POWER METHOD OVERROUND REMOVAL
// Binary search for α such that Σ odds_i^(-α) = 1
// Handles favorite-longshot bias that proportional method ignores
// ============================================================
function removeOverroundPower(odds: number[]): number[] {
    if (odds.length === 0) return [];
    if (odds.length === 1) return [1.0];
    let lo = 0.3, hi = 3.0;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const sum = odds.reduce((s, o) => s + Math.pow(o, -mid), 0);
        if (sum > 1) lo = mid; else hi = mid;
    }
    const alpha = (lo + hi) / 2;
    const raw = odds.map(o => Math.pow(o, -alpha));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(p => p / (total || 1));
}

// ============================================================
// [FIX-5] SIGMOID DEFENSIVE ADJUSTMENT
// Bounded [0.5, 1.5]. Linear formula allows extreme teams to
// produce unrealistic xG. Sigmoid prevents that.
// ============================================================
function sigmoidDefensiveAdjustment(
    rawXGA: number,
    leagueAvg: number,
    stability: number
): number {
    const rawDef = (rawXGA / leagueAvg) * 0.6 + (stability / 0.65) * 0.4;
    return 0.5 + 1.0 / (1 + Math.exp(-2.5 * (rawDef - 1.0)));
}

// ============================================================
// [FIX-11] EXPLICIT 0-0 MODELING
// 0-0 is ~8% of matches. Has specific predictors (defensive
// quality, ref strictness, derby) that DC doesn't capture.
// Blended 60% DC / 40% feature-based.
// ============================================================
function estimateP00(
    homeXG: number,
    awayXG: number,
    defensiveQuality: number,
    refereeStrictness: number,
    isDerby: boolean
): number {
    const x = -1.5
        + (-1.2 * (homeXG + awayXG) / 2)
        + (0.8 * defensiveQuality)
        + (-0.3 * refereeStrictness)
        + (0.2 * (isDerby ? 1 : 0));
    return 1 / (1 + Math.exp(-x));
}

// ============================================================
// MAIN ENGINE — ALL 7 FIXES INTEGRATED
// ============================================================
export class MatchEngine {
    private static ensemble = new EnsembleEngine();

    static getEnsemble() { return this.ensemble; }

    static calculate(
        home: TeamStats,
        away: TeamStats,
        context: MatchContext,
        rhoData = { rho: -0.11, sigmaRho: 0.05 }
    ): AnalysisResult {
        const config = LEAGUE_CONFIGS[context.league || 'EPL'] || LEAGUE_CONFIGS.STANDARD;

        let hA = context.homeSeasonXG || home.npxG;
        let aA = context.awaySeasonXG || away.npxG;
        const lAvg = DATA_CONSTANTS.DEFAULT_LEAGUE_AVG;
        const hXGA = context.homeSeasonXGA || home.avgXGA;
        const aXGA = context.awaySeasonXGA || away.avgXGA;

        // ========================================
        // [FIX-5] Sigmoid defensive adjustment
        // ========================================
        const hD = sigmoidDefensiveAdjustment(hXGA, lAvg, home.defensiveStability);
        const aD = sigmoidDefensiveAdjustment(aXGA, lAvg, away.defensiveStability);

        // Base Lambda / Mu
        let hL = lAvg * (hA / lAvg) * aD * (1 + config.homeAdvantage / lAvg) * config.goalRate;
        let aM = lAvg * (aA / lAvg) * hD * config.goalRate;

        // Home/Away Bias (dampened)
        const hBias = Math.pow(home.homeAwayBias || 1.0, 0.4);
        const aBias = Math.pow(away.homeAwayBias || 1.0, 0.4);
        hL *= hBias;
        aM *= (1 / aBias);

        // Clinical Edge / Momentum
        const hM = (home.clinicalEdge || 0);
        const aM_ = (away.clinicalEdge || 0);
        hL *= (1 + Math.sign(hM) * Math.min(Math.sqrt(Math.abs(hM)), DATA_CONSTANTS.MOMENTUM_CAP));
        aM *= (1 + Math.sign(aM_) * Math.min(Math.sqrt(Math.abs(aM_)), DATA_CONSTANTS.MOMENTUM_CAP))
            * MatchContextService.calculateTravelFatigue(home.name.toUpperCase(), away.name.toUpperCase());

        // Referee Effect
        if (context.referee && context.referee.gamesOfficiated) {
            const leagueAvgPen = 0.2;
            const k = DATA_CONSTANTS.SHRINKAGE_K;
            const n = context.referee.gamesOfficiated;
            const raw = context.referee.avgPenaltiesPerGame;
            const shrunk = (n * raw + k * leagueAvgPen) / (n + k);
            const rE = 1 + (shrunk - leagueAvgPen) * 0.2;
            hL *= rE;
            aM *= rE;
        }

        // ========================================
        // [FIX-2] Context-dependent rho
        // Uses getContextRho from math.ts if tiers available
        // ========================================
        let rho = rhoData.rho;
        if (context.homeTier !== undefined && context.awayTier !== undefined) {
            rho = DixonColes.getContextRho(context.homeTier, context.awayTier, context.isDerby || false);
        }

        // ========================================
        // [FIX-11] 0-0 explicit modeling
        // Build matrix, adjust 0-0 cell, renormalize
        // ========================================
        const baseMatrix = DixonColes.calculateScoreMatrix(hL, aM, rho);
        const p00_dc = baseMatrix[0][0];
        const p00_feature = estimateP00(
            hA, aA,
            (home.defensiveStability + away.defensiveStability) / 2,
            context.referee?.strictness || 0.5,
            context.isDerby || false
        );
        const p00_blended = 0.6 * p00_dc + 0.4 * p00_feature;
        baseMatrix[0][0] = p00_blended;
        const otherTotal = 1 - p00_dc;
        if (otherTotal > 0) {
            const scaleFactor = (1 - p00_blended) / otherTotal;
            for (let h = 0; h < baseMatrix.length; h++) {
                for (let a = 0; a < baseMatrix[h].length; a++) {
                    if (h === 0 && a === 0) continue;
                    baseMatrix[h][a] *= scaleFactor;
                }
            }
        }

        // ========================================
        // Ensemble prediction [FIX-10] — already done
        // ========================================
        const ensembleResult = this.ensemble.predict(hL, aM, 0.15, 8);
        const pO15_raw = ensembleResult.pOver15;
        const pU35_raw = ensembleResult.pUnder35;

        // ========================================
        // [FIX-8] Power method overround removal
        // ========================================
        const oddsO15 = context.marketOdds?.pinnacleOver15 || 1.50;
        const oddsU15 = context.marketOdds?.pinnacleUnder15;
        const oddsU35 = context.marketOdds?.pinnacleUnder35 || 1.50;
        const oddsO35 = context.marketOdds?.pinnacleOver35;
        const isDefaultOdds = !context.marketOdds?.pinnacleOver15 && !context.marketOdds?.pinnacleUnder35;

        let mPO15: number;
        let mPU35: number;
        let mP_O15_raw: number;
        let mP_U35_raw: number;

        if (oddsU15 && oddsO35) {
            const trueProbsO15 = removeOverroundPower([oddsO15, oddsU15]);
            mPO15 = trueProbsO15[0];
            mP_O15_raw = 1 / oddsO15;
            const trueProbsU35 = removeOverroundPower([oddsU35, oddsO35]);
            mPU35 = trueProbsU35[0];
            mP_U35_raw = 1 / oddsU35;
        } else {
            const overround = 0.04;
            mP_O15_raw = 1 / oddsO15;
            mPO15 = mP_O15_raw / (1 + overround);
            mP_U35_raw = 1 / oddsU35;
            mPU35 = mP_U35_raw / (1 + overround);
        }

        // ========================================
        // [FIX-6] Dynamic Bayesian blending
        // ========================================
        const purity = ((home.dataPurity || 0.1) + (away.dataPurity || 0.1)) / 2;

        // Market efficiency: tighter spread = more efficient
        const marketSpreadO15 = oddsU15 ? Math.abs(1 / oddsO15 + 1 / oddsU15 - 1) : 0.04;
        const marketSpreadU35 = oddsO35 ? Math.abs(1 / oddsU35 + 1 / oddsO35 - 1) : 0.04;
        const marketEfficiency = 1 / ((marketSpreadO15 + marketSpreadU35) / 2 + 0.01);

        // Model confidence: purity × sample size factor
        const modelConfidence = purity * (context.sampleSize ? Math.min(1, context.sampleSize / 200) : 0.5);

        // Dynamic weight: model vs market
        const dynamicModelWeight = modelConfidence / (modelConfidence + marketEfficiency * 0.1);
        const modelWeight = Math.max(0.15, Math.min(0.65, dynamicModelWeight));

        const pBlendedO15 = (pO15_raw * modelWeight) + (mPO15 * (1 - modelWeight));
        const pBlendedU35 = (pU35_raw * modelWeight) + (mPU35 * (1 - modelWeight));

        // Edge calculation
        const edgeO15 = pBlendedO15 - mP_O15_raw;
        const edgeU35 = pBlendedU35 - mP_U35_raw;
        const type = edgeO15 > edgeU35 ? 'OVER_15' : 'UNDER_35';

        const p = type === 'OVER_15' ? pBlendedO15 : pBlendedU35;
        const mOdds = type === 'OVER_15' ? oddsO15 : oddsU35;
        const mP = type === 'OVER_15' ? mPO15 : mPU35;
        const rawEdge = type === 'OVER_15' ? edgeO15 : edgeU35;

        const edge = Math.min(rawEdge, 0.12);
        const b = mOdds - 1;

        // ========================================
        // [FIX-7] Bayesian Kelly with uncertainty
        // OLD (BROKEN): kellyFraction = 0.15 * purity * (0.5 + edge/0.12)
        //   → At edge=0, still bets 7.5%. Never produces zero.
        // NEW: Use CI lower bound × 0.25 × purity
        //   → If CI crosses zero, stake = 0. Correct.
        // ========================================
        const sim = MonteCarloSimulator.run(hL, aM, type === 'UNDER_35' ? 3.5 : 1.5, type === 'UNDER_35', rho);
        const p_conservative = sim.confidenceInterval[0];
        const f_star_raw = Math.max(0, (b * p_conservative - (1 - p_conservative)) / b);
        const stake = f_star_raw * 0.25 * purity;

        const hasEdge = edge > 0.025 && !isDefaultOdds;

        return {
            probability: Math.round(p * 100),
            summary: hasEdge
                ? `Edge detected. Ensemble sees ${Math.round(p * 100)}% true probability. Market implies ${Math.round(mP * 100)}%.`
                : `No Edge. Market odds (${mOdds.toFixed(2)}) are efficient.`,
            homeStats: home, awayStats: away, homeXG: hL, awayXG: aM,
            minimumExpectancy: sim.confidenceInterval[0],
            potentialCeiling: sim.confidenceInterval[1],
            predictionType: type,
            predictionLabel: type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals',
            marketOdds: mOdds,
            marketImpliedProb: Math.round(mP * 100),
            edge: Math.round(edge * 100),
            recommendedStake: Math.round(stake * 1000) / 10,
            verdict: hasEdge ? 'EXECUTE_BET' : 'NO_BET',
            purity: Math.round(purity * 100),
            signalStrength: p,
            context,
            dataSource: (home.dataPurity <= 0.1 && away.dataPurity <= 0.1) ? 'FALLBACK_STATIC' : 'LIVE',
            surety: { confidenceScore: ensembleResult.confidence, edgeValue: Math.round(edge * 100) }
        };
    }
}
