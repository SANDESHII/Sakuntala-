import { fetchWithRetry } from '../http/client';
import { TeamRegistry } from '../identity/registry';
import { normalizeLeagueToId, inferSeason } from '../utils';
import { DataSource, Provenance } from '../../types';

function getApiKey() {
  const env = typeof process !== 'undefined' ? process.env : (import.meta as any).env || {};
  const rawKey = env.API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY || '';
  let key = rawKey.trim();
  
  // Strip surrounding quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  if (!key || key === 'undefined' || key === 'null' || key === 'PLACEHOLDER') return '';
  return key;
}

export class ApiFootballProvider {
  public readonly source: DataSource = 'api-football';

  private getRequestConfig() {
    const key = getApiKey();
    if (!key) {
      throw new Error('API-Football Key (API_FOOTBALL_KEY or VITE_API_FOOTBALL_KEY) is missing or empty.');
    }

    const isHex32 = /^[a-f0-9]{32}$/i.test(key);
    const isRapid = !isHex32;
    
    const baseUrl = isRapid ? 'https://api-football-v1.p.rapidapi.com/v3' : 'https://v3.football.api-sports.io';
    const headers: Record<string, string> = isRapid 
      ? { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
      : { 'x-apisports-key': key };

    return { baseUrl, headers, isRapid };
  }

  async fetchFixtures(league: string, limit: number, status: 'NS' | 'FT' = 'NS') {
    const { baseUrl, headers, isRapid } = this.getRequestConfig();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ApiFootball] Fetching fixtures from ${isRapid ? 'RapidAPI' : 'Direct'} host.`);
    }

    const leagueId = normalizeLeagueToId(league);
    const season = inferSeason();

    const data = await fetchWithRetry<any>(
      this.source,
      `${baseUrl}/fixtures`,
      {
        headers,
        params: {
          league: leagueId,
          season,
          [status === 'NS' ? 'next' : 'last']: limit,
          status
        }
      }
    );

    return data.response
      .map((f: any) => {
        try {
          return {
            id: f.fixture.id,
            date: f.fixture.date,
            home: TeamRegistry.resolveById('apiFootball', f.teams.home.id).id,
            away: TeamRegistry.resolveById('apiFootball', f.teams.away.id).id,
            homeId: f.teams.home.id,
            awayId: f.teams.away.id,
            homeLogo: f.teams.home.logo,
            awayLogo: f.teams.away.logo,
            homeGoals: f.goals.home,
            awayGoals: f.goals.away,
            league: league.toUpperCase(),
            provenance: this.getProvenance('high', season)
          };
        } catch {
          return null;
        }
      })
      .filter((f: any): f is NonNullable<typeof f> => f !== null);
  }

  async fetchTeamStats(teamId: number, leagueId: number, season: number) {
    const { baseUrl, headers, isRapid } = this.getRequestConfig();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ApiFootball] Fetching team stats from ${isRapid ? 'RapidAPI' : 'Direct'} host.`);
    }

    const data = await fetchWithRetry<any>(
      this.source,
      `${baseUrl}/teams/statistics`,
      {
        headers,
        params: { team: teamId, league: leagueId, season }
      }
    );

    const stats = data.response;
    return {
      played: stats.fixtures.played.total,
      goals: {
        for: stats.goals.for.average.total,
        against: stats.goals.against.average.total,
        homeFor: stats.goals.for.average.home,
        awayFor: stats.goals.for.average.away
      },
      cleanSheets: stats.clean_sheet.total,
      provenance: this.getProvenance('high', season)
    };
  }

  getProvenance(quality: Provenance['quality'], season?: string | number): Provenance {
    return {
      source: this.source,
      sourceSeason: season,
      timestamp: new Date().toISOString(),
      quality
    };
  }
}
