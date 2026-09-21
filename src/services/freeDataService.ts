import axios from 'axios';

const API_FOOTBALL_KEY = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY || '';

const getLeagueId = (league: string): number => {
    const map: Record<string, number> = { 'EPL': 39, 'LA_LIGA': 140, 'BUNDESLIGA': 78, 'SERIE_A': 135, 'LIGUE_1': 61 };
    return map[league.toUpperCase()] || 39;
};

const getOddsSportKey = (league: string): string => {
    const map: Record<string, string> = { 'EPL': 'soccer_epl', 'LA_LIGA': 'soccer_spain_la_liga', 'BUNDESLIGA': 'soccer_germany_bundesliga', 'SERIE_A': 'soccer_italy_serie_a', 'LIGUE_1': 'soccer_france_ligue_one' };
    return map[league.toUpperCase()] || 'soccer_epl';
};

export const getTeamStats = async (teamName: string, league: string) => {
    if (!API_FOOTBALL_KEY) return null;
    const leagueId = getLeagueId(league);
    try {
        const teamResponse = await axios.get('https://v3.football.api-sports.io/teams', {
            headers: { 'x-apisports-key': API_FOOTBALL_KEY },
            params: { name: teamName }
        });
        const teamId = teamResponse.data.response[0]?.team.id;
        if (!teamId) return null;
        const statsResponse = await axios.get('https://v3.football.api-sports.io/teams/statistics', {
            headers: { 'x-apisports-key': API_FOOTBALL_KEY },
            params: { team: teamId, league: leagueId, season: new Date().getFullYear() }
        });
        const stats = statsResponse.data.response;
        const played = stats.fixtures.played.total;
        if (!played) return null;

        return {
            attackStrength: (stats.goals.for.total / played) / 1.35, // Normalized
            defenseStrength: (stats.goals.against.total / played) / 1.35,
            avgGoalsScored: stats.goals.for.total / played,
            avgGoalsConceded: stats.goals.against.total / played,
            avgXG: (stats.goals.for.total / played) * 0.95,
            avgXGA: (stats.goals.against.total / played) * 1.05,
            homeBias: 0.3,
            form: stats.form.split('').slice(-5).map((r: string) => r === 'W' ? 3 : r === 'D' ? 1 : 0),
            cleanSheetRate: stats.clean_sheet.total / played,
            clinicalEdge: 1.0
        };
    } catch { return null; }
};

export const getLiveOdds = async (league: string) => {
    if (!ODDS_API_KEY) return [];
    const sportKey = getOddsSportKey(league);
    try {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`, {
            params: { apiKey: ODDS_API_KEY, regions: 'eu,uk', markets: 'totals', oddsFormat: 'decimal' }
        });
        return response.data;
    } catch { return []; }
};
