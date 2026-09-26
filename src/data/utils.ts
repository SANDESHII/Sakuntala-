export function inferSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 6=July)
  const year = now.getFullYear();
  // If we're before July, the season started in the previous year
  return month < 6 ? year - 1 : year;
}

export function normalizeLeagueToId(league: string): number {
  const map: Record<string, number> = {
    'EPL': 39,
    'LA_LIGA': 140,
    'BUNDESLIGA': 78,
    'SERIE_A': 135,
    'LIGUE_1': 61
  };
  return map[league.toUpperCase()] || 39;
}

export function getOddsSportKey(league: string): string {
  const map: Record<string, string> = {
    'EPL': 'soccer_epl',
    'LA_LIGA': 'soccer_spain_la_liga',
    'BUNDESLIGA': 'soccer_germany_bundesliga',
    'SERIE_A': 'soccer_italy_serie_a',
    'LIGUE_1': 'soccer_france_ligue_one'
  };
  return map[league.toUpperCase()] || 'soccer_epl';
}
