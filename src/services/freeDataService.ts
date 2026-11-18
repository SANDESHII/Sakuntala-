import { resolveTeam, resolveById } from '../data/teamIds';
import { FixtureMatch, HistoricalMatch, InternalTeamData, DataSource } from '../types';
import { inferSeason, getLeagueConfig } from '../data/utils';
import { LEAGUE_CONFIGS, BASE_GOALS } from '../core/constants';
import { logger } from './logger';

const quotas = new Map<string, { consumed: number; resetDate: string }>();
const cache = new Map<string, { data: unknown; timestamp: number }>();

const LIVE_ODDS_TTL = 5 * 60 * 1000;       // 5 minutes
const TEAM_STATS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FIXTURES_TTL = 30 * 60 * 1000;        // 30 minutes
const DEFAULT_TTL = 3600000;                // 1 hour

const apiHealth = new Map<string, { healthy: boolean; lastCheck: number }>();

export async function checkApiHealth(api: DataSource): Promise<boolean> {
  const cached = apiHealth.get(api);
  if (cached && Date.now() - cached.lastCheck < 60000) return cached.healthy;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    if (api === 'api-football') {
      const { baseUrl, headers } = getApiFootballConfig();
      const res = await fetch(`${baseUrl}/status`, { headers, signal: controller.signal });
      if (!res.ok) {
        apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
        return false;
      }
      const data = await res.json().catch(() => null) as { errors?: Record<string, unknown> | unknown[] } | null;
      const hasErrors = !!(data?.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0));
      const isHealthy = !hasErrors;
      apiHealth.set(api, { healthy: isHealthy, lastCheck: Date.now() });
      return isHealthy;
    } else if (api === 'the-odds-api') {
      const apiKey = getOddsApiKey();
      if (!apiKey) {
        apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
        return false;
      }
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`, { signal: controller.signal });
      const isHealthy = res.status === 200;
      apiHealth.set(api, { healthy: isHealthy, lastCheck: Date.now() });
      return isHealthy;
    }
    return true;
  } catch {
    apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function checkQuota(source: DataSource) {
  const today = new Date().toISOString().split('T')[0];
  let q = quotas.get(source) || { consumed: 0, resetDate: today };
  if (q.resetDate !== today) q = { consumed: 0, resetDate: today };
  if (q.consumed >= (source === 'the-odds-api' ? 50 : 100)) throw new Error(`[Network] Quota exceeded for ${source}`);
  quotas.set(source, q);
}

async function fetchWithRetry<T>(
  source: DataSource,
  url: string,
  config: { params?: Record<string, string | number | boolean>; headers?: Record<string, string> } = {},
  retries = 3
): Promise<T> {
  checkQuota(source);
  let target = url;
  if (config.params) {
    const params = new URLSearchParams();
    Object.entries(config.params).forEach(([k, v]) => v != null && params.append(k, String(v)));
    const q = params.toString();
    if (q) target += (target.includes('?') ? '&' : '?') + q;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(target, {
      headers: {
        'User-Agent': 'AlphaTerminal/1.0',
        ...config.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status >= 500) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, res.status === 429 ? 5000 : 2000));
        return fetchWithRetry(source, url, config, retries - 1);
      }
    }

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        apiHealth.set(source, { healthy: false, lastCheck: Date.now() });
      }
      throw new Error(`[Network] ${res.status}: ${text.slice(0, 100)}`);
    }

    const data = JSON.parse(text);
    const q = quotas.get(source);
    if (q) q.consumed++;
    return data;
  } catch (e: unknown) {
    if (
      retries > 0 &&
      e instanceof Error &&
      (e.name === 'AbortError' ||
        e.name === 'TimeoutError' ||
        e.message?.toLowerCase().includes('failed') ||
        e.message?.toLowerCase().includes('network'))
    ) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(source, url, config, retries - 1);
    }
    throw e;
  }
}

const promiseCache = new Map<string, Promise<any>>();

async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;
  if (promiseCache.has(key)) return promiseCache.get(key);

  const p = fetcher()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      promiseCache.delete(key);
      return data;
    })
    .catch((err) => {
      promiseCache.delete(key);
      throw err;
    });

  promiseCache.set(key, p);
  return p;
}

const cleanKey = (k?: string) =>
  k && k !== 'PLACEHOLDER' && k !== 'null' && k !== 'undefined'
    ? k.trim().replace(/^['"](.*)['"]$/, '$1')
    : '';

const getApiFootballConfig = () => {
  const key = cleanKey(process.env.API_FOOTBALL_KEY);
  if (!key) throw new Error('[Service] Missing API Key');
  const isRapid = !/^[a-f0-9]{32}$/i.test(key);
  const headers: Record<string, string> = {};
  if (isRapid) {
    headers['x-rapidapi-key'] = key;
    headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
  } else {
    headers['x-apisports-key'] = key;
  }

  return {
    baseUrl: isRapid ? 'https://api-football-v1.p.rapidapi.com/v3' : 'https://v3.football.api-sports.io',
    headers,
  };
};

const getOddsApiKey = () => cleanKey(process.env.ODDS_API_KEY);

async function fetchApiFootballFixtures(league: string, limit: number, status: 'NS' | 'FT' = 'NS') {
  const { baseUrl, headers } = getApiFootballConfig();
  const { apiId: leagueId } = getLeagueConfig(league);
  const data = await fetchWithRetry<{ response: any[] }>('api-football', `${baseUrl}/fixtures`, {
    headers,
    params: { league: leagueId, season: inferSeason(league), [status === 'NS' ? 'next' : 'last']: limit, status },
  });

  if (!data || !Array.isArray(data.response)) return [];

  return data.response
    .map((f: any) => {
      try {
        if (!f.teams?.home?.id || !f.teams?.away?.id || !f.fixture?.id) return null;
        return {
          id: f.fixture.id,
          date: f.fixture.date,
          home: resolveById('apiFootball', f.teams.home.id).id,
          away: resolveById('apiFootball', f.teams.away.id).id,
          homeId: f.teams.home.id,
          awayId: f.teams.away.id,
          homeLogo: f.teams.home.logo,
          awayLogo: f.teams.away.logo,
          homeGoals: f.goals?.home,
          awayGoals: f.goals?.away,
          league: league.toUpperCase(),
        };
      } catch (err: unknown) {
        logger.warn('fetchApiFootballFixtures', `Failed to map fixture ${f?.fixture?.id}: ${(err as Error).message}`);
        return null;
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

const isLiveCapable = () => !!cleanKey(process.env.API_FOOTBALL_KEY) && !!getOddsApiKey();

export async function getTeamStats(teamName: string, league: string): Promise<InternalTeamData | null> {
  if (!isLiveCapable()) return null;
  if (!(await checkApiHealth('api-football'))) return null;
  return withCache(`stats_${teamName}_${league}`, async () => {
    try {
      const { baseUrl, headers } = getApiFootballConfig();
      const teamId = resolveTeam(teamName).externalIds.apiFootball;
      if (!teamId) return null;

      const data = await fetchWithRetry<{ response: any }>('api-football', `${baseUrl}/teams/statistics`, {
        headers,
        params: { team: teamId, league: getLeagueConfig(league).apiId, season: inferSeason(league) },
      });

      const stats = data.response;
      if (!stats || !stats.fixtures?.played?.total) return null;

      const leagueConfig = LEAGUE_CONFIGS[league] || LEAGUE_CONFIGS['STANDARD'];
      const avgScored = Number(stats.goals.for.average.total) || BASE_GOALS;
      const avgConceded = Number(stats.goals.against.average.total) || BASE_GOALS;
      const leagueBase = BASE_GOALS * leagueConfig.goalRate;

      return {
        attackStrength: avgScored / leagueBase,
        defenseStrength: avgConceded / leagueBase,
      };
    } catch (err: unknown) {
      logger.warn('getTeamStats', `Falling back to static data for ${teamName} (${league}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, TEAM_STATS_TTL);
}

