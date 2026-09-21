// Pre-compute log factorials for k up to 20 for numerical stability and performance
const LOG_FACTORIAL = [0];
for (let i = 1; i <= 20; i++) {
  LOG_FACTORIAL[i] = LOG_FACTORIAL[i - 1] + Math.log(i);
}

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
    if (k < 0 || k >= LOG_FACTORIAL.length) return 0;
    return Math.exp(k * Math.log(lambda) - lambda - LOG_FACTORIAL[k]);
  }

  /**
   * Dixon-Coles correction factor for low-scoring outcomes
   * Adjusts for the tendency of 0-0, 0-1, 1-0, 1-1 to occur more/less than Poisson predicts
   * @param homeGoals - Home team goals scored
   * @param awayGoals - Away team goals scored
   * @param lambdaHome - Home team expected goals
   * @param muAway - Away team expected goals
   * @param rho - Correlation parameter (typically -0.11)
   */
  static lowScoreCorrection(
    homeGoals: number,
    awayGoals: number,
    lambdaHome: number,
    muAway: number,
    rho: number
  ): number {
    let correction = 1;
    if (homeGoals === 0 && awayGoals === 0) {
      correction = 1 - (lambdaHome * muAway * rho);
    } else if (homeGoals === 0 && awayGoals === 1) {
      correction = 1 + (lambdaHome * rho);
    } else if (homeGoals === 1 && awayGoals === 0) {
      correction = 1 + (muAway * rho);
    } else if (homeGoals === 1 && awayGoals === 1) {
      correction = 1 - rho;
    }
    return Math.max(0.0001, correction);
  }

  /**
   * Generate full score probability matrix using Dixon-Coles model
   * @param lambdaHome - Home team expected goals
   * @param muAway - Away team expected goals
   * @param rho - Correlation parameter (default: -0.13)
   * @param maxGoals - Maximum goals to consider (default: 8)
   */
  static calculateScoreMatrix(
    lambdaHome: number,
    muAway: number,
    rho: number = -0.13,
    maxGoals: number = 8
  ): number[][] {
    const matrix = Array.from({ length: maxGoals + 1 }, (_, h) =>
      Array.from({ length: maxGoals + 1 }, (_, a) => {
        const probHome = this.poisson(h, lambdaHome);
        const probAway = this.poisson(a, muAway);
        const correction = this.lowScoreCorrection(h, a, lambdaHome, muAway, rho);
        return probHome * probAway * correction;
      })
    );

    // Normalize to ensure probabilities sum to 1
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

