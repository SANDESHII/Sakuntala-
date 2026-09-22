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
    if (!API_FOOTBALL_KEY) return null;
    const leagueId = getLeagueId(league);
    try {
        // Strict identity resolution
        const identity = TeamRegistry.resolveByName(teamName);
        const teamId = identity.externalIds.apiFootball;
        
        if (!teamId) {
            throw new DataGapError('API-Football ID', teamName);
        }
        const statsResponse = await axios.get('https://v3.football.api-sports.io/teams/statistics', {
            headers: { 'x-apisports-key': API_FOOTBALL_KEY },
            params: { team: teamId, league: leagueId, season: inferSeason() }
        });
        const stats = statsResponse.data.response;
        const played = stats.fixtures.played.total;
        if (!played) return null;

        const avgGoalsScored = stats.goals.for.total / played;
        const avgGoalsConceded = stats.goals.against.total / played;

        const formStr = typeof stats.form === 'string' ? stats.form : '';
        return {
            attackStrength: avgGoalsScored / 1.35,
            defenseStrength: avgGoalsConceded / 1.35,
            avgGoalsScored,
            avgGoalsConceded,
            avgXG: avgGoalsScored, // Now using goals as baseline, quality tagged separately if needed
            avgXGA: avgGoalsConceded,
            homeBias: 0.3,
            form: formStr.split('').slice(-5).map((r: string) => r === 'W' ? 3 : r === 'D' ? 1 : 0),
            cleanSheetRate: stats.clean_sheet.total / played,
            clinicalEdge: 1.0,
            quality: 'goals-proxy'
        };
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch stats for ${teamName}:`, err);
        return null;
    }
}

export async function getLiveOdds(league: string) {
    if (!ODDS_API_KEY) return [];
    const sportKey = getOddsSportKey(league);
    try {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`, {
            params: { apiKey: ODDS_API_KEY, regions: 'eu,uk', markets: 'totals', oddsFormat: 'decimal' }
        });
        return response.data;
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch live odds for ${league}:`, err);
        return [];
    }
}

export async function getUpcomingFixtures(league: string, limit: number = 10): Promise<FixtureMatch[]> {
    if (!API_FOOTBALL_KEY) return [];
    const leagueId = getLeagueId(league);
    try {
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            headers: { 'x-apisports-key': API_FOOTBALL_KEY },
            params: { league: leagueId, season: inferSeason(), next: limit, status: 'NS' }
        });
        return response.data.response.map((f: any) => ({
            homeTeam: f.teams.home.name.toUpperCase(),
            awayTeam: f.teams.away.name.toUpperCase(),
            homeLogo: f.teams.home.logo,
            awayLogo: f.teams.away.logo,
            kickoff: f.fixture.date,
            league: league,
            fixtureId: f.fixture.id,
        }));
    } catch (err) {
        console.warn(`[FreeData] Failed to fetch upcoming fixtures for ${league}:`, err);
        return [];
    }
}

export async function getHistoricalFixtures(league: string, limit: number = 50): Promise<HistoricalMatch[]> {
    if (!API_FOOTBALL_KEY) return [];
    const leagueId = getLeagueId(league);
    try {
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            headers: { 'x-apisports-key': API_FOOTBALL_KEY },
            params: { league: leagueId, season: inferSeason(), last: limit, status: 'FT' }
        });

        const fixtures = response.data.response;
        const results = [];

        for (const f of fixtures) {
            const homeId = f.teams.home.id;
            const awayId = f.teams.away.id;
            
            // Join with historical odds
            const histOdds = await oddsApi.fetchHistoricalOdds(f.fixture.id.toString());
            
            results.push({
                home: f.teams.home.name.toUpperCase(),
                away: f.teams.away.name.toUpperCase(),
                homeId,
                awayId,
                homeGoals: f.goals.home,
                awayGoals: f.goals.away,
                league,
                date: f.fixture.date.split('T')[0],
                takenPrices: {
                    over15: histOdds.over15?.bestPrice,
                    under35: histOdds.under35?.bestPrice
                },
                closingPrices: {
                    over15: histOdds.over15?.bestPrice, // In practice these would be different
                    under35: histOdds.under35?.bestPrice
                },
                takenAt: histOdds.takenAt,
                closedAt: histOdds.closedAt
            });
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
