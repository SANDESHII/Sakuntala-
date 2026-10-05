import { resolveTeam, resolveById } from '../data/teamIds';
import { fetchWithRetry } from '../data/http/client';
import { FixtureMatch, HistoricalMatch, HistoricalPrices } from '../types';
import { inferSeason, getLeagueConfig } from '../data/utils';
import { LEAGUE_CONFIGS } from '../core/constants';

// --- API Helpers ---

function getApiFootballKey() {
    const env = process.env || {};
    let key = (env.API_FOOTBALL_KEY || '').trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
    return (key && key !== 'undefined' && key !== 'null' && key !== 'PLACEHOLDER') ? key : '';
}

function getOddsApiKey() {
    const env = process.env || {};
    let key = (env.ODDS_API_KEY || '').trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
    return (key && key !== 'undefined' && key !== 'null' && key !== 'PLACEHOLDER') ? key : '';
}

function getApiFootballConfig() {
    const key = getApiFootballKey();
    if (!key) throw new Error('[Service] API-Football Key missing.');
    const isRapid = !/^[a-f0-9]{32}$/i.test(key);
    const baseUrl = isRapid ? 'https://api-football-v1.p.rapidapi.com/v3' : 'https://v3.football.api-sports.io';
    const headers = isRapid ? { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' } : { 'x-apisports-key': key };
    return { baseUrl, headers };
}

// --- Provider Logic (Inlined) ---

async function fetchApiFootballFixtures(league: string, limit: number, status: 'NS' | 'FT' = 'NS') {
    const { baseUrl, headers } = getApiFootballConfig();
    const { apiId: leagueId } = getLeagueConfig(league);
    const season = inferSeason();

    const data = await fetchWithRetry<any>(
        'api-football',
        `${baseUrl}/fixtures`,
        { headers, params: { league: leagueId, season, [status === 'NS' ? 'next' : 'last']: limit, status } }
    );

    return (data.response || [])
        .map((f: any) => {
            try {
                return {
                    id: f.fixture.id,
                    date: f.fixture.date,
                    home: resolveById('apiFootball', f.teams.home.id).id,
                    away: resolveById('apiFootball', f.teams.away.id).id,
                    homeId: f.teams.home.id,
                    awayId: f.teams.away.id,
                    homeLogo: f.teams.home.logo,
                    awayLogo: f.teams.away.logo,
                    homeGoals: f.goals.home,
                    awayGoals: f.goals.away,
                    league: league.toUpperCase()
                };
            } catch { return null; }
        })
        .filter((f: any) => f !== null);
}

async function fetchOddsApiLive(sport: string) {
    const key = getOddsApiKey();
    if (!key) throw new Error('[Service] Odds API Key missing.');
    return await fetchWithRetry<any[]>('the-odds-api', `https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
        params: { apiKey: key, regions: 'eu,uk', markets: 'h2h,totals', oddsFormat: 'decimal' }
    });
}

async function fetchOddsApiSnapshot(sport: string, date: string) {
    const key = getOddsApiKey();
    if (!key) throw new Error('[Service] Odds API Key missing.');
    const res = await fetchWithRetry<any>('the-odds-api', `https://api.the-odds-api.com/v4/historical/sports/${sport}/odds`, {
        params: { apiKey: key, regions: 'eu,uk', markets: 'totals', oddsFormat: 'decimal', date }
    });
    return res.data || [];
}

function calculateNoVig(bestPrice: number, consensusPrice: number): number {
    const p1 = 1 / bestPrice;
    const p2 = 1 / consensusPrice;
    const fairProbability = p1 / (p1 + p2);
    return 1 / fairProbability;
}

