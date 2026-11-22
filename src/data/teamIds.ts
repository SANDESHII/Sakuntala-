import { TEAM_STATS } from '../core/constants';
import { TeamIdentity, TeamOption } from '../types';

const TEAM_ALIASES: Record<string, string> = {
  'MANCHESTER CITY': 'MAN_CITY',
  'MAN CITY': 'MAN_CITY',
  'MANCHESTER UNITED': 'MAN_UTD',
  'MAN UNITED': 'MAN_UTD',
  'MAN UTD': 'MAN_UTD',
  'NOTTM FOREST': 'NOTTINGHAM_FOREST',
  'NOTTINGHAM FOREST': 'NOTTINGHAM_FOREST',
  'LEEDS UNITED': 'LEEDS',
  'SHEFFIELD UTD': 'SHEFFIELD_UNITED',
  'SHEFFIELD UNITED': 'SHEFFIELD_UNITED',
  'WEST BROMWICH ALBION': 'WEST_BROM',
  'ATHLETIC CLUB': 'ATHLETIC_BILBAO',
  'ATHLETIC BILBAO': 'ATHLETIC_BILBAO',
  'ATH BILBAO': 'ATHLETIC_BILBAO',
  'ATH MADRID': 'ATLETICO',
  'ATLETICO MADRID': 'ATLETICO',
  'CELTA': 'CELTA_VIGO',
  'SOCIEDAD': 'REAL_SOCIEDAD',
  'VALLECANO': 'RAYO_VALLECANO',
  'RAYO VALLECANO': 'RAYO_VALLECANO',
  'ESPANOL': 'ESPANYOL',
  'SPURS': 'TOTTENHAM',
  'TOTTENHAM HOTSPUR': 'TOTTENHAM',
  'PSG': 'PSG',
  'PARIS SG': 'PSG',
  'PARIS SAINT GERMAIN': 'PSG',
  'SAINT ETIENNE': 'ST_ETIENNE',
  'SAINT-ETIENNE': 'ST_ETIENNE',
  'CLERMONT FOOT': 'CLERMONT',
  'BRIGHTON & HOVE ALBION': 'BRIGHTON',
  'BRIGHTON AND HOVE ALBION': 'BRIGHTON',
  'BRIGHTON HOVE ALBION': 'BRIGHTON',
  'WOLVERHAMPTON WANDERERS': 'WOLVES',
  'WEST HAM UNITED': 'WEST_HAM',
  'NEWCASTLE UNITED': 'NEWCASTLE',
  'AFC BOURNEMOUTH': 'BOURNEMOUTH',
  'REAL BETIS': 'BETIS',
  'REAL SOCIEDAD': 'REAL_SOCIEDAD',
  'BAYERN MUNICH': 'BAYERN',
  'BORUSSIA DORTMUND': 'DORTMUND',
  'RB LEIPZIG': 'RB_LEIPZIG',
  'BAYER LEVERKUSEN': 'LEVERKUSEN',
  'BORUSSIA MONCHENGLADBACH': 'GLADBACH',
  'MGLADBACH': 'GLADBACH',
  'MONCHENGLADBACH': 'GLADBACH',
  'EIN FRANKFURT': 'FRANKFURT',
  'EINTRACHT FRANKFURT': 'FRANKFURT',
  'FC KOLN': 'KOLN',
  '1 FC KOLN': 'KOLN',
  'AC MILAN': 'MILAN',
  'INTER MILAN': 'INTER',
  'AS ROMA': 'ROMA',
  'HELLAS VERONA': 'VERONA',
  'ASTON VILLA': 'ASTON_VILLA',
  'CRYSTAL PALACE': 'CRYSTAL_PALACE',
  'LAS PALMAS': 'LAS_PALMAS',
  'UNION BERLIN': 'UNION_BERLIN',
  'LE HAVRE': 'LE_HAVRE',
};

export const LEAGUE_TEAMS: Record<string, string[]> = {
  EPL: [
    'ARSENAL', 'ASTON_VILLA', 'BOURNEMOUTH', 'BRENTFORD', 'BRIGHTON',
    'CHELSEA', 'CRYSTAL_PALACE', 'EVERTON', 'FULHAM', 'LIVERPOOL',
    'MAN_CITY', 'MAN_UTD', 'NEWCASTLE', 'NOTTINGHAM_FOREST', 'TOTTENHAM',
    'WEST_HAM', 'WOLVES',
  ],
  LA_LIGA: [
    'ALAVES', 'ATHLETIC_BILBAO', 'ATLETICO', 'BARCELONA', 'BETIS',
    'CELTA_VIGO', 'ESPANYOL', 'GETAFE', 'GIRONA', 'LAS_PALMAS',
    'MALLORCA', 'OSASUNA', 'RAYO_VALLECANO', 'REAL_MADRID', 'REAL_SOCIEDAD',
    'SEVILLA', 'VALENCIA', 'VILLARREAL',
  ],
  BUNDESLIGA: [
    'AUGSBURG', 'BAYERN', 'BOCHUM', 'DORTMUND', 'FRANKFURT',
    'FREIBURG', 'GLADBACH', 'HOFFENHEIM', 'KOLN', 'LEVERKUSEN',
    'MAINZ', 'RB_LEIPZIG', 'STUTTGART', 'UNION_BERLIN', 'WOLFSBURG',
  ],
  SERIE_A: [
    'ATALANTA', 'BOLOGNA', 'CAGLIARI', 'EMPOLI', 'FIORENTINA',
    'GENOA', 'INTER', 'JUVENTUS', 'LAZIO', 'LECCE',
    'MILAN', 'MONZA', 'NAPOLI', 'ROMA', 'SASSUOLO',
    'TORINO', 'UDINESE', 'VERONA',
  ],
  LIGUE_1: [
    'BREST', 'CLERMONT', 'LE_HAVRE', 'LENS', 'LILLE',
    'LORIENT', 'LYON', 'MARSEILLE', 'METZ', 'MONACO',
    'MONTPELLIER', 'NANTES', 'NICE', 'PSG', 'REIMS',
    'RENNES', 'STRASBOURG', 'TOULOUSE',
  ],
};

