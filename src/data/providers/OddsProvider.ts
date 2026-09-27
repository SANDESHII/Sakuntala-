import { fetchWithRetry } from '../http/client';
import { OddsLeg, HistoricalPrices, DataGapError, DataSource } from '../../types';

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
    if (!API_KEY) throw new DataGapError('ODDS_API_KEY', 'Environment');

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
    let bestO15 = 0, sumO15 = 0, countO15 = 0;
    let bestU15 = 0, sumU15 = 0, countU15 = 0;
    let bestU35 = 0, sumU35 = 0, countU35 = 0;
    let bestO35 = 0, sumO35 = 0, countO35 = 0;

    match.bookmakers?.forEach((bm: any) => {
      const market = bm.markets.find((m: any) => m.key === 'totals');
      if (market) {
        const o15 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 1.5);
        const u15 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 1.5);
        const u35 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 3.5);
        const o35 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 3.5);

        if (o15) {
          bestO15 = Math.max(bestO15, o15.price);
          sumO15 += o15.price;
          countO15++;
        }
        if (u15) {
          bestU15 = Math.max(bestU15, u15.price);
          sumU15 += u15.price;
          countU15++;
        }
        if (u35) {
          bestU35 = Math.max(bestU35, u35.price);
          sumU35 += u35.price;
          countU35++;
        }
        if (o35) {
          bestO35 = Math.max(bestO35, o35.price);
          sumO35 += o35.price;
          countO35++;
        }
      }
    });

    const avgU15 = countU15 > 0 ? sumU15 / countU15 : bestU15;
    const avgO35 = countO35 > 0 ? sumO35 / countO35 : bestO35;

    const over15: OddsLeg | undefined = bestO15 > 0 ? {
      bestPrice: bestO15,
      noVigPrice: (bestO15 > 0 && avgU15 > 0) ? this.calculateNoVig(bestO15, avgU15) : bestO15 * 0.97,
      bookmakerCount: countO15,
      timestamp
    } : undefined;

    const under35: OddsLeg | undefined = bestU35 > 0 ? {
      bestPrice: bestU35,
      noVigPrice: (bestU35 > 0 && avgO35 > 0) ? this.calculateNoVig(bestU35, avgO35) : bestU35 * 0.97,
      bookmakerCount: countU35,
      timestamp
    } : undefined;

    return { over15, under35, takenAt: timestamp };
  }

  calculateNoVig(bestPrice: number, consensusPrice: number): number {
    const margin = (1 / bestPrice) + (1 / consensusPrice) - 1;
    return bestPrice / (1 + margin);
  }
}
