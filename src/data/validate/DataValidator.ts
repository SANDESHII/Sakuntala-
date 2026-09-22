import { HistoricalMatch, MarketPrice } from '../../types';

export class DataValidator {
  /**
   * Validates fixture data sanity
   */
  static validateFixture(f: any): boolean {
    if (!f.home || !f.away) return false;
    if (f.homeGoals < 0 || f.awayGoals < 0) return false;
    if (f.homeGoals > 15 || f.awayGoals > 15) return false; // Outlier check
    return true;
  }

  /**
   * Validates odds range and no-vig sanity
   */
  static validateOdds(odds: number): boolean {
    return odds > 1.0 && odds < 50.0;
  }

  /**
   * Implied probability sanity check
   */
  static validateImpliedProb(probs: number[]): boolean {
    const sum = probs.reduce((s, p) => s + p, 0);
    return sum >= 1.0 && sum < 1.3; // 1.3 is extreme margin
  }

  /**
   * Quarantines bad records
   */
  static quarantine<T>(records: T[], validator: (r: T) => boolean): { valid: T[], quarantined: T[] } {
    const valid: T[] = [];
    const quarantined: T[] = [];

    for (const r of records) {
      if (validator(r)) {
        valid.push(r);
      } else {
        quarantined.push(r);
      }
    }

    return { valid, quarantined };
  }
}
