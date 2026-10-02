import { ApiFootballProvider } from '../data/providers/ApiFootballProvider';
import { OddsProvider } from '../data/providers/OddsProvider';
import { TeamRegistry } from '../data/identity/registry';
import { FixtureMatch, HistoricalMatch } from '../types';
import { inferSeason, normalizeLeagueToId as getLeagueId, getOddsSportKey } from '../data/utils';
import { LEAGUE_CONFIGS } from '../core/constants';
import { MOCK_FIXTURES } from '../data/mocks';

const apiFootball = new ApiFootballProvider();
const oddsApi = new OddsProvider();

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

// Subscription blacklist to avoid repetitive 403s
const subscriptionBlacklist = new Set<string>();

// Request throttling helper
async function throttle() {
    // 600ms base + random jitter to avoid synchronized bursts
    const ms = 600 + Math.random() * 400;
    await new Promise(resolve => setTimeout(resolve, ms));
}

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
    
    const blacklistKey = `stats_${teamName}`;
    if (subscriptionBlacklist.has(blacklistKey)) return null;

    const cacheKey = `stats_${teamName}_${league}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    const leagueId = getLeagueId(league);
    const season = inferSeason();

    try {
        const identity = TeamRegistry.resolveByName(teamName);
        const teamId = identity.externalIds.apiFootball;
        
        if (!teamId) {
            // Log as info, not warning, since it might be a synthetic team
            console.info(`[FreeData] No live ID for ${teamName}, using fallback.`);
            return null;
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
    } catch (err: any) {
        if (err.message?.includes('403') || err.message?.includes('subscription')) {
            console.warn(`[FreeData] Subscription restriction for ${teamName}. Disabling live stats for this team.`);
            subscriptionBlacklist.add(blacklistKey);
        } else {
            console.warn(`[FreeData] Failed to fetch stats for ${teamName}:`, err.message);
        }
        return null;
    }
}

export async function getLiveOdds(league: string) {
    if (!isLiveCapable()) return [];
    
    if (subscriptionBlacklist.has('live_odds')) return [];

    const cacheKey = `live_odds_${league}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    const sportKey = getOddsSportKey(league);
    try {
        const result = await oddsApi.fetchLiveOdds(league, sportKey);
        setCache(cacheKey, result);
        return result;
    } catch (err: any) {
        if (err.message?.includes('401') || err.message?.includes('Invalid API Key')) {
            console.error('[FreeData] The Odds API key is invalid. Disabling odds for this session.');
            subscriptionBlacklist.add('live_odds');
        } else {
            console.warn(`[FreeData] Failed to fetch live odds for ${league}:`, err.message);
        }
        return [];
    }
}

export async function getUpcomingFixtures(league: string, limit: number = 10): Promise<FixtureMatch[]> {
    if (!isLiveCapable()) return [];
    
    const blacklistKey = `fixtures_${league}`;
    if (subscriptionBlacklist.has(blacklistKey)) return [];

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
    } catch (err: any) {
        if (err.message?.includes('403') || err.message?.includes('subscription')) {
            console.warn(`[FreeData] Subscription restriction for fixtures in ${league}.`);
            subscriptionBlacklist.add(blacklistKey);
        } else {
            console.warn(`[FreeData] API Unavailable for ${league}, using mock fixtures:`, err.message);
        }
        
        const mocks = (MOCK_FIXTURES as any)[league] || [];
        return mocks.map((f: any) => ({
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
        const mocks = (MOCK_FIXTURES as any)[league] || [];
        return mocks.map((f: any) => ({
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
