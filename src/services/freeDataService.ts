import { resolveTeam, resolveById } from '../data/teamIds';
import { FixtureMatch, HistoricalMatch, HistoricalPrices, DataSource } from '../types';
import { inferSeason, getLeagueConfig } from '../data/utils';
import { LEAGUE_CONFIGS } from '../core/constants';
import { logger } from './logger';

// --- Infrastructure ---

const quotas = new Map<string, { consumed: number; resetDate: string }>();
const cache = new Map<string, { data: any, timestamp: number }>();

const LIVE_ODDS_TTL = 5 * 60 * 1000; // 5 minutes
const TEAM_STATS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const HISTORICAL_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const FIXTURES_TTL = 30 * 60 * 1000; // 30 minutes
const DEFAULT_TTL = 3600000; // 1 hour

const apiHealth = new Map<string, { healthy: boolean; lastCheck: number }>();

export async function checkApiHealth(api: DataSource): Promise<boolean> {
    const cached = apiHealth.get(api);
    if (cached && Date.now() - cached.lastCheck < 60000) return cached.healthy;

    try {
        if (api === 'api-football') {
            const { baseUrl, headers } = getApiFootballConfig();
            // Use status endpoint to check health and quota
            const res = await fetch(`${baseUrl}/status`, { headers, signal: (AbortSignal as any).timeout?.(5000) });
            const isHealthy = res.status === 200;
            apiHealth.set(api, { healthy: isHealthy, lastCheck: Date.now() });
            return isHealthy;
        } else if (api === 'the-odds-api') {
            const apiKey = getOddsApiKey();
            if (!apiKey) return false;
            // Cheap endpoint to check health
            const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`, { signal: (AbortSignal as any).timeout?.(3000) });
            const isHealthy = res.status === 200;
            apiHealth.set(api, { healthy: isHealthy, lastCheck: Date.now() });
            return isHealthy;
        }
        return true;
    } catch (e) {
        apiHealth.set(api, { healthy: false, lastCheck: Date.now() });
        return false;
    }
}

function checkQuota(source: DataSource) {
    const today = new Date().toISOString().split('T')[0];
    let q = quotas.get(source) || { consumed: 0, resetDate: today };
    if (q.resetDate !== today) q = { consumed: 0, resetDate: today };
    if (q.consumed >= (source === 'the-odds-api' ? 50 : 100)) throw new Error(`[Network] Quota exceeded for ${source}`);
    quotas.set(source, q);
}

async function fetchWithRetry<T>(source: DataSource, url: string, config: any = {}, retries = 3): Promise<T> {
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
                ...config.headers 
            }, 
            signal: controller.signal 
        });
        clearTimeout(timeout);

        if (res.status === 429 || res.status >= 500) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, res.status === 429 ? 5000 : 2000));
                return fetchWithRetry(source, url, config, retries - 1);
            }
        }

        const text = await res.text();
        if (!res.ok) throw new Error(`[Network] ${res.status}: ${text.slice(0, 100)}`);
        
        const data = JSON.parse(text);
        const q = quotas.get(source);
        if (q) q.consumed++;
        return data;
    } catch (e: any) {
        if (retries > 0 && (e.name === 'AbortError' || e.name === 'TimeoutError' || e.message?.toLowerCase().includes('failed') || e.message?.toLowerCase().includes('network'))) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(source, url, config, retries - 1);
        }
        throw e;
    }
}

const promiseCache = new Map<string, Promise<any>>();

async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) return entry.data;
    
    if (promiseCache.has(key)) return promiseCache.get(key);
    
    const p = fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() });
        promiseCache.delete(key);
        return data;
    }).catch(err => {
        promiseCache.delete(key);
        throw err;
    });
    
    promiseCache.set(key, p);
    return p;
}

// --- API Helpers ---

const cleanKey = (k?: string) => (k && k !== 'PLACEHOLDER' && k !== 'null' && k !== 'undefined') ? k.trim().replace(/^['"](.*)['"]$/, '$1') : '';
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
        headers
    };
};

const getOddsApiKey = () => cleanKey(process.env.ODDS_API_KEY);

// --- Provider Logic (Inlined) ---

async function fetchApiFootballFixtures(league: string, limit: number, status: 'NS' | 'FT' = 'NS') {
    const { baseUrl, headers } = getApiFootballConfig();
    const { apiId: leagueId } = getLeagueConfig(league);
    const data = await fetchWithRetry<any>('api-football', `${baseUrl}/fixtures`, {
        headers, params: { league: leagueId, season: inferSeason(league), [status === 'NS' ? 'next' : 'last']: limit, status }
    });

    return (data.response || []).map((f: any) => {
        try {
            return {
                id: f.fixture.id, date: f.fixture.date,
                home: resolveById('apiFootball', f.teams.home.id).id,
                away: resolveById('apiFootball', f.teams.away.id).id,
                homeId: f.teams.home.id, awayId: f.teams.away.id,
                homeLogo: f.teams.home.logo, awayLogo: f.teams.away.logo,
                homeGoals: f.goals.home, awayGoals: f.goals.away,
                league: league.toUpperCase()
            };
        } catch (err: any) { 
            logger.warn('fetchApiFootballFixtures', `Failed to map fixture ${f?.fixture?.id}: ${err.message}`);
            return null; 
        }
    }).filter(Boolean);
}

async function fetchOddsApiLive(sport: string) {
    const apiKey = getOddsApiKey();
    if (!apiKey) throw new Error('[Service] Odds API Key missing.');
    return fetchWithRetry<any[]>('the-odds-api', `https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
        params: { apiKey, regions: 'eu,uk', markets: 'h2h,totals', oddsFormat: 'decimal' }
    });
}

