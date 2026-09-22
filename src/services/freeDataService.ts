import axios from 'axios';
import { ApiFootballProvider } from '../data/providers/ApiFootballProvider';
import { OddsProvider } from '../data/providers/OddsProvider';
import { XGProvider } from '../data/providers/XGProvider';
import { TeamRegistry } from '../data/identity/TeamRegistry';
import { DataGapError } from '../data/types';

const apiFootball = new ApiFootballProvider();
const oddsApi = new OddsProvider();
const xgSource = new XGProvider();

const API_FOOTBALL_KEY = (typeof process !== 'undefined' ? process.env.VITE_API_FOOTBALL_KEY : import.meta.env.VITE_API_FOOTBALL_KEY) || '';
const ODDS_API_KEY = (typeof process !== 'undefined' ? process.env.VITE_ODDS_API_KEY : import.meta.env.VITE_ODDS_API_KEY) || '';

export const isLiveCapable = !!API_FOOTBALL_KEY && !!ODDS_API_KEY;

export interface FixtureMatch {
    homeTeam: string;
    awayTeam: string;
    homeLogo: string;
    awayLogo: string;
    kickoff: string;
    league: string;
    fixtureId: number;
}

export interface HistoricalMatch {
    home: string;
    away: string;
    homeGoals: number;
    awayGoals: number;
    league: string;
    date: string;
    homeId?: number;
    awayId?: number;
    takenPrices?: { 
        over15?: number; 
        under35?: number; 
        oneXTwo?: { home: number; draw: number; away: number } 
    };
    closingPrices?: { 
        over15?: number; 
        under35?: number; 
        oneXTwo?: { home: number; draw: number; away: number } 
    };
    takenAt?: string;
    closedAt?: string;
}

export async function getTeamStats(teamName: string, league: string) {
    if (!isLiveCapable) return null;
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

        return {
            attackStrength: avgGoalsScored / 1.35,
            defenseStrength: avgGoalsConceded / 1.35,
            avgGoalsScored,
            avgGoalsConceded,
            avgXG: avgGoalsScored, // Now using goals as baseline
            avgXGA: avgGoalsConceded,
            homeBias: 0.3,
            form: [1, 1, 1, 1, 1], // Simplified for now
            cleanSheetRate: Number(stats.cleanSheets) / played,
            clinicalEdge: 1.0,
            quality: 'goals-proxy'
        };
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch stats for ${teamName}:`, err);
        return null;
    }
}

export async function getLiveOdds(league: string) {
    if (!isLiveCapable) return [];
    const sportKey = getOddsSportKey(league);
    try {
        return await oddsApi.fetchLiveOdds(league, sportKey);
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch live odds for ${league}:`, err);
        return [];
    }
}

export async function getUpcomingFixtures(league: string, limit: number = 10): Promise<FixtureMatch[]> {
    if (!isLiveCapable) return [];
    try {
        const fixtures = await apiFootball.fetchFixtures(league, limit, 'NS');
        return fixtures.map(f => ({
            homeTeam: f.home,
            awayTeam: f.away,
            homeLogo: '', // Providers should ideally return these if needed
            awayLogo: '',
            kickoff: f.date,
            league: league.toUpperCase(),
            fixtureId: f.id,
        }));
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch upcoming fixtures for ${league}:`, err);
        return [];
    }
}

export async function getHistoricalFixtures(league: string, limit: number = 50): Promise<HistoricalMatch[]> {
    if (!isLiveCapable) return [];
    const sportKey = getOddsSportKey(league);
    
    try {
        const fixtures = await apiFootball.fetchFixtures(league, limit, 'FT');
        const results = [];

        for (const f of fixtures) {
            try {
                // Join with historical odds using (sport, kickoff, teamNames)
                // Use the-odds-api specific names for better join precision
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

                results.push({
                    home: f.home,
                    away: f.away,
                    homeId: f.homeId,
                    awayId: f.awayId,
                    homeGoals: Number(f.homeGoals),
                    awayGoals: Number(f.awayGoals),
                    league: league.toUpperCase(),
                    date: f.date.split('T')[0], // Strip dates
                    takenPrices: {
                        over15: histOdds?.over15?.bestPrice,
                        under35: histOdds?.under35?.bestPrice
                    },
                    closingPrices: {
                        over15: closeOdds?.over15?.bestPrice,
                        under35: closeOdds?.under35?.bestPrice
                    },
                    takenAt: histOdds?.takenAt,
                    closedAt: closeOdds?.closedAt || closeOdds?.takenAt
                });
            } catch (err) {
                console.warn(`[FreeData] Skipping fixture ${f.home} vs ${f.away}:`, (err as Error).message);
                continue;
            }
        }
        return results;
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch historical fixtures for ${league}:`, err);
        return [];
    }
}

function getLeagueId(league: string): number {
    const map: Record<string, number> = { 'EPL': 39, 'LA_LIGA': 140, 'BUNDESLIGA': 78, 'SERIE_A': 135, 'LIGUE_1': 61 };
    return map[league.toUpperCase()] || 39;
}

function getOddsSportKey(league: string): string {
    const map: Record<string, string> = { 'EPL': 'soccer_epl', 'LA_LIGA': 'soccer_spain_la_liga', 'BUNDESLIGA': 'soccer_germany_bundesliga', 'SERIE_A': 'soccer_italy_serie_a', 'LIGUE_1': 'soccer_france_ligue_one' };
    return map[league.toUpperCase()] || 'soccer_epl';
}

function inferSeason(): number {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed (0=Jan, 6=July)
    const year = now.getFullYear();
    // If we're before July, the season started in the previous year
    return month < 6 ? year - 1 : year;
}
