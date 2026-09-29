import { fetchWithRetry } from '../http/client';
import { HistoricalPrices, DataGapError, DataSource } from '../../types';

function getApiKey() {
  const env = typeof process !== 'undefined' ? process.env : (import.meta as any).env || {};
  const rawKey = env.API_ODDS_KEY || env.ODDS_API_KEY || env.VITE_ODDS_API_KEY || '';
  let key = rawKey.trim();
  
  // Strip surrounding quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  if (!key || key === 'undefined' || key === 'null' || key === 'PLACEHOLDER') return '';
  return key;
}

export class OddsProvider {
  public readonly source: DataSource = 'the-odds-api';

  async fetchLiveOdds(_league: string, sport: string = 'soccer_epl') {
    const key = getApiKey();
    if (!key) throw new Error('The Odds API Key (ODDS_API_KEY or VITE_ODDS_API_KEY) is missing or empty.');

    const data = await fetchWithRetry<any[]>(
      this.source,
      `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
      {
        params: {
          apiKey: key,
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
    const key = getApiKey();
    if (!key) throw new DataGapError('ODDS_API_KEY', 'Environment');

    return await fetchWithRetry<any[]>(
      this.source,
      `https://api.the-odds-api.com/v4/historical/sports/${sport}/odds`,
      {
        params: {
          apiKey: key,
          regions: 'eu,uk',
          markets: 'totals',
          oddsFormat: 'decimal',
          date
        }
      }
    ).then(res => (res as any).data || []);
  }

  private mapMatchToHistorical(match: any, timestamp: string): HistoricalPrices {
    let bestO25 = 0, sumO25 = 0, countO25 = 0;
    let bestU25 = 0, sumU25 = 0, countU25 = 0;

    match.bookmakers?.forEach((bm: any) => {
      const market = bm.markets.find((m: any) => m.key === 'totals');
      if (market) {
        const o25 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 2.5);
        const u25 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 2.5);

        if (o25) {
          bestO25 = Math.max(bestO25, o25.price);
          sumO25 += o25.price;
          countO25++;
        }
        if (u25) {
          bestU25 = Math.max(bestU25, u25.price);
          sumU25 += u25.price;
          countU25++;
        }
      }
    });

    const avgU25 = countU25 > 0 ? sumU25 / countU25 : bestU25;
    const avgO25 = countO25 > 0 ? sumO25 / countO25 : bestO25;

    const over25 = bestO25 > 0 ? {
      bestPrice: bestO25,
      noVigPrice: (bestO25 > 0 && avgU25 > 0) ? this.calculateNoVig(bestO25, avgU25) : bestO25 * 0.97
    } : { bestPrice: 0, noVigPrice: 0 };

    const under25 = bestU25 > 0 ? {
      bestPrice: bestU25,
      noVigPrice: (bestU25 > 0 && avgO25 > 0) ? this.calculateNoVig(bestU25, avgO25) : bestU25 * 0.97
    } : { bestPrice: 0, noVigPrice: 0 };

    return { over25, under25, takenAt: timestamp };
  }

  calculateNoVig(bestPrice: number, consensusPrice: number): number {
    const p1 = 1 / bestPrice;
    const p2 = 1 / consensusPrice;
    const fairProbability = p1 / (p1 + p2);
    return 1 / fairProbability;
  }
}
