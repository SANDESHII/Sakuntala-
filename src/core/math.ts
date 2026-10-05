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
   * 
   * @param k - Discrete value (goals)
   * @param lambda - Expected value (mean)
   * @returns Probability of k occurring
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
   * 
   * @param homeGoals - Home team goals
   * @param awayGoals - Away team goals
   * @param lambdaHome - Home team expected goals
   * @param muAway - Away team expected goals
   * @param rho - Correlation parameter
   * @returns Adjustment multiplier for the probability
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

  /**
   * Generate full score probability matrix using Dixon-Coles model
   * @param lambdaHome - Home team expected goals
   * @param muAway - Away team expected goals
   * @param rho - Correlation parameter (default: -0.13)
   * @param epsilon - Target error threshold for tail truncation (default: 1e-8)
   */
  static calculateScoreMatrix(
    lambdaHome: number,
    muAway: number,
    rho: number = DEFAULT_RHO,
    epsilon: number = 1e-8
  ): number[][] {
    const cacheKey = `${lambdaHome.toFixed(3)}|${muAway.toFixed(3)}|${rho.toFixed(3)}`;
    if (this.matrixCache.has(cacheKey)) return this.matrixCache.get(cacheKey)!;

    // Dynamically calculate required goal limit to satisfy epsilon threshold
    // P(X > k) < epsilon where X ~ Poisson(max(lambdaHome, muAway))
    const maxMean = Math.max(lambdaHome, muAway, 0.1);
    let k = Math.ceil(maxMean);
    let p = Math.exp(-maxMean);
    let sum = p;
    
    // Iteratively find k such that the tail probability is negligible
    while (1 - sum > epsilon && k < 40) {
      k++;
      p *= maxMean / k;
      sum += p;
    }
    
    const limit = Math.max(8, k); // Ensure a reasonable minimum matrix size

    const matrix = Array.from({ length: limit + 1 }, (_, homeGoals) =>
      Array.from({ length: limit + 1 }, (_, awayGoals) => {
        const probHome = this.poisson(homeGoals, lambdaHome);
        const probAway = this.poisson(awayGoals, muAway);
        const correction = this.lowScoreCorrection(homeGoals, awayGoals, lambdaHome, muAway, rho);
        return probHome * probAway * correction;
      })
    );

    // Normalize to ensure probabilities sum to 1 precisely
    // This is still required due to the Dixon-Coles correction shifting the distribution
    const total = matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
    return matrix.map(row => row.map(p => p / (total || 1)));
  }

  /**
   * Calculate probability of over/under a goal threshold
   * @param scoreMatrix - Full score probability matrix
   * @param threshold - Goal threshold (e.g., 1.5 for Over 1.5)
   */
  static calculateOverUnder(scoreMatrix: number[][], threshold: number): number {
    return scoreMatrix.reduce((sum, row, homeGoals) =>
      sum + row.reduce((s, prob, awayGoals) =>
        s + (homeGoals + awayGoals > threshold ? prob : 0), 0), 0);
  }
}

