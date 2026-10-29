import { SEASON_START_MONTH, LEAGUE_MAP } from '../core/constants';

export function inferSeason(league: string = 'EPL'): number {
  const month = new Date().getMonth();
  const year = new Date().getFullYear();
  const startMonth = SEASON_START_MONTH[league.toUpperCase()] || 7;
  return month < startMonth ? year - 1 : year;
}

export function getLeagueConfig(league: string) {
  const normalized = league.toUpperCase().trim();
  if (normalized.includes('PREMIER') || normalized === 'EPL') return LEAGUE_MAP.EPL;
  if (normalized.includes('LIGA') || normalized === 'LA_LIGA') return LEAGUE_MAP.LA_LIGA;
  if (normalized.includes('BUNDES') || normalized === 'BUNDESLIGA') return LEAGUE_MAP.BUNDESLIGA;
  if (normalized.includes('SERIE') || normalized === 'SERIE_A') return LEAGUE_MAP.SERIE_A;
  if (normalized.includes('LIGUE') || normalized === 'LIGUE_1') return LEAGUE_MAP.LIGUE_1;
  return LEAGUE_MAP[normalized] || LEAGUE_MAP.EPL;
}
