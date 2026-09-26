import { fetchWithRetry } from '../http/client';
import { OddsLeg, HistoricalPrices, DataGapError, DataSource, Provenance } from '../../types';

const API_KEY = process.env.VITE_ODDS_API_KEY || '';

export class OddsProvider {
  public readonly source: DataSource = 'the-odds-api';

  async fetchLiveOdds(_league: string, sport: string = 'soccer_epl') {
    const data = await fetchWithRetry<any[]>(
      this.source,
      `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
      {
        params: {
          apiKey: API_KEY,
          regions: 'eu,uk',
          markets: 'h2h,totals',
          oddsFormat: 'decimal'
        }
      }
    );

    return data;
  }

  /**
   * Fetches historical odds using (sport, kickoff, teamNames) join key.
   * "Taken" odds are sampled ~24h before kickoff.
   */
  async fetchHistoricalOdds(sport: string, kickoff: string, homeTeam: string, awayTeam: string): Promise<HistoricalPrices> {
    if (!API_KEY) throw new DataGapError('ODDS_API_KEY', 'Environment');

    // Sample 'taken' odds 24h before kickoff
    const kickoffDate = new Date(kickoff);
    const takenDate = new Date(kickoffDate.getTime() - 24 * 60 * 60 * 1000);
    const takenIso = takenDate.toISOString().split('.')[0] + 'Z';

    try {
      const snapshot = await this.fetchSnapshot(sport, takenIso);
      const match = snapshot.find((m: any) => 
        (m.home_team === homeTeam && m.away_team === awayTeam) ||
        (m.home_team === awayTeam && m.away_team === homeTeam)
      );

      if (!match) {
        throw new DataGapError('Historical Odds', `${homeTeam} vs ${awayTeam} @ ${takenIso}`);
      }

      return this.mapMatchToHistorical(match, takenIso);
    } catch (err) {
      if (err instanceof DataGapError) throw err;
      throw new DataGapError('Odds API Response', (err as Error).message);
    }
  }

  /**
   * Fetches closing odds sampled at kickoff time.
   */
  async fetchClosingOdds(sport: string, kickoff: string, homeTeam: string, awayTeam: string): Promise<HistoricalPrices> {
    const kickoffIso = new Date(kickoff).toISOString().split('.')[0] + 'Z';
    const snapshot = await this.fetchSnapshot(sport, kickoffIso);
    
    const match = snapshot.find((m: any) => 
      (m.home_team === homeTeam && m.away_team === awayTeam)
    );

    if (!match) {
      throw new DataGapError('Closing Odds', `${homeTeam} vs ${awayTeam} @ ${kickoffIso}`);
    }

    return this.mapMatchToHistorical(match, kickoffIso);
  }

  private async fetchSnapshot(sport: string, date: string): Promise<any[]> {
    return await fetchWithRetry<any[]>(
      this.source,
      `https://api.the-odds-api.com/v4/historical/sports/${sport}/odds`,
      {
        params: {
          apiKey: API_KEY,
          regions: 'eu,uk',
          markets: 'totals',
          oddsFormat: 'decimal',
          date
        }
      }
    ).then(res => (res as any).data || []);
  }

  private mapMatchToHistorical(match: any, timestamp: string): HistoricalPrices {
    // Extract best price for Over 1.5 and Under 3.5
    let over15: OddsLeg | undefined;
    let under35: OddsLeg | undefined;

    match.bookmakers?.forEach((bm: any) => {
      const market = bm.markets.find((m: any) => m.key === 'totals');
      if (market) {
        const o15 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 1.5);
        const u35 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 3.5);

        if (o15 && (!over15 || o15.price > over15.bestPrice)) {
          over15 = { bestPrice: o15.price, noVigPrice: o15.price * 0.97, bookmakerCount: 1, timestamp };
        }
        if (u35 && (!under35 || u35.price > under35.bestPrice)) {
          under35 = { bestPrice: u35.price, noVigPrice: u35.price * 0.97, bookmakerCount: 1, timestamp };
        }
      }
    });

    return { over15, under35, takenAt: timestamp };
  }

  calculateNoVig(bestPrice: number, consensusPrice: number): number {
    // Basic Proportional Margin Removal
    // Margin = (1/Price1 + 1/Price2 - 1)
    // NoVig = Price / (1 + Margin)
    const margin = (1 / bestPrice) + (1 / consensusPrice) - 1;
    return bestPrice / (1 + margin);
  }

  getProvenance(quality: Provenance['quality'], season?: string | number): Provenance {
    return {
      source: this.source,
      sourceSeason: season,
      fetchedAt: new Date().toISOString(),
      quality
    };
  }
}
