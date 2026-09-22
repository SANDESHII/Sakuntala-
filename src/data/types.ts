/**
 * Global Data Layer Types
 */

export type DataSource = 'api-football' | 'the-odds-api' | 'understat' | 'manual-registry' | 'internal-proxy';

export interface Provenance {
  source: DataSource;
  sourceId?: string | number;
  sourceSeason?: string | number;
  fetchedAt: string;
  quality: 'high' | 'medium' | 'low' | 'goals-proxy';
}

export interface TeamIdentity {
  id: string; // Canonical internal ID
  name: string;
  aliases: string[];
  externalIds: {
    apiFootball?: number;
    understat?: string;
    theOddsApi?: string;
  };
}

export interface MarketPrice {
  price: number;
  impliedProb: number;
  provider: string;
}

export interface OddsLeg {
  bestPrice: number;
  noVigPrice: number;
  bookmakerCount: number;
  timestamp: string;
}

export interface HistoricalPrices {
  over15?: OddsLeg;
  under35?: OddsLeg;
  oneXTwo?: {
    home: OddsLeg;
    draw: OddsLeg;
    away: OddsLeg;
  };
  takenAt?: string;
  closedAt?: string;
}

export interface MatchFeatureVector {
  homeXG: number;
  awayXG: number;
  quality: 'high' | 'goals-proxy';
  homeShots?: number;
  awayShots?: number;
  homeSOT?: number;
  awaySOT?: number;
}

export class DataGapError extends Error {
  constructor(public entity: string, public context: string) {
    super(`Data Gap: ${entity} missing in ${context}`);
    this.name = 'DataGapError';
  }
}

export class QuotaExceededError extends Error {
  constructor(public provider: DataSource) {
    super(`Quota Exceeded for provider: ${provider}`);
    this.name = 'QuotaExceededError';
  }
}
