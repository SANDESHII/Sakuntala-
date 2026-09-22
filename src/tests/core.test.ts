import { describe, it, expect } from 'vitest';
import { DixonColes } from '../core/math';
import { fitDixonColes, predictGoals } from '../core/calibration';

describe('DixonColes Math', () => {
  it('should sum probabilities to 1 after normalization', () => {
    const matrix = DixonColes.calculateScoreMatrix(1.5, 1.2, -0.13, 12);
    const total = matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('should correctly calculate Over 1.5 probability', () => {
    const matrix = [
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.2]
    ];
    // Over 1.5: (0,2), (1,1), (1,2), (2,0), (2,1), (2,2)
    // Probabilities: 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.2 = 0.7
    const prob = DixonColes.calculateOverUnder(matrix, 1.5);
    expect(prob).toBeCloseTo(0.7, 5);
  });
});

describe('Calibration Engine', () => {
  it('should preserve base scoring rate after normalization', () => {
    const matches = [
      { home: 'A', away: 'B', hg: 2, ag: 1 },
      { home: 'B', away: 'A', hg: 1, ag: 0 }
    ];
    const fitted = fitDixonColes(matches, 100, 0.1);
    
    // Average attack should be exactly 1.0
    const teams = Object.values(fitted.teams);
    const avgAtk = teams.reduce((s, t) => s + t.attack, 0) / teams.length;
    expect(avgAtk).toBeCloseTo(1.0, 5);
    
    // Defense should NOT be forced to 1.0, preserving the base rate
    // In this small sample, defense will be whatever fits the goals
  });

  it('should predict goals using fitted parameters (case-insensitive)', () => {
    const fitted = {
      homeAdvantage: 1.2,
      rho: -0.1,
      teams: {
        'ARSENAL': { attack: 1.5, defense: 0.8 },
        'CHELSEA': { attack: 1.2, defense: 1.1 }
      }
    };
    
    const goals = predictGoals(fitted, 'arsenal', 'Chelsea');
    expect(goals).not.toBeNull();
    if (goals) {
      // lambdaHome = 1.5 (atk) * 1.1 (def) * 1.2 (gamma) = 1.98
      expect(goals.lambdaHome).toBeCloseTo(1.98, 5);
      // muAway = 1.2 (atk) * 0.8 (def) = 0.96
      expect(goals.muAway).toBeCloseTo(0.96, 5);
    }
  });
});
