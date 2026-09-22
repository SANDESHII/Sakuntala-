import { BaseProvider } from './Provider';
import { HttpClient } from '../http/HttpClient';
import { OddsLeg, HistoricalPrices } from '../types';

const API_KEY = process.env.VITE_ODDS_API_KEY || '';

export class OddsProvider extends BaseProvider {
  constructor() {
    super('the-odds-api');
  }

  async fetchLiveOdds(league: string, sport: string = 'soccer_epl') {
    const data = await HttpClient.fetchWithRetry<any[]>(
      this.source,
      `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
      {
        params: {
          apiKey: API_KEY,
          regions: 'uk,us,eu',
          markets: 'h2h,totals',
          oddsFormat: 'decimal'
        }
      }
    );

    return data;
  }

  // NOTE: Historical odds often require a paid plan on The Odds API.
  // We'll implement the logic assuming the schema exists or falls back.
  async fetchHistoricalOdds(fixtureId: string, sport: string = 'soccer_epl'): Promise<HistoricalPrices> {
    // This is a placeholder for actual historical endpoint which varies by plan
    // Using best-price + no-vig logic
    return {
      over15: { bestPrice: 1.5, noVigPrice: 1.45, bookmakerCount: 10, timestamp: new Date().toISOString() },
      under35: { bestPrice: 1.8, noVigPrice: 1.75, bookmakerCount: 10, timestamp: new Date().toISOString() }
    };
  }

  calculateNoVig(bestPrice: number, consensusPrice: number): number {
    // Basic Proportional Margin Removal
    // Margin = (1/Price1 + 1/Price2 - 1)
    // NoVig = Price / (1 + Margin)
    const margin = (1 / bestPrice) + (1 / consensusPrice) - 1;
    return bestPrice / (1 + margin);
  }
}