const TEAM_API_FOOTBALL_IDS: Record<string, number> = {
  'ARSENAL': 42,
  'MAN_CITY': 50,
  'LIVERPOOL': 40,
  'CHELSEA': 49,
  'TOTTENHAM': 47,
  'MAN_UTD': 33,
  'NEWCASTLE': 34,
  'ASTON_VILLA': 66,
  'BRIGHTON': 51,
  'WEST_HAM': 48,
  'BRENTFORD': 55,
  'CRYSTAL_PALACE': 52,
  'EVERTON': 45,
  'FULHAM': 36,
  'WOLVES': 38,
  'BOURNEMOUTH': 35,
  'NOTTINGHAM_FOREST': 65,
  'REAL_MADRID': 541,
  'BARCELONA': 529,
  'ATLETICO': 530,
  'SEVILLA': 536,
  'REAL_SOCIEDAD': 548,
  'VILLARREAL': 533,
  'ATHLETIC_BILBAO': 531,
  'BETIS': 543,
  'VALENCIA': 532,
  'GETAFE': 546,
  'CELTA_VIGO': 538,
  'GIRONA': 547,
  'OSASUNA': 542,
  'LAS_PALMAS': 537,
  'MALLORCA': 545,
  'ALAVES': 544,
  'CADIZ': 534,
  'GRANADA': 535,
  'ALMERIA': 540,
  'BAYERN': 157,
  'DORTMUND': 165,
  'LEVERKUSEN': 168,
  'RB_LEIPZIG': 173,
  'STUTTGART': 172,
  'FRANKFURT': 169,
  'WOLFSBURG': 161,
  'GLADBACH': 163,
  'FREIBURG': 160,
  'HOFFENHEIM': 167,
  'UNION_BERLIN': 182,
  'BOCHUM': 176,
  'AUGSBURG': 170,
  'MAINZ': 164,
  'INTER': 505,
  'MILAN': 489,
  'JUVENTUS': 496,
  'NAPOLI': 492,
  'ROMA': 497,
  'LAZIO': 487,
  'ATALANTA': 499,
  'FIORENTINA': 502,
  'BOLOGNA': 500,
  'TORINO': 503,
  'MONZA': 1579,
  'UDINESE': 494,
  'SASSUOLO': 488,
  'EMPOLI': 511,
  'CAGLIARI': 490,
  'GENOA': 495,
  'VERONA': 504,
  'LECCE': 867,
  'SALERNITANA': 514,
  'FROSINONE': 512,
  'PSG': 85,
  'MARSEILLE': 81,
  'MONACO': 91,
  'LYON': 80,
  'LILLE': 79,
  'RENNES': 94,
  'NICE': 84,
  'LENS': 116,
  'STRASBOURG': 95,
  'TOULOUSE': 96,
  'MONTPELLIER': 82,
  'NANTES': 83,
  'REIMS': 93,
  'BREST': 106,
  'LORIENT': 97,
  'CLERMONT': 115,
  'METZ': 112,
  'LE_HAVRE': 111,
};

const DISPLAY_OVERRIDES: Record<string, string> = {
  PSG: 'Paris Saint-Germain',
  RB_LEIPZIG: 'RB Leipzig',
  MAN_CITY: 'Man City',
  MAN_UTD: 'Man Utd',
  ST_ETIENNE: 'Saint-Etienne',
};

export function formatTeamName(canonicalId: string): string {
  const upper = canonicalId.toUpperCase().trim();
  if (DISPLAY_OVERRIDES[upper]) return DISPLAY_OVERRIDES[upper];
  return upper
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function getTeamsForLeague(league: string): TeamOption[] {
  const leagueKey = league.toUpperCase().replace(/ /g, '_');
  const ids = LEAGUE_TEAMS[leagueKey] || [];
  return ids.map((id) => ({
    id,
    displayName: formatTeamName(id),
    league: leagueKey,
  }));
}

const apiFootballReverseMap = new Map<number, string>();
for (const [canonicalId, apiFootballId] of Object.entries(TEAM_API_FOOTBALL_IDS)) {
  apiFootballReverseMap.set(apiFootballId, canonicalId);
}

export function resolveByApiFootballId(id: number): TeamIdentity {
  const canonicalId = apiFootballReverseMap.get(id);
  if (!canonicalId) return { id: String(id) };
  return { id: canonicalId, apiFootballId: id };
}

const resolveTeamCache = new Map<string, TeamIdentity>();

export function resolveTeam(name: string): TeamIdentity {
  const cached = resolveTeamCache.get(name);
  if (cached) return cached;

  const normalized = name.toUpperCase()
    .trim()
    .replace(/[.&]/g, ' ')
    .replace(/[']/g, '')
    .replace(/\s+/g, ' ');

  const underscoreName = normalized.replace(/ /g, '_');

  let result: TeamIdentity;
  if (TEAM_STATS[underscoreName] || TEAM_API_FOOTBALL_IDS[underscoreName]) {
    result = { id: underscoreName, apiFootballId: TEAM_API_FOOTBALL_IDS[underscoreName] };
  } else {
    const aliasCanonical = TEAM_ALIASES[normalized];
    result = aliasCanonical
      ? { id: aliasCanonical, apiFootballId: TEAM_API_FOOTBALL_IDS[aliasCanonical] }
      : { id: underscoreName };
  }

  resolveTeamCache.set(name, result);
  return result;
}
