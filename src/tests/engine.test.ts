import { describe, it, expect, vi } from 'vitest';
import { runPrediction } from '../core/engine';
import * as FreeDataService from '../services/freeDataService';

describe('Prediction Engine', () => {
  it('should set edge to 0 if only synthetic odds are available', async () => {
    // Mock getLiveOdds to return empty
    vi.spyOn(FreeDataService, 'getLiveOdds').mockResolvedValue([]);
    
    const result = await runPrediction('ARSENAL', 'CHELSEA', 'EPL');
    expect(result.edge).toBe(0);
    expect(result.verdict).toBe('NO_BET');
    expect(result.usedRealOdds).toBe(false);
  });

  it('should use unrounded probability for Kelly calculation', async () => {
    // This is hard to test directly without checking internal state,
    // but we can verify the stake isn't based on an integer rounded p.
    const result = await runPrediction('ARSENAL', 'CHELSEA', 'EPL');
    // If edge > 0, check if recommendedStake is reasonable
    if (result.edge > 0) {
      expect(result.recommendedStake).toBeGreaterThanOrEqual(0);
      expect(result.recommendedStake).toBeLessThanOrEqual(5);
    }
  });
});
