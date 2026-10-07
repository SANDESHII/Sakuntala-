const SEASON_START_MONTH: Record<string, number> = {
  'EPL': 7, 'LA_LIGA': 7, 'BUNDESLIGA': 7, 'SERIE_A': 7, 'LIGUE_1': 7,
  'MLS': 2, 'A_LEAGUE': 9,
};

export function inferSeason(league: string = 'EPL'): number {
  const month = new Date().getMonth();
  const year = new Date().getFullYear();
  const startMonth = SEASON_START_MONTH[league.toUpperCase()] || 7;
  return month < startMonth ? year - 1 : year;
}

export const LEAGUE_MAP: Record<string, { apiId: number; oddsKey: string }> = {
  'EPL': { apiId: 39, oddsKey: 'soccer_epl' },
  'LA_LIGA': { apiId: 140, oddsKey: 'soccer_spain_la_liga' },
  'BUNDESLIGA': { apiId: 78, oddsKey: 'soccer_germany_bundesliga' },
  'SERIE_A': { apiId: 135, oddsKey: 'soccer_italy_serie_a' },
  'LIGUE_1': { apiId: 61, oddsKey: 'soccer_france_ligue_one' },
};

export function getLeagueConfig(league: string) {
  const normalized = league.toUpperCase().trim();
  if (normalized.includes('PREMIER')) return LEAGUE_MAP.EPL;
  return LEAGUE_MAP[normalized] || LEAGUE_MAP.EPL;
}
