import { resolveTeam, resolveByApiFootballId } from '../data/teamIds';
import { FixtureMatch, HistoricalMatch, InternalTeamData, DataSource } from '../types';
import { inferSeason, getLeagueConfig } from '../data/utils';
import { LEAGUE_CONFIGS, BASE_GOALS } from '../core/constants';
import { logger } from './logger';

const quotas = new Map<string, { consumed: number; resetDate: string }>();
const cache = new Map<string, { data: unknown; timestamp: number }>();
const promiseCache = new Map<string, Promise<unknown>>();

const LIVE_ODDS_TTL = 5 * 60 * 1000;       // 5 minutes
const TEAM_STATS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FIXTURES_TTL = 30 * 60 * 1000;        // 30 minutes
const TEAM_DIRECTORY_TTL = 24 * 60 * 60 * 1000;
const HEALTH_TTL = 60 * 1000;

const apiHealth = new Map<string, { healthy: boolean; lastCheck: number }>();
const healthInFlight = new Map<string, Promise<boolean>>();

const cleanKey = (k?: string): string =>
  k && k !== 'PLACEHOLDER' && k !== 'null' && k !== 'undefined'
    ? k.trim().replace(/^['"](.*)['"]$/, '$1')
    : '';

const normalizeLeagueKey = (league: string): string =>
  league.toUpperCase().trim().replace(/ /g, '_');

const getOddsApiKey = () => cleanKey(process.env.ODDS_API_KEY);
export const hasApiFootballKey = () => !!cleanKey(process.env.API_FOOTBALL_KEY);
export const hasOddsApiKey = () => !!getOddsApiKey();

const getApiFootballConfig = () => {
  const key = cleanKey(process.env.API_FOOTBALL_KEY);
  if (!key) throw new Error('[Service] Missing API-Football Key');
  const isRapid = !/^[a-f0-9]{32}$/i.test(key);
  const headers: Record<string, string> = isRapid
    ? {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      }
    : {
        'x-apisports-key': key,
      };

  return {
    baseUrl: isRapid ? 'https://api-football-v1.p.rapidapi.com/v3' : 'https://v3.football.api-sports.io',
    headers,
  };
};

export async function checkApiHealth(api: DataSource): Promise<boolean> {
  const cached = apiHealth.get(api);
  if (cached && Date.now() - cached.lastCheck < HEALTH_TTL) return cached.healthy;

  const pending = healthInFlight.get(api);
  if (pending) return pending;

  const job = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      if (api === 'api-football') {
        if (!hasApiFootballKey()) {
          apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
          return false;
        }
        const { baseUrl, headers } = getApiFootballConfig();
        const res = await fetch(`${baseUrl}/status`, { headers, signal: controller.signal });
        if (!res.ok) {
          apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
          return false;
        }
        const data = (await res.json().catch(() => null)) as {
          errors?: Record<string, unknown> | unknown[];
        } | null;
        const hasErrors = !!(
          data?.errors &&
          (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)
        );
        const isHealthy = !hasErrors;
        apiHealth.set(api, { healthy: isHealthy, lastCheck: Date.now() });
        return isHealthy;
      }

      if (api === 'the-odds-api') {
        const apiKey = getOddsApiKey();
        if (!apiKey) {
          apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
          return false;
        }
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`, {
          signal: controller.signal,
        });
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
      healthInFlight.delete(api);
    }
  })();

  healthInFlight.set(api, job);
  return job;
}

async function isSourceReady(api: DataSource): Promise<boolean> {
  if (api === 'api-football' && !hasApiFootballKey()) return false;
  if (api === 'the-odds-api' && !hasOddsApiKey()) return false;
  return checkApiHealth(api);
}

function reserveQuota(source: DataSource): void {
  const today = new Date().toISOString().split('T')[0];
  const limit = source === 'the-odds-api' ? 50 : 100;
  let q = quotas.get(source);
  if (!q || q.resetDate !== today) {
    q = { consumed: 0, resetDate: today };
  }
  if (q.consumed >= limit) {
    throw new Error(`[Network] Quota exceeded for ${source}`);
  }
  q.consumed += 1;
  quotas.set(source, q);
}

async function fetchWithRetry<T>(
  source: DataSource,
  url: string,
  config: { params?: Record<string, string | number | boolean>; headers?: Record<string, string> } = {},
  retries = 3
): Promise<T> {
  let target = url;
  if (config.params) {
    const params = new URLSearchParams();
    Object.entries(config.params).forEach(([k, v]) => v != null && params.append(k, String(v)));
    const q = params.toString();
    if (q) target += (target.includes('?') ? '&' : '?') + q;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    reserveQuota(source);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(target, {
        headers: {
          'User-Agent': 'AlphaTerminal/1.0',
          ...config.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, res.status === 429 ? 5000 : 2000));
          continue;
        }
      }

      const text = await res.text();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          apiHealth.set(source, { healthy: false, lastCheck: Date.now() });
        }
        throw new Error(`[Network] ${res.status}: ${text.slice(0, 100)}`);
      }

      return JSON.parse(text) as T;
    } catch (e: unknown) {
      clearTimeout(timeout);
      const isRetryableNetwork =
        e instanceof Error &&
        (e.name === 'AbortError' ||
          e.name === 'TimeoutError' ||
          e.message?.toLowerCase().includes('failed') ||
          e.message?.toLowerCase().includes('network') ||
          e.message?.toLowerCase().includes('fetch'));

      if (isRetryableNetwork && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw e;
    }
  }

  throw new Error(`[Network] Exhausted retries for ${source}`);
}

async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;

  const inflight = promiseCache.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = fetcher()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      promiseCache.delete(key);
    });

  promiseCache.set(key, p);
  return p;
}

async function resolveApiFootballTeamId(teamName: string, leagueKey: string): Promise<number | undefined> {
  const resolved = resolveTeam(teamName);
  if (resolved.apiFootballId) return resolved.apiFootballId;

  const season = inferSeason(leagueKey);
  const { apiId: leagueId } = getLeagueConfig(leagueKey);
  const directory = await withCache<Record<string, number>>(
    `team_dir_${leagueKey}_${season}`,
    async () => {
      try {
        const { baseUrl, headers } = getApiFootballConfig();
        const data = await fetchWithRetry<{ response?: Array<{ team?: { id?: number; name?: string } }> }>(
          'api-football',
          `${baseUrl}/teams`,
          { headers, params: { league: leagueId, season } }
        );
        const map: Record<string, number> = {};
        for (const item of data?.response || []) {
          const id = item?.team?.id;
          const name = item?.team?.name;
          if (typeof id === 'number' && typeof name === 'string') {
            map[resolveTeam(name).id] = id;
          }
        }
        return map;
      } catch (err: unknown) {
        logger.warn('resolveApiFootballTeamId', `Team directory lookup failed for ${leagueKey}: ${err instanceof Error ? err.message : String(err)}`);
        return {};
      }
    },
    TEAM_DIRECTORY_TTL
  );

  return directory[resolved.id];
}

async function fetchApiFootballFixtures(
  leagueKey: string,
  limit: number,
  status: 'NS' | 'FT' = 'NS',
  seasonOverride?: number
) {
  const { baseUrl, headers } = getApiFootballConfig();
  const { apiId: leagueId } = getLeagueConfig(leagueKey);
  const season = seasonOverride ?? inferSeason(leagueKey);
  const params: Record<string, string | number | boolean> = {
    league: leagueId,
    season,
    status,
  };
  if (status === 'NS') {
    params.next = Math.min(limit, 99);
  }

  const data = await fetchWithRetry<{ response: any[] }>('api-football', `${baseUrl}/fixtures`, {
    headers,
    params,
  });

  if (!data || !Array.isArray(data.response)) return [];

  return data.response
    .map((f: any) => {
      try {
        if (!f.teams?.home?.id || !f.teams?.away?.id || !f.fixture?.id) return null;
        if (f.fixture?.status?.short && f.fixture.status.short !== status) return null;
        return {
          id: f.fixture.id,
          date: f.fixture.date,
          home: resolveByApiFootballId(f.teams.home.id, f.teams.home.name).id,
          away: resolveByApiFootballId(f.teams.away.id, f.teams.away.name).id,
          homeLogo: f.teams.home.logo,
          awayLogo: f.teams.away.logo,
          homeGoals: f.goals?.home,
          awayGoals: f.goals?.away,
          league: leagueKey,
        };
      } catch (err: unknown) {
        logger.warn('fetchApiFootballFixtures', `Failed to map fixture ${f?.fixture?.id}: ${(err as Error).message}`);
        return null;
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

export async function getTeamStats(teamName: string, league: string): Promise<InternalTeamData | null> {
  if (!(await isSourceReady('api-football'))) return null;

  const leagueKey = normalizeLeagueKey(league);
  const teamIdKey = resolveTeam(teamName).id;

  return withCache(`stats_${teamIdKey}_${leagueKey}`, async () => {
    try {
      const teamId = await resolveApiFootballTeamId(teamName, leagueKey);
      if (!teamId) return null;

      const { baseUrl, headers } = getApiFootballConfig();
      const data = await fetchWithRetry<{ response: any }>('api-football', `${baseUrl}/teams/statistics`, {
        headers,
        params: { team: teamId, league: getLeagueConfig(leagueKey).apiId, season: inferSeason(leagueKey) },
      });

      const stats = data.response;
      if (!stats || !stats.fixtures?.played?.total) return null;

      const leagueConfig = LEAGUE_CONFIGS[leagueKey] || LEAGUE_CONFIGS['STANDARD'];
      const rawScored = Number(stats.goals?.for?.average?.total);
      const rawConceded = Number(stats.goals?.against?.average?.total);
      const avgScored = Number.isFinite(rawScored) && rawScored >= 0 ? rawScored : BASE_GOALS;
      const avgConceded = Number.isFinite(rawConceded) && rawConceded >= 0 ? rawConceded : BASE_GOALS;
      const leagueBase = BASE_GOALS * leagueConfig.goalRate;

      return {
        attackStrength: Math.max(0.2, avgScored / leagueBase),
        defenseStrength: Math.max(0.2, avgConceded / leagueBase),
      };
    } catch (err: unknown) {
      logger.warn('getTeamStats', `Falling back to static data for ${teamName} (${leagueKey}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, TEAM_STATS_TTL);
}

export async function getLiveOdds(league: string) {
  if (!(await isSourceReady('the-odds-api'))) return [];

  const leagueKey = normalizeLeagueKey(league);
  try {
    return await withCache(`live_odds_${leagueKey}`, async () => {
      const apiKey = getOddsApiKey();
      if (!apiKey) throw new Error('[Service] Odds API Key missing.');
      const sport = getLeagueConfig(leagueKey).oddsKey;
      return fetchWithRetry<any[]>('the-odds-api', `https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
        params: { apiKey, regions: 'eu,uk', markets: 'totals', oddsFormat: 'decimal' },
      });
    }, LIVE_ODDS_TTL);
  } catch (err: unknown) {
    logger.warn('getLiveOdds', `Live odds unavailable for ${leagueKey}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function getUpcomingFixtures(league: string, limit = 10): Promise<FixtureMatch[]> {
  if (!(await isSourceReady('api-football'))) return [];

  const leagueKey = normalizeLeagueKey(league);
  try {
    return await withCache(`fixtures_${leagueKey}_${limit}`, async () => {
      const fixtures = await fetchApiFootballFixtures(leagueKey, limit, 'NS');
      return fixtures.map((f) => ({
        homeTeam: f.home,
        awayTeam: f.away,
        homeLogo: f.homeLogo || null,
        awayLogo: f.awayLogo || null,
        kickoff: f.date,
        league: leagueKey,
        fixtureId: f.id,
      }));
    }, FIXTURES_TTL);
  } catch (err: unknown) {
    logger.warn('getUpcomingFixtures', `Upcoming fixtures unavailable for ${leagueKey}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function getHistoricalFixtures(league: string, limit = 150): Promise<HistoricalMatch[]> {
  if (!(await isSourceReady('api-football'))) return [];

  const leagueKey = normalizeLeagueKey(league);
  try {
    return await withCache(`historical_${leagueKey}_${limit}`, async () => {
      const currentSeason = inferSeason(leagueKey);
      const seasonsToFetch = limit > 150 ? [currentSeason - 1, currentSeason] : [currentSeason];
      const settled = await Promise.allSettled(
        seasonsToFetch.map((s) => fetchApiFootballFixtures(leagueKey, limit, 'FT', s))
      );

      const merged = new Map<number, HistoricalMatch>();
      for (const res of settled) {
        if (res.status !== 'fulfilled') continue;
        for (const f of res.value) {
          merged.set(f.id, {
            home: f.home,
            away: f.away,
            homeGoals: f.homeGoals ?? 0,
            awayGoals: f.awayGoals ?? 0,
            date: f.date,
            league: f.league,
          });
        }
      }

      const sorted = Array.from(merged.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return sorted.slice(-limit);
    }, FIXTURES_TTL);
  } catch (err: unknown) {
    logger.warn('getHistoricalFixtures', `Historical fixtures unavailable for ${leagueKey}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
