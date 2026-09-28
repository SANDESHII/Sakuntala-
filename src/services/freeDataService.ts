import { ApiFootballProvider } from '../data/providers/ApiFootballProvider';
import { OddsProvider } from '../data/providers/OddsProvider';
import { TeamRegistry } from '../data/identity/registry';
import { DataGapError, FixtureMatch, HistoricalMatch } from '../types';
import { inferSeason, normalizeLeagueToId as getLeagueId, getOddsSportKey } from '../data/utils';
import { LEAGUE_CONFIGS } from '../core/constants';

const apiFootball = new ApiFootballProvider();
const oddsApi = new OddsProvider();

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data as T;
    }
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, timestamp: Date.now() });
}

// Request throttling helper
async function throttle() {
    await new Promise(resolve => setTimeout(resolve, 250)); // 250ms gap
}

export function isLiveCapable() {
    const env = typeof process !== 'undefined' ? process.env : (import.meta as any).env || {};
    const getClean = (k?: string) => {
        const trimmed = (k || '').trim();
        if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'PLACEHOLDER') return '';
        return trimmed;
    };

    const apiFootballKey = getClean(env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY);
    const oddsApiKey = getClean(env.VITE_ODDS_API_KEY || env.API_ODDS_KEY || env.ODDS_API_KEY);
    
    return !!apiFootballKey && !!oddsApiKey;
}

export async function getTeamStats(teamName: string, league: string) {
    if (!isLiveCapable()) return null;
    const cacheKey = `stats_${teamName}_${league}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    const leagueId = getLeagueId(league);
    const season = inferSeason();

    try {
        const identity = TeamRegistry.resolveByName(teamName);
        const teamId = identity.externalIds.apiFootball;
        
        if (!teamId) {
            throw new DataGapError('API-Football ID', teamName);
        }

        const stats = await apiFootball.fetchTeamStats(teamId, leagueId, season);
        const played = Number(stats.played);
        if (!played) return null;

        const avgGoalsScored = Number(stats.goals.for);
        const avgGoalsConceded = Number(stats.goals.against);

        const homeRate = Number(stats.goals.homeFor || avgGoalsScored);
        const awayRate = Number(stats.goals.awayFor || avgGoalsScored);
        const diff = homeRate - awayRate;
        const leagueConfig = LEAGUE_CONFIGS[league] || LEAGUE_CONFIGS['STANDARD'];
        const baseHomeAdv = leagueConfig.homeAdvantage;
        const homeAdvantageHeuristic = Math.max(0.15, Math.min(0.45, baseHomeAdv + (diff * 0.1)));

        const result = {
            attackStrength: avgGoalsScored / 1.35,
            defenseStrength: avgGoalsConceded / 1.35,
            avgGoalsScored,
            avgGoalsConceded,
            homeAdvantageHeuristic,
            form: [1, 1, 1, 1, 1],
            cleanSheetRate: Number(stats.cleanSheets) / played,
            quality: 'goals-proxy' as const
        };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch stats for ${teamName}:`, err);
        return null;
    }
}

export async function getLiveOdds(league: string) {
    if (!isLiveCapable()) return [];
    const cacheKey = `live_odds_${league}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    const sportKey = getOddsSportKey(league);
    try {
        const result = await oddsApi.fetchLiveOdds(league, sportKey);
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch live odds for ${league}:`, err);
        return [];
    }
}

