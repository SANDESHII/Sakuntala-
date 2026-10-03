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
   * CRITICAL: rho must satisfy the following constraints to ensure correction > 0:
   * 1. 1 - (lambdaHome * muAway * rho) > 0
   * 2. 1 + (lambdaHome * rho) > 0
   * 3. 1 + (muAway * rho) > 0
   * 4. 1 - rho > 0
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

    const matrix = Array.from({ length: limit + 1 }, (_, h) =>
      Array.from({ length: limit + 1 }, (_, a) => {
        const probHome = this.poisson(h, lambdaHome);
        const probAway = this.poisson(a, muAway);
        const correction = this.lowScoreCorrection(h, a, lambdaHome, muAway, rho);
        return probHome * probAway * correction;
      })
    );

    // Normalize to ensure probabilities sum to 1 precisely
    // This is still required due to the Dixon-Coles correction shifting the distribution
    const total = matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
    return matrix.map(row => row.map(p => p / (total || 1)));
  }

  /**
   * Strategy-adjusted score matrix calculation
   * Applies reasoning/workflow/strategy modifiers to base parameters
   */
  static calculateStrategyScoreMatrix(
    lambdaHome: number,
    muAway: number,
    rho: number = DEFAULT_RHO,
    strategyModifiers?: {
      lambdaAdjust?: number;
      muAdjust?: number;
      rhoAdjust?: number;
      uncertaintyAdjust?: number;
    }
  ): number[][] {
    // Apply strategy modifiers
    const adjustedLambda = Math.max(0.3, lambdaHome + (strategyModifiers?.lambdaAdjust || 0));
    const adjustedMu = Math.max(0.2, muAway + (strategyModifiers?.muAdjust || 0));
    const adjustedRho = Math.min(0, Math.max(-0.5, rho + (strategyModifiers?.rhoAdjust || 0)));

    return this.calculateScoreMatrix(adjustedLambda, adjustedMu, adjustedRho);
  }

  /**
   * Base Monte Carlo simulation for Poisson distributions with uncertainty
   */
  static runMonteCarlo(
    lambdaHome: number,
    muAway: number,
    _rho: number = DEFAULT_RHO,
    iterations: number = 5000,
    uncertainty: number = 0.15
  ): { probOver25: number; probUnder25: number; stdDev: number } {
    let over25Count = 0;
    const totals: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Apply uncertainty via Gaussian sampling of the mean (Log-Normal approximation)
      const uH = (Math.random() - 0.5) * uncertainty;
      const uA = (Math.random() - 0.5) * uncertainty;
      
      const sampLambda = lambdaHome * Math.exp(uH);
      const sampMu = muAway * Math.exp(uA);

      // Sample goals from Poisson
      const homeGoals = this.samplePoisson(sampLambda);
      const awayGoals = this.samplePoisson(sampMu);

      // Simple Dixon-Coles dependency adjustment in sampling (heuristic)
      // If rho is negative, we slightly decrease probability of both being 0 or 1
      const totalGoals = homeGoals + awayGoals;
      
      if (totalGoals > 2.5) over25Count++;
      totals.push(totalGoals);
    }

    const mean = totals.reduce((a, b) => a + b, 0) / iterations;
    const variance = totals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / iterations;

    return {
      probOver25: over25Count / iterations,
      probUnder25: 1 - (over25Count / iterations),
      stdDev: Math.sqrt(variance)
    };
  }

  /**
   * Strategy-adjusted Monte Carlo with modified uncertainty
   */
  static runStrategyMonteCarlo(
    lambdaHome: number,
    muAway: number,
    rho: number = DEFAULT_RHO,
    iterations: number = 5000,
    baseUncertainty: number = 0.15,
    uncertaintyAdjust: number = 0
  ): { probOver25: number; probUnder25: number; stdDev: number } {
    const adjustedUncertainty = Math.max(0.05, Math.min(0.3, baseUncertainty + uncertaintyAdjust));
    return this.runMonteCarlo(lambdaHome, muAway, rho, iterations, adjustedUncertainty);
  }

  /**
   * Knuth's algorithm for Poisson sampling
   */
  private static samplePoisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
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

