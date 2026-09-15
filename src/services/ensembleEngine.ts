import { DixonColes, BivariatePoisson, GoalDistribution } from '../core/math';

export interface ModelPrediction {
    modelId: string;
    pOver15: number;
    pUnder35: number;
    homeXG: number;
    awayXG: number;
    confidence: number;
}

export interface ModelPerformance {
    modelId: string;
    predictions: number;
    correct: number;
    accuracy: number;
    logLikelihood: number;
    weight: number;
}

export interface EnsembleConfig {
    lookbackMatches: number;
    temperatureScale: number;
    minWeight: number;
    recencyDecay: number;
}

const DEFAULT_CONFIG: EnsembleConfig = {
    lookbackMatches: 100,
    temperatureScale: 2.0,
    minWeight: 0.05,
    recencyDecay: 0.005,
};

export function predictDC(
    homeXG: number, awayXG: number, rho: number = -0.11
): ModelPrediction {
    const matrix = DixonColes.calculateScoreMatrix(homeXG, awayXG, rho);
    const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
    const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);
    return {
        modelId: 'dixon-coles',
        pOver15: pO15,
        pUnder35: pU35,
        homeXG, awayXG,
        confidence: 0.7,
    };
}

export function predictPoisson(
    homeXG: number, awayXG: number
): ModelPrediction {
    const matrix = DixonColes.calculateScoreMatrix(homeXG, awayXG, 0);
    const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
    const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);
    return {
        modelId: 'independent-poisson',
        pOver15: pO15,
        pUnder35: pU35,
        homeXG, awayXG,
        confidence: 0.5,
    };
}

export function predictBivariate(
    homeXG: number, awayXG: number, lambda3: number = 0.15
): ModelPrediction {
    const l1 = Math.max(0.1, homeXG - lambda3);
    const l2 = Math.max(0.1, awayXG - lambda3);
    const matrix = BivariatePoisson.calculateScoreMatrix(l1, l2, lambda3);
    const pO15 = DixonColes.calculateOverUnder(matrix, 1.5);
    const pU35 = 1 - DixonColes.calculateOverUnder(matrix, 3.5);
    return {
        modelId: 'bivariate-poisson',
        pOver15: pO15,
        pUnder35: pU35,
        homeXG, awayXG,
        confidence: 0.65,
    };
}

export function predictNegBin(
    homeXG: number, awayXG: number, r: number = 8
): ModelPrediction {
    const max = 8;
    const matrix: number[][] = [];
    for (let h = 0; h <= max; h++) {
        matrix[h] = [];
        for (let a = 0; a <= max; a++) {
            matrix[h][a] = GoalDistribution.negativeBinomial(h, homeXG, r)
                         * GoalDistribution.negativeBinomial(a, awayXG, r);
        }
    }
    const total = matrix.reduce((s, row) => s + row.reduce((rs, p) => rs + p, 0), 0);
    const normed = matrix.map(row => row.map(p => p / (total || 1)));

    const pO15 = DixonColes.calculateOverUnder(normed, 1.5);
    const pU35 = 1 - DixonColes.calculateOverUnder(normed, 3.5);
    return {
        modelId: 'negative-binomial',
        pOver15: pO15,
        pUnder35: pU35,
        homeXG, awayXG,
        confidence: 0.6,
    };
}

export class EnsembleEngine {
    private performance: Map<string, ModelPerformance> = new Map();
    private config: EnsembleConfig;

    constructor(config: Partial<EnsembleConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        const models = ['dixon-coles', 'independent-poisson', 'bivariate-poisson', 'negative-binomial'];
        models.forEach(id => {
            this.performance.set(id, {
                modelId: id, predictions: 0, correct: 0,
                accuracy: 0.5, logLikelihood: 0, weight: 1 / models.length,
            });
        });
    }