function mapOddsMatch(match: any, timestamp: string): HistoricalPrices {
    let best = { o25: 0, u25: 0 }, sum = { o25: 0, u25: 0 }, count = { o25: 0, u25: 0 };

    (match?.bookmakers || []).forEach((bm: any) => {
        const totals = bm.markets?.find((m: any) => m.key === 'totals');
        const o = totals?.outcomes?.find((oc: any) => oc.name === 'Over' && oc.point === 2.5);
        const u = totals?.outcomes?.find((oc: any) => oc.name === 'Under' && oc.point === 2.5);
        if (o?.price > 1) { best.o25 = Math.max(best.o25, o.price); sum.o25 += o.price; count.o25++; }
        if (u?.price > 1) { best.u25 = Math.max(best.u25, u.price); sum.u25 += u.price; count.u25++; }
    });

    const fair = (b: number, s: number, c: number) => {
        const consensus = c > 0 ? s / c : b;
        if (b <= 1 || consensus <= 1) return b > 1 ? b * 0.97 : 0;
        return 1 / ((1 / b) / ((1 / b) + (1 / consensus)));
    };

    return {
        over25: { bestPrice: best.o25, noVigPrice: fair(best.o25, sum.o25, count.o25) },
        under25: { bestPrice: best.u25, noVigPrice: fair(best.u25, sum.u25, count.u25) },
        takenAt: timestamp
    };
}

// --- Service Implementation ---

export const isLiveCapable = () => !!cleanKey(process.env.API_FOOTBALL_KEY) && !!getOddsApiKey();

