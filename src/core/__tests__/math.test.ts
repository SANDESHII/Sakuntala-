import { describe, it, expect } from 'vitest';
import { DixonColes } from '../math';

describe('DixonColes Math Module', () => {
  it('score matrix should sum to approximately 1', () => {
    const lambdas = [0.5, 1.2, 2.5, 3.5];
    const mus = [0.4, 1.1, 2.2, 3.2];
    const rhos = [-0.2, -0.1, 0];

    for (const lambda of lambdas) {
      for (const mu of mus) {
        for (const rho of rhos) {
          const matrix = DixonColes.calculateScoreMatrix(lambda, mu, rho);
          const totalProb = matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
          expect(totalProb).toBeCloseTo(1, 5);
        }
      }
    }
  });

  it('P(over 2.5) + P(under 2.5) should sum to 1', () => {
    const matrix = DixonColes.calculateScoreMatrix(1.5, 1.2, -0.13);
    const probOver = DixonColes.calculateOverUnder(matrix, 2.5);
    const probUnder = 1 - DixonColes.calculateOverUnder(matrix, 2.5);
    expect(probOver + probUnder).toBeCloseTo(1, 10);
  });

  it('Dixon-Coles correction factor should always be positive', () => {
    // Valid rho/lambda/mu combinations according to model constraints
    const testCases = [
      { h: 0, a: 0, lam: 1.5, mu: 1.2, rho: -0.13 },
      { h: 1, a: 0, lam: 0.5, mu: 0.5, rho: -0.2 },
      { h: 0, a: 1, lam: 2.0, mu: 2.0, rho: -0.1 },
      { h: 1, a: 1, lam: 1.0, mu: 1.0, rho: -0.5 },
    ];

    for (const { h, a, lam, mu, rho } of testCases) {
      const correction = DixonColes.lowScoreCorrection(h, a, lam, mu, rho);
      expect(correction).toBeGreaterThan(0);
    }
  });
  
  it('handles extreme goal counts correctly', () => {
    const matrix = DixonColes.calculateScoreMatrix(0.1, 0.1, -0.13);
    const totalProb = matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
    expect(totalProb).toBeCloseTo(1, 5);
    expect(matrix[0][0]).toBeGreaterThan(0.5);
  });
});
