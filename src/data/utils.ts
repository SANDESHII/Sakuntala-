export function inferSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 6=July)
  const year = now.getFullYear();
  // If we're before July, the season started in the previous year
  return month < 6 ? year - 1 : year;
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