export async function getTeamStats(teamName: string, league: string) {
    if (!isLiveCapable()) return null;
    return withCache(`stats_${teamName}_${league}`, async () => {
        try {
            const { baseUrl, headers } = getApiFootballConfig();
            const teamId = resolveTeam(teamName).externalIds.apiFootball;
            if (!teamId) return null;

            const data = await fetchWithRetry<any>('api-football', `${baseUrl}/teams/statistics`, {
                headers, params: { team: teamId, league: getLeagueConfig(league).apiId, season: inferSeason(league) }
            });

            const stats = data.response;
            if (!stats?.fixtures?.played?.total) return null;

            const goalAvg = stats.goals.for.average;
            const concedeAvg = stats.goals.against.average;
            const leagueConfig = LEAGUE_CONFIGS[league] || LEAGUE_CONFIGS['STANDARD'];

            const avgScored = Number(goalAvg.total) || 1.35;
            const avgConceded = Number(concedeAvg.total) || 1.35;
            const homeRate = Number(goalAvg.home) || avgScored;
            const awayRate = Number(goalAvg.away) || avgScored;

            return {
                attackStrength: avgScored / 1.35,
                defenseStrength: avgConceded / 1.35,
                avgGoalsScored: avgScored,
                avgGoalsConceded: avgConceded,
                homeAdvantageHeuristic: Math.max(0.15, Math.min(0.45, leagueConfig.homeAdvantage + ((homeRate - awayRate) * 0.1))),
                form: [1, 1, 1, 1, 1],
                cleanSheetRate: (Number(stats.clean_sheet.total) || 0) / stats.fixtures.played.total,
                quality: 'goals-proxy' as const
            };
        } catch (err: any) {
            logger.error('getTeamStats', err, { teamName, league });
            return null;
        }
    }, TEAM_STATS_TTL);
}

export async function getLiveOdds(league: string) {
    if (!isLiveCapable()) return [];
    return withCache(`live_odds_${league}`, () => fetchOddsApiLive(getLeagueConfig(league).oddsKey), LIVE_ODDS_TTL);
}

export async function getUpcomingFixtures(league: string, limit = 10): Promise<FixtureMatch[]> {
    if (!isLiveCapable()) return [];
    return withCache(`fixtures_${league}_${limit}`, async () => {
        const fixtures = await fetchApiFootballFixtures(league, limit, 'NS');
        return fixtures.map((f: any) => ({
            homeTeam: f.home, awayTeam: f.away, homeLogo: f.homeLogo || null, awayLogo: f.awayLogo || null,
            kickoff: f.date, league: league.toUpperCase(), fixtureId: f.id
        }));
    }, FIXTURES_TTL);
}

async function fetchOddsBatch(sportKey: string, date: string) {
    return withCache(`odds_batch_${sportKey}_${date}`, async () => {
        const apiKey = getOddsApiKey();
        if (!apiKey) throw new Error('[Service] Odds API Key missing.');
        const res = await fetchWithRetry<any>('the-odds-api', `https://api.the-odds-api.com/v4/historical/sports/${sportKey}/odds`, {
            params: { apiKey, date, markets: 'totals' }
        });
        return res.data || [];
    }, HISTORICAL_TTL);
}

export async function getHistoricalFixtures(league: string, limit = 150, fetchOdds = true): Promise<HistoricalMatch[]> {
    if (!isLiveCapable()) return [];
    
    const fixtures = await fetchApiFootballFixtures(league, limit, 'FT');
    if (!fetchOdds) return fixtures.map((f: any) => ({ ...f }));

    const sportKey = getLeagueConfig(league).oddsKey;
    const dates = [...new Set(fixtures.map((f: any) => f.date.split('T')[0]))] as string[];

    // Fetch odds for all dates at once (1 API call per date)
    const allOdds = await Promise.all(dates.map(date => fetchOddsBatch(sportKey, date)));

    return fixtures.map((f: any) => {
        const dateStr = f.date.split('T')[0];
        const dateOdds = allOdds[dates.indexOf(dateStr)];
        const hIdent = resolveById('apiFootball', f.homeId);
        const matchOdds = dateOdds?.find((m: any) => m.home_team === hIdent.externalIds.theOddsApi);

        const result: HistoricalMatch = { ...f, date: dateStr };
        if (matchOdds) {
            const mapped = mapOddsMatch(matchOdds, f.date);
            result.takenPrices = { 
                over25: mapped.over25.bestPrice, 
                over25NoVig: mapped.over25.noVigPrice,
                under25: mapped.under25.bestPrice, 
                under25NoVig: mapped.under25.noVigPrice
            };
            result.closingPrices = { ...result.takenPrices }; // Approximation
            result.takenAt = f.date;
        }
        return result;
    });
}
