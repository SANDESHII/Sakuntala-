import { InternalTeamData, HistoricalMatch } from '../types';
import * as FreeDataService from '../services/freeDataService';
import { LEAGUE_CONFIGS } from './constants';

/**
 * FeatureEngine handles point-in-time statistical computation
 * to ensure backtests don't suffer from look-ahead bias.
 */
export const FeatureEngine = {
  /**
   * Computes team features as they appeared on a specific date.
   */
  async computeFeatures(
    teamName: string, 
    league: string, 
    asOfDate: string,
    historicalCache?: HistoricalMatch[]
  ): Promise<InternalTeamData> {
    const historical = historicalCache || await FreeDataService.getHistoricalFixturesLight(league, 150);
    const cutoff = new Date(asOfDate).getTime();
    
    // Filter matches strictly before cutoff
    const matches = historical.filter((m: HistoricalMatch) => new Date(m.date).getTime() < cutoff);
    const teamMatches = matches.filter((m: HistoricalMatch) => m.home === teamName || m.away === teamName);
    
    const leagueConfig = LEAGUE_CONFIGS[league] || LEAGUE_CONFIGS['STANDARD'];
    const baseHomeAdv = leagueConfig.homeAdvantage;

    if (teamMatches.length < 3) {
      return {
        attackStrength: 1.0,
        defenseStrength: 1.0,
        avgGoalsScored: 1.35,
        avgGoalsConceded: 1.35,
        homeAdvantageHeuristic: baseHomeAdv,
        form: [1, 1, 1, 1, 1],
        cleanSheetRate: 0.25,
        quality: 'low'
      };
    }
    
    const played = teamMatches.length;
    let scored = 0;
    let conceded = 0;
    let cleanSheets = 0;
    
    let homeScored = 0, homeCount = 0;
    let awayScored = 0, awayCount = 0;

    teamMatches.forEach((m: HistoricalMatch) => {
      const isHome = m.home === teamName;
      const s = isHome ? m.homeGoals : m.awayGoals;
      const c = isHome ? m.awayGoals : m.homeGoals;
      
      scored += s;
      conceded += c;
      if (c === 0) cleanSheets++;

      if (isHome) {
        homeScored += s;
        homeCount++;
      } else {
        awayScored += s;
        awayCount++;
      }
    });
    
    // Temporal Weighted Averages for Heuristic Model
    let weightedScoredSum = 0;
    let weightedConcededSum = 0;
    let weightSum = 0;
    const PHI = 0.0065;

    teamMatches.forEach((m: HistoricalMatch) => {
      const matchTs = new Date(m.date).getTime();
      const diffDays = Math.max(0, (cutoff - matchTs) / (1000 * 60 * 60 * 24));
      const weight = Math.exp(-PHI * diffDays);

      const isHome = m.home === teamName;
      weightedScoredSum += (isHome ? m.homeGoals : m.awayGoals) * weight;
      weightedConcededSum += (isHome ? m.awayGoals : m.homeGoals) * weight;
      weightSum += weight;
    });

    const avgScored = weightSum > 0 ? weightedScoredSum / weightSum : 1.35;
    const avgConceded = weightSum > 0 ? weightedConcededSum / weightSum : 1.35;
    
    // Calculate team-specific home bias if enough data, otherwise use league base
    let homeAdvantageHeuristic = baseHomeAdv;
    if (homeCount >= 3 && awayCount >= 3) {
      const hRate = homeScored / homeCount;
      const aRate = awayScored / awayCount;
      const diff = hRate - aRate;
      // Heuristic: map a +0.5 goal diff to +0.05 bias adjustment
      homeAdvantageHeuristic = Math.max(0.15, Math.min(0.45, baseHomeAdv + (diff * 0.1)));
    }

    // Form is the last 5 games before the cutoff
    const last5 = teamMatches.slice(-5);
    const form = last5.map((m: HistoricalMatch) => {
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
      homeAdvantageHeuristic,
      form,
      cleanSheetRate: cleanSheets / played,
      quality: played > 10 ? 'high' : 'medium'
    };
  }
};
