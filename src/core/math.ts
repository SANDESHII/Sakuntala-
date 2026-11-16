// Pre-compute log factorials for k up to 40 for numerical stability and performance
const LOG_FACTORIAL = [0];
for (let i = 1; i <= 40; i++) {
  LOG_FACTORIAL[i] = LOG_FACTORIAL[i - 1] + Math.log(i);
}

import { DEFAULT_RHO } from './constants';

/**
 * Dixon-Coles statistical model for football score prediction
 * Reference: Dixon, M. J., & Coles, S. G. (1997). "Modelling Association Football Scores and Inefficiencies in the Football Betting Market"
 */
export class DixonColes {
  /**
   * Poisson probability mass function (log-space for numerical stability)
   * P(X=k) = (λ^k × e^(-λ)) / k!
   */
  static poisson(k: number, lambda: number): number {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    if (k < 0 || k >= 41) return 0; // matching precomputed log factorial length
    return Math.exp(k * Math.log(lambda) - lambda - LOG_FACTORIAL[k]);
  }

  /**
   * Dixon-Coles correction factor for low-scoring outcomes
   * Adjusts for the tendency of 0-0, 0-1, 1-0, 1-1 to occur more/less than Poisson predicts
   * 
   * CRITICAL: rho must satisfy specific constraints to ensure correction > 0.
   */
  static lowScoreCorrection(
    homeGoals: number,
    awayGoals: number,
    lambdaHome: number,
    muAway: number,
    rho: number
  ): number {
    // Dynamically constrain rho for this specific lambda/mu pair to maintain mathematical validity
    const minRho = -1 / Math.max(lambdaHome, muAway, 1);
    const maxRho = Math.min(1, 1 / (lambdaHome * muAway || 1));
    const safeRho = Math.max(minRho + 0.001, Math.min(maxRho - 0.001, rho));

    if (homeGoals === 0 && awayGoals === 0) {
      return 1 - (lambdaHome * muAway * safeRho);
    } else if (homeGoals === 0 && awayGoals === 1) {
      return 1 + (lambdaHome * safeRho);
    } else if (homeGoals === 1 && awayGoals === 0) {
      return 1 + (muAway * safeRho);
    } else if (homeGoals === 1 && awayGoals === 1) {
      return 1 - safeRho;
    }
    return 1;
  }

  private static matrixCache = new Map<string, number[][]>();
  private static readonly MAX_CACHE_SIZE = 50;

  /**
   * Generate full score probability matrix using Dixon-Coles model
   */
  static calculateScoreMatrix(
    lambdaHome: number,
    muAway: number,
    rho: number = DEFAULT_RHO,
    epsilon: number = 1e-8
  ): number[][] {
    const cacheKey = `${lambdaHome.toFixed(3)}|${muAway.toFixed(3)}|${rho.toFixed(3)}`;
    if (this.matrixCache.has(cacheKey)) return this.matrixCache.get(cacheKey)!;

    if (this.matrixCache.size >= DixonColes.MAX_CACHE_SIZE) {
      const firstKey = this.matrixCache.keys().next().value;
      if (firstKey) this.matrixCache.delete(firstKey);
    }

    const maxMean = Math.max(lambdaHome, muAway, 0.1);
    let k = Math.ceil(maxMean);
    let p = Math.exp(-maxMean);
    let sum = p;
    
    while (1 - sum > epsilon && k < 40) {
      k++;
      p *= maxMean / k;
      sum += p;
    }
    
    const limit = Math.max(8, k); 

    const matrix = Array.from({ length: limit + 1 }, (_, homeGoals) =>
      Array.from({ length: limit + 1 }, (_, awayGoals) => {
        const probHome = this.poisson(homeGoals, lambdaHome);
        const probAway = this.poisson(awayGoals, muAway);
        const correction = this.lowScoreCorrection(homeGoals, awayGoals, lambdaHome, muAway, rho);
        return probHome * probAway * correction;
      })
    );

    // Normalize to ensure probabilities sum to 1 precisely
    const total = matrix.reduce((s, row) => s + row.reduce((ss, p) => ss + p, 0), 0);
    return matrix.map(row => row.map(p => p / (total || 1)));
  }

  /**
   * Calculate probability of over/under a goal threshold
   */
  static calculateOverUnder(scoreMatrix: number[][], threshold: number): number {
    return scoreMatrix.reduce((sum, row, homeGoals) =>
      sum + row.reduce((s, prob, awayGoals) =>
        s + (homeGoals + awayGoals > threshold ? prob : 0), 0), 0);
  }
}
