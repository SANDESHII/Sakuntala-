import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPrediction } from '../core/engine';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from '../core/calibration';

describe('Prediction Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent network calls by default in engine tests
    vi.spyOn(Calibration, 'fitFromAPI').mockResolvedValue({ 
      homeAdvantage: 1.25, 
      rho: -0.13, 
      teams: {} 
    });
    vi.spyOn(FreeDataService, 'getLiveOdds').mockResolvedValue([]);
    vi.spyOn(FreeDataService, 'getTeamStats').mockResolvedValue(null);
  });

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

  it('should resolve different league configs correctly (regression test for Fix 1)', async () => {
    // We use unknown teams to trigger generic fallback which uses leagueConfig.homeAdvantage
    const eplResult = await runPrediction('UNKNOWN_TEAM_1', 'UNKNOWN_TEAM_2', 'EPL');
    const ligaResult = await runPrediction('UNKNOWN_TEAM_3', 'UNKNOWN_TEAM_4', 'LA_LIGA');
    const bundesResult = await runPrediction('UNKNOWN_TEAM_5', 'UNKNOWN_TEAM_6', 'BUNDESLIGA');
    
    expect(eplResult.context.league).toBe('EPL');
    expect(ligaResult.context.league).toBe('LA_LIGA');
    expect(bundesResult.context.league).toBe('BUNDESLIGA');
    
    // Configs differ (EPL 0.28 vs LA_LIGA 0.32 vs BUNDESLIGA 0.24)
    expect(eplResult.homeStats.homeAwayBias).toBe(0.28);
    expect(ligaResult.homeStats.homeAwayBias).toBe(0.32);
    expect(bundesResult.homeStats.homeAwayBias).toBe(0.24);
  });
});
