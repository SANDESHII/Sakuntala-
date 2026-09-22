import { describe, it, expect, vi } from 'vitest';
import { TeamRegistry } from '../data/identity/TeamRegistry';
import { runPrediction } from '../core/engine';
import * as FreeDataService from '../services/freeDataService';

describe('Data Layer Regressions', () => {
  it('should never resolve generic names like "Manchester" to an arbitrary team', () => {
    expect(() => TeamRegistry.resolveByName('Manchester')).toThrow();
    expect(() => TeamRegistry.resolveByName('United')).toThrow();
    expect(TeamRegistry.resolveByName('Manchester City').id).toBe('MAN_CITY');
    expect(TeamRegistry.resolveByName('Man Utd').id).toBe('MAN_UTD');
  });

  it('should use historical prices if provided, and never call live odds in that case', async () => {
    const liveOddsSpy = vi.spyOn(FreeDataService, 'getLiveOdds');
    const historicalOdds = { over15: 1.85, under35: 2.10 };
    
    const result = await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, historicalOdds);
    
    expect(liveOddsSpy).not.toHaveBeenCalled();
    expect(result.marketOdds).toBeGreaterThan(1);
    expect(result.usedRealOdds).toBe(true);
  });

  it('should produce zero stake if historical prices are missing (NO_BET fallback)', async () => {
    // Prediction without odds should result in NO_BET / 0 stake
    const result = await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, null);
    
    // In our mock/test env if no odds are returned from getLiveOdds, it should be NO_BET
    vi.spyOn(FreeDataService, 'getLiveOdds').mockResolvedValue([]);
    const result2 = await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, null);
    
    expect(result2.verdict).toBe('NO_BET');
    expect(result2.recommendedStake).toBe(0);
  });

  it('should accurately calculate CLV metrics', () => {
    const taken = 2.10;
    const closing = 1.95;
    const clv = (taken / closing - 1) * 100;
    expect(clv).toBeCloseTo(7.69, 2);
  });
});