const MOCK_FIXTURES: Record<string, any[]> = {
    'EPL': [
        { id: 1, date: '2026-09-25T20:00:00Z', homeId: 33, awayId: 34, home: 'Man United', away: 'Newcastle', homeGoals: 2, awayGoals: 1 },
        { id: 2, date: '2026-09-26T15:00:00Z', homeId: 40, awayId: 42, home: 'Liverpool', away: 'Arsenal', homeGoals: 2, awayGoals: 2 },
        { id: 3, date: '2026-09-27T16:30:00Z', homeId: 50, awayId: 49, home: 'Man City', away: 'Chelsea', homeGoals: 3, awayGoals: 1 },
        { id: 4, date: '2026-09-20T14:00:00Z', homeId: 33, awayId: 42, home: 'Man United', away: 'Arsenal', homeGoals: 1, awayGoals: 0 },
        { id: 5, date: '2026-09-21T15:00:00Z', homeId: 40, awayId: 50, home: 'Liverpool', away: 'Man City', homeGoals: 2, awayGoals: 3 },
        { id: 6, date: '2026-09-22T20:00:00Z', homeId: 34, awayId: 49, home: 'Newcastle', away: 'Chelsea', homeGoals: 1, awayGoals: 1 },
        { id: 7, date: '2026-09-15T19:45:00Z', homeId: 42, awayId: 33, home: 'Arsenal', away: 'Man United', homeGoals: 2, awayGoals: 0 },
        { id: 8, date: '2026-09-16T20:00:00Z', homeId: 50, awayId: 40, home: 'Man City', away: 'Liverpool', homeGoals: 1, awayGoals: 1 },
        { id: 9, date: '2026-09-17T19:00:00Z', homeId: 49, awayId: 34, home: 'Chelsea', away: 'Newcastle', homeGoals: 2, awayGoals: 1 },
        { id: 10, date: '2026-09-10T15:00:00Z', homeId: 33, awayId: 34, home: 'Man United', away: 'Newcastle', homeGoals: 3, awayGoals: 0 },
    ],
    'LA_LIGA': [
        { id: 101, date: '2026-09-25T19:00:00Z', homeId: 529, awayId: 541, home: 'Barcelona', away: 'Real Madrid', homeGoals: 1, awayGoals: 2 },
        { id: 102, date: '2026-09-26T18:30:00Z', homeId: 530, awayId: 536, home: 'Atlético', away: 'Sevilla', homeGoals: 1, awayGoals: 0 },
        { id: 103, date: '2026-09-18T19:00:00Z', homeId: 529, awayId: 530, home: 'Barcelona', away: 'Atlético', homeGoals: 2, awayGoals: 0 },
        { id: 104, date: '2026-09-19T20:00:00Z', homeId: 541, awayId: 536, home: 'Real Madrid', away: 'Sevilla', homeGoals: 3, awayGoals: 0 },
        { id: 105, date: '2026-09-11T19:00:00Z', homeId: 530, awayId: 541, home: 'Atlético', away: 'Real Madrid', homeGoals: 1, awayGoals: 1 },
        { id: 106, date: '2026-09-12T15:00:00Z', homeId: 536, awayId: 529, home: 'Sevilla', away: 'Barcelona', homeGoals: 0, awayGoals: 2 },
    ],
    'BUNDESLIGA': [
        { id: 201, date: '2026-09-25T18:30:00Z', homeId: 157, awayId: 165, home: 'Bayern Munich', away: 'Dortmund', homeGoals: 2, awayGoals: 2 },
        { id: 202, date: '2026-09-26T13:30:00Z', homeId: 173, awayId: 168, home: 'RB Leipzig', away: 'Leverkusen', homeGoals: 1, awayGoals: 1 },
    ],
    'SERIE_A': [
        { id: 301, date: '2026-09-26T19:45:00Z', homeId: 496, awayId: 489, home: 'Juventus', away: 'AC Milan', homeGoals: 0, awayGoals: 0 },
        { id: 302, date: '2026-09-27T14:00:00Z', homeId: 505, awayId: 492, home: 'Inter', away: 'Napoli', homeGoals: 2, awayGoals: 1 },
    ],
    'LIGUE_1': [
        { id: 401, date: '2026-09-27T19:45:00Z', homeId: 85, awayId: 80, home: 'PSG', away: 'Lyon', homeGoals: 4, awayGoals: 1 },
        { id: 402, date: '2026-09-26T19:00:00Z', homeId: 81, awayId: 94, home: 'Marseille', away: 'Rennes', homeGoals: 1, awayGoals: 0 },
    ]
};

export async function getUpcomingFixtures(league: string, limit: number = 10): Promise<FixtureMatch[]> {
    if (!isLiveCapable()) return [];
    
    const cacheKey = `fixtures_${league}_${limit}`;
    const cached = getCached<FixtureMatch[]>(cacheKey);
    if (cached) return cached;

    try {
        const fixtures = await apiFootball.fetchFixtures(league, limit, 'NS');
        const result = fixtures.map((f: any) => ({
            homeTeam: f.home,
            awayTeam: f.away,
            homeLogo: f.homeLogo || null, 
            awayLogo: f.awayLogo || null,
            kickoff: f.date,
            league: league.toUpperCase(),
            fixtureId: f.id,
        }));
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.warn(`[FreeData] API Unavailable for ${league}, using mock fixtures:`, (err as Error).message);
        const mocks = MOCK_FIXTURES[league] || [];
        return mocks.map(f => ({
            homeTeam: f.home,
            awayTeam: f.away,
            homeLogo: null,
            awayLogo: null,
            kickoff: f.date,
            league: league.toUpperCase(),
            fixtureId: f.id
        }));
    }
}

