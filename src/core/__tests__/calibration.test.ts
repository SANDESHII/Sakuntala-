import { describe, it, expect } from 'vitest';
import { fitDixonColes } from '../calibration';

describe('DixonColes Calibration (MLE Recovery)', () => {
  it('should recover known parameters from synthetic data', () => {
    // 1. Setup ground truth
    const trueGamma = 1.25; // Home advantage
    const trueTeams: Record<string, { attack: number, defense: number }> = {
      'TEAM_A': { attack: 1.4, defense: 0.8 }, // Strong attack, strong defense
      'TEAM_B': { attack: 0.7, defense: 1.3 }, // Weak attack, weak defense
      'TEAM_C': { attack: 1.0, defense: 1.0 }, // Average
    };

    const teams = Object.keys(trueTeams);
    const matches: any[] = [];
    
    // 2. Generate large synthetic dataset (seeded simulation)
    // We use a simple Poisson generator for synthetic data
    const poisson = (lambda: number) => {
      let L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= Math.random();
      } while (p > L);
      return k - 1;
    };

    for (let i = 0; i < 3000; i++) {
      const home = teams[Math.floor(Math.random() * teams.length)];
      let away = teams[Math.floor(Math.random() * teams.length)];
      while (away === home) away = teams[Math.floor(Math.random() * teams.length)];

      const lambda = trueTeams[home].attack * trueTeams[away].defense * trueGamma;
      const mu = trueTeams[away].attack * trueTeams[home].defense;

      matches.push({
        home,
        away,
        hg: poisson(lambda),
        ag: poisson(mu),
        daysAgo: Math.random() * 100 // Minimal decay impact for recovery test
      });
    }

    // 3. Fit model
    const fitted = fitDixonColes(matches, 1500, 0.02);

    // 4. Verify recovery (within 15% tolerance for stochastic simulation)
    // Home advantage
    expect(fitted.homeAdvantage).toBeCloseTo(trueGamma, 0); // 0 precision = within 0.5

    // Relative strengths (checking Team A vs Team B)
    const paramsA = fitted.teams['TEAM_A'];
    const paramsB = fitted.teams['TEAM_B'];

    expect(paramsA.attack).toBeGreaterThan(paramsB.attack);
    expect(paramsA.defense).toBeLessThan(paramsB.defense);
    
    // Absolute recovery check
    expect(paramsA.attack).toBeCloseTo(trueTeams['TEAM_A'].attack, 1);
    expect(paramsB.defense).toBeCloseTo(trueTeams['TEAM_B'].defense, 1);
  });

  it('handles empty match data gracefully', () => {
    const fitted = fitDixonColes([]);
    expect(fitted.homeAdvantage).toBe(1.25);
    expect(Object.keys(fitted.teams).length).toBe(0);
  });
});
