import { InternalTeamData, HistoricalMatch } from '../types';

export class FeatureEngine {
  /**
   * Computes team features as of a specific historical date.
   * Uses only matches that occurred before that date for point-in-time evaluation.
   * 
   * @param teamName - Name of the team to compute features for
   * @param _league - League identifier
   * @param asOfDate - Cutoff date for historical data
   * @param history - Pool of historical matches
   * @returns Internal team metrics for prediction
   */
  static async computeFeatures(
    teamName: string,
    _league: string,
    asOfDate: string,
    history?: HistoricalMatch[]
  ): Promise<InternalTeamData> {
    if (!history || history.length === 0) {
      return {
        attackStrength: 1.0,
        defenseStrength: 1.0,
        avgGoalsScored: 1.35,
        avgGoalsConceded: 1.35,
        homeAdvantageHeuristic: 0.3,
        form: [1, 1, 1, 1, 1],
        cleanSheetRate: 0.25,
        quality: 'low'
      };
    }

    const cutoff = new Date(asOfDate).getTime();
    const relevant = history.filter(m => {
      const matchTime = new Date(m.date).getTime();
      return matchTime < cutoff && (m.home === teamName || m.away === teamName);
    });

    if (relevant.length < 5) {
      return {
        attackStrength: 1.0,
        defenseStrength: 1.0,
        avgGoalsScored: 1.35,
        avgGoalsConceded: 1.35,
        homeAdvantageHeuristic: 0.3,
        form: [1, 1, 1, 1, 1],
        cleanSheetRate: 0.25,
        quality: 'low'
      };
    }

    const last5 = relevant.slice(-5);
    let scored = 0;
    let conceded = 0;
    let cleanSheets = 0;
    const form: number[] = [];

    last5.forEach(m => {
      const isHome = m.home === teamName;
      const s = isHome ? m.homeGoals : m.awayGoals;
      const c = isHome ? m.awayGoals : m.homeGoals;
      scored += s;
      conceded += c;
      if (c === 0) cleanSheets++;
      form.push(s > c ? 3 : s === c ? 1 : 0);
    });

    const played = last5.length;
    return {
      attackStrength: 1.0,
      defenseStrength: 1.0,
      avgGoalsScored: scored / played,
      avgGoalsConceded: conceded / played,
      homeAdvantageHeuristic: 0.3,
      form,
      cleanSheetRate: cleanSheets / played,
      quality: played >= 5 ? 'medium' : 'low'
    };
  }
}

