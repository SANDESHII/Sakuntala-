import { BaseProvider } from './Provider';
import { HttpClient } from '../http/HttpClient';
import { TeamRegistry } from '../identity/TeamRegistry';
import { normalizeLeagueToId, inferSeason } from '../utils';

const API_KEY = process.env.VITE_API_FOOTBALL_KEY || '';

export class ApiFootballProvider extends BaseProvider {
  constructor() {
    super('api-football');
  }

  async fetchFixtures(league: string, limit: number, status: 'NS' | 'FT' = 'NS') {
    const leagueId = normalizeLeagueToId(league);
    const season = inferSeason();

    const data = await HttpClient.fetchWithRetry<any>(
      this.source,
      'https://v3.football.api-sports.io/fixtures',
      {
        headers: { 'x-apisports-key': API_KEY },
        params: {
          league: leagueId,
          season,
          [status === 'NS' ? 'next' : 'last']: limit,
          status
        }
      }
    );

    return data.response.map((f: any) => ({
      id: f.fixture.id,
      date: f.fixture.date,
      home: TeamRegistry.resolveById('apiFootball', f.teams.home.id).id,
      away: TeamRegistry.resolveById('apiFootball', f.teams.away.id).id,
      homeId: f.teams.home.id,
      awayId: f.teams.away.id,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
      league: league.toUpperCase(),
      provenance: this.getProvenance('high', season)
    }));
  }

  async fetchTeamStats(teamId: number, leagueId: number, season: number) {
    const data = await HttpClient.fetchWithRetry<any>(
      this.source,
      'https://v3.football.api-sports.io/teams/statistics',
      {
        headers: { 'x-apisports-key': API_KEY },
        params: { team: teamId, league: leagueId, season }
      }
    );

    const stats = data.response;
    return {
      played: stats.fixtures.played.total,
      goals: {
        for: stats.goals.for.average.total,
        against: stats.goals.against.average.total
      },
      cleanSheets: stats.clean_sheet.total, // Fixed: API-Football uses singular 'clean_sheet' in stats response
      provenance: this.getProvenance('high', season)
    };
  }
}