export async function getHistoricalFixtures(league: string, limit: number = 50, fetchOdds: boolean = true): Promise<HistoricalMatch[]> {
    if (!isLiveCapable()) return [];

    const cacheKey = `hist_${league}_${limit}_${fetchOdds}`;
    const cached = getCached<HistoricalMatch[]>(cacheKey);
    if (cached) return cached;

    const sportKey = getOddsSportKey(league);
    
    try {
        const fixtures = await apiFootball.fetchFixtures(league, limit, 'FT');
        const results = [];

        for (const f of fixtures as any[]) {
            try {
                const matchDate = f.date.split('T')[0];
                const matchObj: HistoricalMatch = {
                    home: f.home,
                    away: f.away,
                    homeId: f.homeId,
                    awayId: f.awayId,
                    homeGoals: Number(f.homeGoals),
                    awayGoals: Number(f.awayGoals),
                    league: league.toUpperCase(),
                    date: matchDate,
                };

                if (fetchOdds) {
                    await throttle();
                    const homeIdent = TeamRegistry.resolveById('apiFootball', f.homeId || 0);
                    const awayIdent = TeamRegistry.resolveById('apiFootball', f.awayId || 0);
                    const homeOddsName = homeIdent.externalIds.theOddsApi || homeIdent.name;
                    const awayOddsName = awayIdent.externalIds.theOddsApi || awayIdent.name;

                    const [takenOdds, closingOdds] = await Promise.allSettled([
                        oddsApi.fetchHistoricalOdds(sportKey, f.date, homeOddsName, awayOddsName),
                        oddsApi.fetchClosingOdds(sportKey, f.date, homeOddsName, awayOddsName)
                    ]);

                    const histOdds = takenOdds.status === 'fulfilled' ? takenOdds.value : undefined;
                    const closeOdds = closingOdds.status === 'fulfilled' ? closingOdds.value : undefined;

                    matchObj.takenPrices = {
                        over25: histOdds?.over25?.bestPrice,
                        over25NoVig: histOdds?.over25?.noVigPrice,
                        under25: histOdds?.under25?.bestPrice,
                        under25NoVig: histOdds?.under25?.noVigPrice
                    };
                    matchObj.closingPrices = {
                        over25: closeOdds?.over25?.bestPrice,
                        over25NoVig: closeOdds?.over25?.noVigPrice,
                        under25: closeOdds?.under25?.bestPrice,
                        under25NoVig: closeOdds?.under25?.noVigPrice
                    };
                    matchObj.takenAt = histOdds?.takenAt;
                    matchObj.closedAt = closeOdds?.closedAt || closeOdds?.takenAt;
                }
                results.push(matchObj);
            } catch (err) {
                console.warn(`[FreeData] Skipping fixture ${f.home} vs ${f.away}:`, (err as Error).message);
                continue;
            }
        }
        setCache(cacheKey, results);
        return results;
    } catch (err) {
        console.warn(`[FreeData] API Unavailable for historical fixtures of ${league}, using mock historical data:`, (err as Error).message);
        const mocks = MOCK_FIXTURES[league] || [];
        return mocks.map(f => ({
            home: f.home,
            away: f.away,
            homeId: f.homeId,
            awayId: f.awayId,
            homeGoals: f.homeGoals,
            awayGoals: f.awayGoals,
            league: league.toUpperCase(),
            date: f.date.split('T')[0],
            takenPrices: { over25: 1.95, under25: 1.85 },
            closingPrices: { over25: 1.90, under25: 1.90 }
        }));
    }
}

export async function getHistoricalOddsForMatch(league: string, date: string, homeName: string, awayName: string) {
    if (!isLiveCapable()) return null;
    const cacheKey = `hist_odds_${league}_${date}_${homeName}_${awayName}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    const sportKey = getOddsSportKey(league);
    
    try {
        await throttle();
        const [takenOdds, closingOdds] = await Promise.allSettled([
            oddsApi.fetchHistoricalOdds(sportKey, date, homeName, awayName),
            oddsApi.fetchClosingOdds(sportKey, date, homeName, awayName)
        ]);

        const histOdds = takenOdds.status === 'fulfilled' ? takenOdds.value : undefined;
        const closeOdds = closingOdds.status === 'fulfilled' ? closingOdds.value : undefined;

        const result = {
            takenPrices: {
                over25: histOdds?.over25?.bestPrice,
                over25NoVig: histOdds?.over25?.noVigPrice,
                under25: histOdds?.under25?.bestPrice,
                under25NoVig: histOdds?.under25?.noVigPrice
            },
            closingPrices: {
                over25: closeOdds?.over25?.bestPrice,
                over25NoVig: closeOdds?.over25?.noVigPrice,
                under25: closeOdds?.under25?.bestPrice,
                under25NoVig: closeOdds?.under25?.noVigPrice
            },
            takenAt: histOdds?.takenAt,
            closedAt: closeOdds?.closedAt || closeOdds?.takenAt
        };
        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch odds for ${homeName} vs ${awayName}:`, err);
        return null;
    }
}
export async function getHistoricalFixturesLight(league: string, limit: number = 50): Promise<HistoricalMatch[]> {
    if (!isLiveCapable()) return [];
    try {
        const fixtures = await apiFootball.fetchFixtures(league, limit, 'FT');
        return fixtures.map((f: any) => ({
            home: f.home,
            away: f.away,
            homeId: f.homeId,
            awayId: f.awayId,
            homeGoals: Number(f.homeGoals),
            awayGoals: Number(f.awayGoals),
            league: league.toUpperCase(),
            date: f.date.split('T')[0]
        }));
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch historical fixtures (light) for ${league}:`, err);
        return [];
    }
}