function mapOddsMatch(match: any, timestamp: string): HistoricalPrices {
    let bestO25 = 0, sumO25 = 0, countO25 = 0;
    let bestU25 = 0, sumU25 = 0, countU25 = 0;

    match.bookmakers?.forEach((bm: any) => {
        const market = bm.markets.find((m: any) => m.key === 'totals');
        if (market) {
            const o25 = market.outcomes.find((o: any) => o.name === 'Over' && o.point === 2.5);
            const u25 = market.outcomes.find((o: any) => o.name === 'Under' && o.point === 2.5);
            if (o25) { bestO25 = Math.max(bestO25, o25.price); sumO25 += o25.price; countO25++; }
            if (u25) { bestU25 = Math.max(bestU25, u25.price); sumU25 += u25.price; countU25++; }
        }
    });

    const avgU25 = countU25 > 0 ? sumU25 / countU25 : bestU25;
    const avgO25 = countO25 > 0 ? sumO25 / countO25 : bestO25;

    return {
        over25: { bestPrice: bestO25, noVigPrice: (bestO25 > 0 && avgU25 > 0) ? calculateNoVig(bestO25, avgU25) : bestO25 * 0.97 },
        under25: { bestPrice: bestU25, noVigPrice: (bestU25 > 0 && avgO25 > 0) ? calculateNoVig(bestU25, avgO25) : bestU25 * 0.97 },
        takenAt: timestamp
    };
}

// --- Service Implementation ---

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3600 * 1000;

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    return (entry && Date.now() - entry.timestamp < CACHE_TTL) ? entry.data : null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, timestamp: Date.now() });
}

async function fetchOddsPair(sportKey: string, date: string, homeName: string, awayName: string) {
    const kickoffDate = new Date(date);
    const takenIso = new Date(kickoffDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z';
    const kickoffIso = kickoffDate.toISOString().split('.')[0] + 'Z';

    const [takenRes, closingRes] = await Promise.allSettled([
        fetchOddsApiSnapshot(sportKey, takenIso),
        fetchOddsApiSnapshot(sportKey, kickoffIso)
    ]);

    const findMatch = (snap: any[]) => snap.find((m: any) => (m.home_team === homeName && m.away_team === awayName) || (m.home_team === awayName && m.away_team === homeName));

    const takenMatch = takenRes.status === 'fulfilled' ? findMatch(takenRes.value) : null;
    const closingMatch = closingRes.status === 'fulfilled' ? findMatch(closingRes.value) : null;

    return {
        taken: takenMatch ? mapOddsMatch(takenMatch, takenIso) : undefined,
        closing: closingMatch ? mapOddsMatch(closingMatch, kickoffIso) : undefined
    };
}

export function isLiveCapable() {
    return !!getApiFootballKey() && !!getOddsApiKey();
}

export async function getTeamStats(teamName: string, league: string) {
    if (!isLiveCapable()) return null;
    const cacheKey = `stats_${teamName}_${league}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { baseUrl, headers } = getApiFootballConfig();
        const identity = resolveTeam(teamName);
        const teamId = identity.externalIds.apiFootball;
        if (!teamId) return null;

        const data = await fetchWithRetry<any>('api-football', `${baseUrl}/teams/statistics`, {
            headers, params: { team: teamId, league: getLeagueConfig(league).apiId, season: inferSeason() }
        });

        const stats = data.response;
        if (!stats?.fixtures?.played?.total) return null;

        const avgGoalsScored = stats.goals.for.average.total;
        const avgGoalsConceded = stats.goals.against.average.total;
        const homeRate = stats.goals.for.average.home || avgGoalsScored;
        const awayRate = stats.goals.for.average.away || avgGoalsScored;
        const leagueConfig = LEAGUE_CONFIGS[league] || LEAGUE_CONFIGS['STANDARD'];
        const homeAdvantageHeuristic = Math.max(0.15, Math.min(0.45, leagueConfig.homeAdvantage + ((homeRate - awayRate) * 0.1)));

        const result = {
            attackStrength: avgGoalsScored / 1.35,
            defenseStrength: avgGoalsConceded / 1.35,
            avgGoalsScored,
            avgGoalsConceded,
            homeAdvantageHeuristic,
            form: [1, 1, 1, 1, 1],
            cleanSheetRate: stats.clean_sheet.total / stats.fixtures.played.total,
            quality: 'goals-proxy' as const
        };
        setCache(cacheKey, result);
        return result;
    } catch (err: any) {
        return null;
    }
}

export async function getLiveOdds(league: string) {
    if (!isLiveCapable()) return [];
    const cacheKey = `live_odds_${league}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
        const result = await fetchOddsApiLive(getLeagueConfig(league).oddsKey);
        setCache(cacheKey, result);
        return result;
    } catch (err: any) {
        return [];
    }
}

