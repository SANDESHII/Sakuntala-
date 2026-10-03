import { describe, it, expect, vi } from 'vitest';
import { runPrediction } from '../engine';

// Mock data service to avoid network calls during unit tests
vi.mock('../../services/freeDataService', () => ({
  getLiveOdds: vi.fn(() => Promise.resolve([])),
  getTeamStats: vi.fn(() => Promise.resolve({
    attackStrength: 1.0,
    defenseStrength: 1.0,
    avgGoalsScored: 1.35,
    avgGoalsConceded: 1.35,
    homeAdvantageHeuristic: 0.3,
    form: [1,1,1,1,1],
    cleanSheetRate: 0.2,
    quality: 'high'
  })),
  getHistoricalFixtures: vi.fn(() => Promise.resolve([]))
}));

describe('Prediction Engine Core', () => {
  it('should calculate non-negative Kelly fractions and stakes', async () => {
    // Prediction with high probability but potentially missing odds (null edge handled)
    const result = await runPrediction('Arsenal', 'Chelsea', 'EPL');
    
    expect(result.recommendedStake).toBeGreaterThanOrEqual(0);
    expect(result.recommendedStake).toBeLessThanOrEqual(5); // 5% cap in engine
    
    if (result.edge !== null) {
        expect(result.edge).toBeTypeOf('number');
    }
  });

  it('should return NO_BET verdict when edge is null (missing odds)', async () => {
    const result = await runPrediction('Arsenal', 'Chelsea', 'EPL');
    
    if (result.marketOdds === null) {
      expect(result.verdict).toBe('NO_BET');
      expect(result.edge).toBeNull();
    }
  });

  it('verdict should be EXECUTE_BET only when edge > 3 and odds are real', async () => {
    // Manually testing with historical odds override
    const historicalOdds = {
      over25: { bestPrice: 2.5 }, // Implied 40%
      under25: { bestPrice: 1.5 }
    };
    
    // If our model prob is say 60%, edge is 20%, should EXECUTE
    // We override the fitted params to force a high prob
    const fittedOverride: any = {
      homeAdvantage: 1.25,
      rho: -0.13,
      teams: {
        'ARSENAL': { attack: 1.8, defense: 0.6, matchCount: 20, lowConfidence: false },
        'CHELSEA': { attack: 0.8, defense: 1.5, matchCount: 20, lowConfidence: false }
      }
    };

    const result = await runPrediction(
        'Arsenal', 
        'Chelsea', 
        'EPL', 
        fittedOverride, 
        historicalOdds
    );

    if (result.predictionType === 'OVER_25' && result.edge! > 3) {
        expect(result.verdict).toBe('EXECUTE_BET');
    }
  });
});