    predict(homeXG: number, awayXG: number, lambda3: number = 0.15, negBinR: number = 8): ModelPrediction {
        const models = [
            predictDC(homeXG, awayXG),
            predictPoisson(homeXG, awayXG),
            predictBivariate(homeXG, awayXG, lambda3),
            predictNegBin(homeXG, awayXG, negBinR),
        ];

        const weights = this.getWeights();

        let pO15 = 0, pU35 = 0, totalWeight = 0;
        models.forEach((pred, i) => {
            const w = weights[i];
            pO15 += pred.pOver15 * w;
            pU35 += pred.pUnder35 * w;
            totalWeight += w;
        });

        return {
            modelId: 'ensemble',
            pOver15: pO15 / totalWeight,
            pUnder35: pU35 / totalWeight,
            homeXG, awayXG,
            confidence: this.ensembleConfidence(models, weights),
        };
    }

    updateAll(homeXG: number, awayXG: number, isO15: boolean, isU35: boolean): void {
        const models = [
            predictDC(homeXG, awayXG),
            predictPoisson(homeXG, awayXG),
            predictBivariate(homeXG, awayXG),
            predictNegBin(homeXG, awayXG),
        ];

        models.forEach(m => {
            this.updatePerformance(m.modelId, m.pOver15, isO15 ? 1 : 0);
            this.updatePerformance(m.modelId, m.pUnder35, isU35 ? 1 : 0);
        });
    }

    updatePerformance(modelId: string, predictedProb: number, actualOutcome: number): void {
        const perf = this.performance.get(modelId);
        if (!perf) return;

        const clampedProb = Math.max(0.001, Math.min(0.999, predictedProb));
        const ll = actualOutcome * Math.log(clampedProb) + (1 - actualOutcome) * Math.log(1 - clampedProb);
        const alpha = 0.1;
        perf.logLikelihood = perf.logLikelihood * (1 - alpha) + ll;
        perf.predictions++;
        if ((predictedProb > 0.5 && actualOutcome === 1) || (predictedProb <= 0.5 && actualOutcome === 0)) {
            perf.correct++;
        }
        perf.accuracy = perf.correct / perf.predictions;
        this.recalculateWeights();
    }

    getWeights(): number[] {
        const models = Array.from(this.performance.values());
        const lls = models.map(m => m.logLikelihood * this.config.temperatureScale);
        const maxLL = Math.max(...lls);
        const exps = lls.map(ll => Math.exp(ll - maxLL));
        const sumExp = exps.reduce((a, b) => a + b, 0);
        let weights = exps.map(e => e / (sumExp || 1));
        const minW = this.config.minWeight;
        weights = weights.map(w => Math.max(minW, w));
        const sumW = weights.reduce((a, b) => a + b, 0);
        return weights.map(w => w / (sumW || 1));
    }

    private ensembleConfidence(models: ModelPrediction[], weights: number[]): number {
        const sumW = weights.reduce((a, b) => a + b, 0);
        const avgConfidence = models.reduce((sum, m, i) => sum + m.confidence * weights[i], 0) / (sumW || 1);
        const pO15Values = models.map(m => m.pOver15);
        const mean = pO15Values.reduce((a, b) => a + b, 0) / pO15Values.length;
        const variance = pO15Values.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pO15Values.length;
        const disagreementPenalty = Math.min(0.3, variance * 5);
        return Math.max(0.2, avgConfidence - disagreementPenalty);
    }

    private recalculateWeights(): void {
        const weights = this.getWeights();
        const modelIds = Array.from(this.performance.keys());
        modelIds.forEach((id, i) => {
            const perf = this.performance.get(id)!;
            perf.weight = weights[i];
        });
    }

    getPerformanceSummary(): ModelPerformance[] {
        return Array.from(this.performance.values()).sort((a, b) => b.weight - a.weight);
    }

    exportState(): Record<string, ModelPerformance> {
        const state: Record<string, ModelPerformance> = {};
        this.performance.forEach((perf, id) => { state[id] = { ...perf }; });
        return state;
    }

    importState(state: Record<string, ModelPerformance>): void {
        Object.entries(state).forEach(([id, perf]) => {
            this.performance.set(id, { ...perf });
        });
    }
}
