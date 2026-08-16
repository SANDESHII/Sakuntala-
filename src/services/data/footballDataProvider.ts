import Papa from 'papaparse';
import { MatchHistory } from '../../types';
import { DataService } from '../dataService';
import { fetchWithTimeout, retry } from '../../lib/network';

export class FootballDataProvider {
    private static BASE_URL = 'https://www.football-data.co.uk/mmz4281';
    private static LEAGUE_MAP: Record<string, string> = {
        'EPL': 'E0', 'CHAMPIONSHIP': 'E1', 'LA_LIGA': 'SP1', 'SERIE_A': 'I1', 'BUNDESLIGA': 'D1'
    };

    static async fetchSeasonData(league: string, season: string): Promise<MatchHistory[]> {
        const code = this.LEAGUE_MAP[league];
        if (!code) return [];
        const s = season.replace('/', '');
        const url = `${this.BASE_URL}/${s}/${code}.csv`;
        try {
            return await retry(async () => {
                const res = await fetchWithTimeout(url);
                if (!res.ok) return [];
                const parsed = Papa.parse(await res.text(), { header: true, skipEmptyLines: true });
                return parsed.data.map(r => DataService.validateMatch(r, league)).filter((r): r is MatchHistory => r !== null);
            });
        } catch { return []; }
    }

    static getBacklogSeasonStrings(count: number): string[] {
        const yr = new Date().getFullYear();
        return Array.from({ length: count }, (_, i) => {
            const y = yr - i - 1;
            const y1 = y + 1;
            return `${String(y).slice(-2)}${String(y1).slice(-2)}`;
        });
    }

    static async fetchBacklog(league: string, count = 3): Promise<MatchHistory[]> {
        const seasons = this.getBacklogSeasonStrings(count);
        const results = await Promise.all(seasons.map(s => this.fetchSeasonData(league, s)));
        return results.flat();
    }
}
