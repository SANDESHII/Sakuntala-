import { InternalTeamData } from '../types';
import * as FreeDataService from '../services/freeDataService';

/**
 * FeatureEngine handles point-in-time statistical computation
 * to ensure backtests don't suffer from look-ahead bias.
 */
export const FeatureEngine = {
  /**
   * Computes team features as they appeared on a specific date.
   */
  async computeFeatures(teamName: string, league: string, asOfDate: string): Promise<InternalTeamData> {
    const historical = await FreeDataService.getHistoricalFixtures(league, 150);
    const cutoff = new Date(asOfDate).getTime();
    
    // Filter matches strictly before cutoff
    const matches = historical.filter(m => new Date(m.date).getTime() < cutoff);
    const teamMatches = matches.filter(m => m.home === teamName || m.away === teamName);
    
    if (teamMatches.length < 3) {
      return {
        attackStrength: 1.0,
        defenseStrength: 1.0,
        avgGoalsScored: 1.35,
        avgGoalsConceded: 1.35,
        avgXG: 1.35,
        avgXGA: 1.35,
        homeBias: 0.3,
        form: [1, 1, 1, 1, 1],
        cleanSheetRate: 0.25,
        quality: 'low'
      };
    }
    
    const played = teamMatches.length;
    let scored = 0;
    let conceded = 0;
    let cleanSheets = 0;
    
    teamMatches.forEach(m => {
      const isHome = m.home === teamName;
      scored += isHome ? m.homeGoals : m.awayGoals;
      conceded += isHome ? m.awayGoals : m.homeGoals;
      if ((isHome && m.awayGoals === 0) || (!isHome && m.homeGoals === 0)) {
        cleanSheets++;
      }
    });
    
    const avgScored = scored / played;
    const avgConceded = conceded / played;
    
    // Form is the last 5 games before the cutoff
    const last5 = teamMatches.slice(-5);
    const form = last5.map(m => {
      const isHome = m.home === teamName;
      const s = isHome ? m.homeGoals : m.awayGoals;
      const c = isHome ? m.awayGoals : m.homeGoals;
      return s > c ? 1.5 : s === c ? 1.0 : 0.5;
    });
    
    // Pad form if less than 5 games
    while (form.length < 5) form.unshift(1.0);
    
    return {
      attackStrength: avgScored / 1.35,
      defenseStrength: avgConceded / 1.35,
      avgGoalsScored: avgScored,
      avgGoalsConceded: avgConceded,
      avgXG: avgScored,
      avgXGA: avgConceded,
      homeBias: 0.3,
      form,
      cleanSheetRate: cleanSheets / played,
      quality: played > 10 ? 'high' : 'medium'
    };
  }
};
