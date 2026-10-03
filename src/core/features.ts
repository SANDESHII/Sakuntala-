import { InternalTeamData, HistoricalMatch } from '../types';

export class FeatureEngine {
  /**
   * Computes team features as of a specific historical date.
   * Uses only matches that occurred before that date.
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
      attackStrength: scored / (played * 1.35),
      defenseStrength: conceded / (played * 1.35),
      avgGoalsScored: scored / played,
      avgGoalsConceded: conceded / played,
      homeAdvantageHeuristic: 0.3, // Static for simplicity in feature engine
      form,
      cleanSheetRate: cleanSheets / played,
      quality: played >= 5 ? 'high' : 'medium'
    };
  }

  /**
   * Workflow-adjusted feature computation
   * Different workflows weight recent form differently
   */
  static async computeFeaturesWithWorkflow(
    teamName: string,
    league: string,
    asOfDate: string,
    workflow: string,
    history?: HistoricalMatch[]
  ): Promise<InternalTeamData> {
    const baseFeatures = await this.computeFeatures(teamName, league, asOfDate, history);

    // Workflow-specific form weighting
    const workflowFormWeight = ({
      'research-then-synthesise': 0.4, // Weight recent form more
      'smallest-version-first': 0.2,   // Weight recent form less
      'iterative-deepening': 0.35,
      'build-then-break': 0.3,
    } as Record<string, number>)[workflow] || 0.25;

    // Adjust attack/defense strength based on workflow
    const formMultiplier = 1 + (workflowFormWeight - 0.25) * 0.2;

    return {
      ...baseFeatures,
      attackStrength: baseFeatures.attackStrength * formMultiplier,
      defenseStrength: baseFeatures.defenseStrength * (2 - formMultiplier),
    };
  }
}
