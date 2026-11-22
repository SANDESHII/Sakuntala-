// Pre-compute log factorials for k up to 40 for numerical stability and performance
const LOG_FACTORIAL = [0];
for (let i = 1; i <= 40; i++) {
  LOG_FACTORIAL[i] = LOG_FACTORIAL[i - 1] + Math.log(i);
}

import { DEFAULT_RHO } from './constants';
import { DerivedMarkets, ExactScoreProb } from '../types';

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
    if (!Number.isInteger(k)) return 0;
    if (lambda <= 0) return k === 0 ? 1 : 0;
    if (k < 0 || k >= 41) return 0;
    return Math.exp(k * Math.log(lambda) - lambda - LOG_FACTORIAL[k]);
  }

  /**
   * Dixon-Coles correction factor for low-scoring outcomes
   * Adjusts for the tendency of 0-0, 0-1, 1-0, 1-1 to occur more/less than Poisson predicts
   */
  static lowScoreCorrection(
    homeGoals: number,
    awayGoals: number,
    lambdaHome: number,
    muAway: number,
    rho: number
  ): number {
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
  private static readonly MAX_CACHE_SIZE = 100;

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
    let k = 0;
    let p = Math.exp(-maxMean);
    let sum = p;

    while (1 - sum > epsilon && k < 40) {
      k++;
      p *= maxMean / k;
      sum += p;
    }

    const limit = Math.max(8, k);

    const homeVec = new Array<number>(limit + 1);
    homeVec[0] = lambdaHome <= 0 ? 1 : Math.exp(-lambdaHome);
    for (let i = 1; i <= limit; i++) {
      homeVec[i] = lambdaHome <= 0 ? 0 : (homeVec[i - 1] * lambdaHome) / i;
    }

    const awayVec = new Array<number>(limit + 1);
    awayVec[0] = muAway <= 0 ? 1 : Math.exp(-muAway);
    for (let j = 1; j <= limit; j++) {
      awayVec[j] = muAway <= 0 ? 0 : (awayVec[j - 1] * muAway) / j;
    }

    const matrix = Array.from({ length: limit + 1 }, (_, homeGoals) =>
      Array.from({ length: limit + 1 }, (_, awayGoals) => {
        const correction = this.lowScoreCorrection(homeGoals, awayGoals, lambdaHome, muAway, rho);
        return homeVec[homeGoals] * awayVec[awayGoals] * correction;
      })
    );

    // Normalize to ensure probabilities sum to 1 precisely
    const total = matrix.reduce((s, row) => s + row.reduce((ss, prob) => ss + prob, 0), 0);
    const result = matrix.map((row) => row.map((prob) => prob / (total || 1)));
    this.matrixCache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate probability of over a goal threshold
   */
  static calculateOverUnder(scoreMatrix: number[][], threshold: number): number {
    return scoreMatrix.reduce(
      (sum, row, homeGoals) =>
        sum +
        row.reduce(
          (s, prob, awayGoals) => s + (homeGoals + awayGoals > threshold ? prob : 0),
          0
        ),
      0
    );
  }

  /**
   * Derive 1X2, multiple goal lines (1.5 / 2.5 / 3.5), and BTTS probabilities from the score matrix
   */
  static calculateDerivedMarkets(scoreMatrix: number[][]): DerivedMarkets {
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    let over15 = 0;
    let over25 = 0;
    let over35 = 0;
    let bttsYes = 0;

    for (let h = 0; h < scoreMatrix.length; h++) {
      for (let a = 0; a < scoreMatrix[h].length; a++) {
        const prob = scoreMatrix[h][a] || 0;
        if (h > a) homeWin += prob;
        else if (h === a) draw += prob;
        else awayWin += prob;

        const total = h + a;
        if (total > 1.5) over15 += prob;
        if (total > 2.5) over25 += prob;
        if (total > 3.5) over35 += prob;
        if (h >= 1 && a >= 1) bttsYes += prob;
      }
    }

    return {
      homeWin,
      draw,
      awayWin,
      over15,
      under15: 1 - over15,
      over25,
      under25: 1 - over25,
      over35,
      under35: 1 - over35,
      bttsYes,
      bttsNo: 1 - bttsYes,
    };
  }

  /**
   * Return top N exact scorelines sorted by probability descending
   */
  static getTopScorelines(scoreMatrix: number[][], topN = 6): ExactScoreProb[] {
    const list: ExactScoreProb[] = [];
    const maxScore = Math.min(scoreMatrix.length, 7);
    for (let h = 0; h < maxScore; h++) {
      for (let a = 0; a < maxScore; a++) {
        list.push({ home: h, away: a, probability: scoreMatrix[h][a] || 0 });
      }
    }
    list.sort((a, b) => b.probability - a.probability);
    return list.slice(0, topN);
  }
}