export async function getLiveOdds(league: string) {
  if (!isLiveCapable()) return [];
  if (!(await checkApiHealth('the-odds-api'))) return [];
  try {
    return await withCache(`live_odds_${league}`, async () => {
      const apiKey = getOddsApiKey();
      if (!apiKey) throw new Error('[Service] Odds API Key missing.');
      const sport = getLeagueConfig(league).oddsKey;
      return fetchWithRetry<any[]>('the-odds-api', `https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
        params: { apiKey, regions: 'eu,uk', markets: 'totals', oddsFormat: 'decimal' },
      });
    }, LIVE_ODDS_TTL);
  } catch (err: unknown) {
    logger.warn('getLiveOdds', `Live odds unavailable for ${league}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function getUpcomingFixtures(league: string, limit = 10): Promise<FixtureMatch[]> {
  if (!isLiveCapable()) return [];
  if (!(await checkApiHealth('api-football'))) return [];
  try {
    return await withCache(`fixtures_${league}_${limit}`, async () => {
      const fixtures = await fetchApiFootballFixtures(league, limit, 'NS');
      return fixtures.map((f) => ({
        homeTeam: f.home,
        awayTeam: f.away,
        homeLogo: f.homeLogo || null,
        awayLogo: f.awayLogo || null,
        kickoff: f.date,
        league: league.toUpperCase(),
        fixtureId: f.id,
      }));
    }, FIXTURES_TTL);
  } catch (err: unknown) {
    logger.warn('getUpcomingFixtures', `Upcoming fixtures unavailable for ${league}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function getHistoricalFixtures(league: string, limit = 150): Promise<HistoricalMatch[]> {
  if (!isLiveCapable()) return [];
  if (!(await checkApiHealth('api-football'))) return [];

  try {
    const fixtures = await fetchApiFootballFixtures(league, limit, 'FT');
    return fixtures.map((f) => ({
      home: f.home,
      away: f.away,
      homeGoals: f.homeGoals ?? 0,
      awayGoals: f.awayGoals ?? 0,
      date: f.date,
      league: f.league,
      homeId: f.homeId,
      awayId: f.awayId,
    }));
  } catch (err: unknown) {
    logger.warn('getHistoricalFixtures', `Historical fixtures unavailable for ${league}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
