import { InternalTeamData, HistoricalMatch } from '../../types';

export class FeatureEngine {
  /**
   * Computes recency-decayed form and rolling metrics
   */
  static computeForm(matches: HistoricalMatch[], team: string, window: number = 5): number[] {
    const teamMatches = matches
      .filter(m => m.home === team || m.away === team)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, window);

    return teamMatches.map(m => {
      const isHome = m.home === team;
      const goalsFor = isHome ? m.homeGoals : m.awayGoals;
      const goalsAgainst = isHome ? m.awayGoals : m.homeGoals;
      
      if (goalsFor > goalsAgainst) return 3;
      if (goalsFor === goalsAgainst) return 1;
      return 0;
    });
  }

  /**
   * Computes H/A splits and rest days
   */
  static computeFeatures(matches: HistoricalMatch[], team: string): Partial<InternalTeamData> {
    const homeMatches = matches.filter(m => m.home === team);
    const awayMatches = matches.filter(m => m.away === team);

    const homeAtk = homeMatches.length > 0 
      ? homeMatches.reduce((s, m) => s + m.homeGoals, 0) / homeMatches.length 
      : 1.0;
    const awayAtk = awayMatches.length > 0 
      ? awayMatches.reduce((s, m) => s + m.awayGoals, 0) / awayMatches.length 
      : 1.0;

    const lastMatch = matches
      .filter(m => m.home === team || m.away === team)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const restDays = lastMatch 
      ? Math.floor((new Date().getTime() - new Date(lastMatch.date).getTime()) / (1000 * 60 * 60 * 24))
      : 7;

    return {
      homeAttackStrength: homeAtk / 1.35,
      awayAttackStrength: awayAtk / 1.35,
      restDays: Math.min(restDays, 14),
      rollingXG: this.computeForm(matches, team, 10) // Simplified rolling metric
    };
  }
}
