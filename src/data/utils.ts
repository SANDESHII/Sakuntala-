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
