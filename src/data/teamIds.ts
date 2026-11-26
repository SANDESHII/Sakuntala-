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
  'LAS PALMAS': 'LAS_PALMAS',
  'LEICESTER CITY': 'LEICESTER',
  'IPSWICH TOWN': 'IPSWICH',
  'LUTON TOWN': 'LUTON',
  'DEPORTIVO ALAVES': 'ALAVES',
  'REAL VALLADOLID': 'VALLADOLID',
  'REAL OVIEDO': 'OVIEDO',
  'BAYERN MUNCHEN': 'BAYERN',
  'SV WERDER BREMEN': 'WERDER_BREMEN',
  'FC HEIDENHEIM': 'HEIDENHEIM',
  '1 FC HEIDENHEIM': 'HEIDENHEIM',
  'ST PAULI': 'ST_PAULI',
  'FC ST PAULI': 'ST_PAULI',
  'KIEL': 'HOLSTEIN_KIEL',
  'HAMBURG': 'HAMBURGER_SV',
  'AJ AUXERRE': 'AUXERRE',
  'ANGERS SCO': 'ANGERS',
  'STADE BRESTOIS': 'BREST',
  'STADE BRESTOIS 29': 'BREST',
  'OLYMPIQUE LYONNAIS': 'LYON',
  'OLYMPIQUE DE MARSEILLE': 'MARSEILLE',
  'AS MONACO': 'MONACO',
  'RC LENS': 'LENS',
  'OGC NICE': 'NICE',
  'LOSC LILLE': 'LILLE',
  'STADE RENNAIS': 'RENNES',
  'RC STRASBOURG': 'STRASBOURG',
  'RC STRASBOURG ALSACE': 'STRASBOURG',
  'COVENTRY CITY': 'COVENTRY',
  'HULL CITY': 'HULL',
  'SUNDERLAND AFC': 'SUNDERLAND',
  'BURNLEY FC': 'BURNLEY',
  'DEPORTIVO LA CORUNA': 'LA_CORUNA',
  'RC DEPORTIVO LA CORUNA': 'LA_CORUNA',
  'RACING SANTANDER': 'SANTANDER',
  'REAL RACING CLUB': 'SANTANDER',
  'MALAGA CF': 'MALAGA',
  'FC SCHALKE 04': 'SCHALKE_04',
  'SCHALKE': 'SCHALKE_04',
  'SC PADERBORN': 'PADERBORN',
  'SC PADERBORN 07': 'PADERBORN',
  'SV ELVERSBERG': 'ELVERSBERG',
  'FROSINONE CALCIO': 'FROSINONE',
  'ESTAC TROYES': 'TROYES',
  'LE MANS FC': 'LE_MANS',
  'TSG HOFFENHEIM': 'HOFFENHEIM',
  '1 FSV MAINZ 05': 'MAINZ',
  'FSV MAINZ 05': 'MAINZ',
  'FC AUGSBURG': 'AUGSBURG',
  'VFL WOLFSBURG': 'WOLFSBURG',
  'SC FREIBURG': 'FREIBURG',
  'VFB STUTTGART': 'STUTTGART',
  '1 FC UNION BERLIN': 'UNION_BERLIN',
  'COMO 1907': 'COMO',
  'PARMA CALCIO': 'PARMA',
  'PARMA CALCIO 1913': 'PARMA',
  'VENEZIA FC': 'VENEZIA',
  'US CREMONESE': 'CREMONESE',
  'PISA SC': 'PISA',
  'ELCHE CF': 'ELCHE',
  'LEVANTE UD': 'LEVANTE',
  'RCD ESPANYOL': 'ESPANYOL',
  'RC CELTA DE VIGO': 'CELTA_VIGO',
  'VILLARREAL CF': 'VILLARREAL',
  'GETAFE CF': 'GETAFE',
  'CD LEGANES': 'LEGANES',
};

export const LEAGUE_TEAMS: Record<string, string[]> = {
  EPL: [
    'ARSENAL', 'ASTON_VILLA', 'BOURNEMOUTH', 'BRENTFORD', 'BRIGHTON',
    'BURNLEY', 'CHELSEA', 'COVENTRY', 'CRYSTAL_PALACE', 'EVERTON',
    'FULHAM', 'HULL', 'IPSWICH', 'LEEDS', 'LEICESTER',
    'LIVERPOOL', 'MAN_CITY', 'MAN_UTD', 'NEWCASTLE', 'NOTTINGHAM_FOREST',
    'SOUTHAMPTON', 'SUNDERLAND', 'TOTTENHAM', 'WEST_HAM', 'WOLVES',
  ],
  LA_LIGA: [
    'ALAVES', 'ATHLETIC_BILBAO', 'ATLETICO', 'BARCELONA', 'BETIS',
    'CELTA_VIGO', 'ELCHE', 'ESPANYOL', 'GETAFE', 'GIRONA',
    'LA_CORUNA', 'LAS_PALMAS', 'LEGANES', 'LEVANTE', 'MALAGA',
    'MALLORCA', 'OSASUNA', 'OVIEDO', 'RAYO_VALLECANO', 'REAL_MADRID',
    'REAL_SOCIEDAD', 'SANTANDER', 'SEVILLA', 'VALENCIA', 'VALLADOLID',
    'VILLARREAL',
  ],
  BUNDESLIGA: [
    'AUGSBURG', 'BAYERN', 'BOCHUM', 'DORTMUND', 'ELVERSBERG',
    'FRANKFURT', 'FREIBURG', 'GLADBACH', 'HAMBURGER_SV', 'HEIDENHEIM',
    'HOFFENHEIM', 'HOLSTEIN_KIEL', 'KOLN', 'LEVERKUSEN', 'MAINZ',
    'PADERBORN', 'RB_LEIPZIG', 'SCHALKE_04', 'ST_PAULI', 'STUTTGART',
    'UNION_BERLIN', 'WERDER_BREMEN', 'WOLFSBURG',
  ],
  SERIE_A: [
    'ATALANTA', 'BOLOGNA', 'CAGLIARI', 'COMO', 'CREMONESE',
    'EMPOLI', 'FIORENTINA', 'FROSINONE', 'GENOA', 'INTER',
    'JUVENTUS', 'LAZIO', 'LECCE', 'MILAN', 'MONZA',
    'NAPOLI', 'PARMA', 'PISA', 'ROMA', 'SASSUOLO',
    'TORINO', 'UDINESE', 'VENEZIA', 'VERONA',
  ],
  LIGUE_1: [
    'ANGERS', 'AUXERRE', 'BREST', 'CLERMONT', 'LE_HAVRE',
    'LE_MANS', 'LENS', 'LILLE', 'LORIENT', 'LYON',
    'MARSEILLE', 'METZ', 'MONACO', 'MONTPELLIER', 'NANTES',
    'NICE', 'PARIS_FC', 'PSG', 'REIMS', 'RENNES',
    'ST_ETIENNE', 'STRASBOURG', 'TOULOUSE', 'TROYES',
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

export function resolveByApiFootballId(id: number, fallbackName?: string): TeamIdentity {
  const canonicalId = apiFootballReverseMap.get(id);
  if (canonicalId) return { id: canonicalId, apiFootballId: id };
  if (fallbackName) {
    const resolved = resolveTeam(fallbackName);
    return { id: resolved.id, apiFootballId: id };
  }
  return { id: String(id) };
}

const resolveTeamCache = new Map<string, TeamIdentity>();

export function resolveTeam(name: string): TeamIdentity {
  const cached = resolveTeamCache.get(name);
  if (cached) return cached;

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[.&-]/g, ' ')
    .replace(/['’]/g, '')
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
