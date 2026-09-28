import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/freeDataService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/freeDataService')>();
  return {
    ...actual,
    isLiveCapable: true,
  };
});

import { TeamRegistry } from '../data/identity/registry';
import { runPrediction } from '../core/engine';
import * as FreeDataService from '../services/freeDataService';
import * as Calibration from '../core/calibration';
import { OddsProvider } from '../data/providers/OddsProvider';
import { DataGapError } from '../types';

describe('Data Layer Regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Global mocks for data tests to prevent network noise
    vi.spyOn(Calibration, 'fitFromAPI').mockResolvedValue({ homeAdvantage: 1.25, rho: -0.13, teams: {} });
    vi.spyOn(FreeDataService, 'getLiveOdds').mockResolvedValue([]);
    vi.spyOn(FreeDataService, 'getTeamStats').mockResolvedValue(null);
    vi.spyOn(FreeDataService, 'getHistoricalFixtures').mockResolvedValue([]);
    vi.spyOn(FreeDataService, 'getHistoricalFixturesLight').mockResolvedValue([]);
  });

  it('should never resolve generic names like "Manchester" to an arbitrary team', () => {
    expect(() => TeamRegistry.resolveByName('Manchester')).toThrow();
    expect(() => TeamRegistry.resolveByName('United')).toThrow();
    expect(TeamRegistry.resolveByName('Manchester City').id).toBe('MAN_CITY');
    expect(TeamRegistry.resolveByName('Man Utd').id).toBe('MAN_UTD');
  });

  it('should use historical prices if provided, and never call live odds in that case', async () => {
    const liveOddsSpy = vi.spyOn(FreeDataService, 'getLiveOdds');
    const historicalOdds = { 
      over25: { bestPrice: 1.85, noVigPrice: 1.90 }, 
      under25: { bestPrice: 2.10, noVigPrice: 2.15 },
      takenAt: '2024-01-01'
    } as any;
    
    const result = await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, historicalOdds);
    
    expect(liveOddsSpy).not.toHaveBeenCalled();
    expect(result.marketOdds).toBeGreaterThan(1);
    expect(result.usedRealOdds).toBe(true);
  });

  it('should produce zero stake if historical prices are missing (NO_BET fallback)', async () => {
    // Prediction without odds should result in NO_BET / 0 stake
    await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, null);
    
    // In our mock/test env if no odds are returned from getLiveOdds, it should be NO_BET
    vi.spyOn(FreeDataService, 'getLiveOdds').mockResolvedValue([]);
    const result2 = await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, null);
    
    expect(result2.verdict).toBe('NO_BET');
    expect(result2.recommendedStake).toBe(0);
  });

  it('should join historical odds by (sport, kickoff, teamNames) correctly', async () => {
    const oddsProvider = new OddsProvider();
    
    // Mock the fetchSnapshot to return a specific match
    const snapshotSpy = vi.spyOn(oddsProvider as any, 'fetchSnapshot').mockResolvedValue([
      {
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        bookmakers: [{
          markets: [{
            key: 'totals',
            outcomes: [
              { name: 'Over', price: 1.95, point: 2.5 },
              { name: 'Under', price: 2.10, point: 2.5 }
            ]
          }]
        }]
      }
    ]);

    const result = await oddsProvider.fetchHistoricalOdds('soccer_epl', '2024-01-01T15:00:00Z', 'Arsenal', 'Chelsea');
    
    expect(snapshotSpy).toHaveBeenCalled();
    expect(result.over25?.bestPrice).toBe(1.95);
    expect(result.under25?.bestPrice).toBe(2.10);
  });

  it('should throw DataGapError if no match found in snapshot', async () => {
    const oddsProvider = new OddsProvider();
    vi.spyOn(oddsProvider as any, 'fetchSnapshot').mockResolvedValue([]);

    await expect(oddsProvider.fetchHistoricalOdds('soccer_epl', '2024-01-01T15:00:00Z', 'Arsenal', 'Chelsea'))
      .rejects.toThrow(DataGapError);
  });

  it('should not call FreeDataService.getHistoricalFixturesLight if fixtureCache is provided (regression test for Fix 3)', async () => {
    const lightSpy = vi.spyOn(FreeDataService, 'getHistoricalFixturesLight');
    
    const dummyFixture = { home: 'ARSENAL', away: 'CHELSEA', homeGoals: 2, awayGoals: 1, date: '2024-01-01', league: 'EPL' };
    const fixtureCache = { 'EPL': [dummyFixture] };
    
    await runPrediction('ARSENAL', 'CHELSEA', 'EPL', null, null, null, '2024-01-02', fixtureCache);
    
    expect(lightSpy).not.toHaveBeenCalled();
  });
});