export async function getUpcomingFixtures(league: string, limit: number = 10): Promise<FixtureMatch[]> {
    if (!isLiveCapable()) return [];
    const cacheKey = `fixtures_${league}_${limit}`;
    const cached = getCached<FixtureMatch[]>(cacheKey);
    if (cached) return cached;

    try {
        const fixtures = await fetchApiFootballFixtures(league, limit, 'NS');
        const result = fixtures.map((f: any) => ({
            homeTeam: f.home, awayTeam: f.away, homeLogo: f.homeLogo || null, awayLogo: f.awayLogo || null,
            kickoff: f.date, league: league.toUpperCase(), fixtureId: f.id
        }));
        setCache(cacheKey, result);
        return result;
    } catch (err: any) {
        return [];
    }
}

export async function getHistoricalFixtures(league: string, limit: number = 50, fetchOdds: boolean = true): Promise<HistoricalMatch[]> {
    if (!isLiveCapable()) return [];
    const cacheKey = `hist_${league}_${limit}_${fetchOdds}`;
    const cached = getCached<HistoricalMatch[]>(cacheKey);
    if (cached) return cached;

    const sportKey = getLeagueConfig(league).oddsKey;
    try {
        const fixtures = await fetchApiFootballFixtures(league, limit, 'FT');
        const results = [];
        for (const f of fixtures) {
            try {
                const matchObj: HistoricalMatch = {
                    home: f.home, away: f.away, homeId: f.homeId, awayId: f.awayId,
                    homeGoals: Number(f.homeGoals), awayGoals: Number(f.awayGoals),
                    league: league.toUpperCase(), date: f.date.split('T')[0]
                };

                if (fetchOdds) {
                    const homeIdent = resolveById('apiFootball', f.homeId || 0);
                    const awayIdent = resolveById('apiFootball', f.awayId || 0);
                    const { taken, closing } = await fetchOddsPair(sportKey, f.date, homeIdent.externalIds.theOddsApi || homeIdent.name, awayIdent.externalIds.theOddsApi || awayIdent.name);
                    matchObj.takenPrices = { over25: taken?.over25?.bestPrice, over25NoVig: taken?.over25?.noVigPrice, under25: taken?.under25?.bestPrice, under25NoVig: taken?.under25?.noVigPrice };
                    matchObj.closingPrices = { over25: closing?.over25?.bestPrice, over25NoVig: closing?.over25?.noVigPrice, under25: closing?.under25?.bestPrice, under25NoVig: closing?.under25?.noVigPrice };
                    matchObj.takenAt = taken?.takenAt;
                    matchObj.closedAt = closing?.takenAt;
                }
                results.push(matchObj);
            } catch { continue; }
        }
        setCache(cacheKey, results);
        return results;
    } catch { return []; }
}

export async function getHistoricalOddsForMatch(league: string, date: string, homeName: string, awayName: string) {
    if (!isLiveCapable()) return null;
    const cacheKey = `hist_odds_${league}_${date}_${homeName}_${awayName}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { taken, closing } = await fetchOddsPair(getLeagueConfig(league).oddsKey, date, homeName, awayName);
        const result = {
            takenPrices: { over25: taken?.over25?.bestPrice, over25NoVig: taken?.over25?.noVigPrice, under25: taken?.under25?.bestPrice, under25NoVig: taken?.under25?.noVigPrice },
            closingPrices: { over25: closing?.over25?.bestPrice, over25NoVig: closing?.over25?.noVigPrice, under25: closing?.under25?.bestPrice, under25NoVig: closing?.under25?.noVigPrice },
            takenAt: taken?.takenAt, closedAt: closing?.takenAt
        };
        setCache(cacheKey, result);
        return result;
    } catch { return null; }
}
