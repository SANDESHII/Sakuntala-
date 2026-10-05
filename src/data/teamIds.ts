import { TEAM_STATS } from '../core/constants';
import { TeamIdentity } from '../types';

export const TEAM_ALIASES: Record<string, string> = {
  'MANCHESTER CITY': 'MAN_CITY',
  'MAN CITY': 'MAN_CITY',
  'MANCHESTER UNITED': 'MAN_UTD',
  'MAN UTD': 'MAN_UTD',
  'ATHLETIC CLUB': 'ATHLETIC_BILBAO',
  'SPURS': 'TOTTENHAM',
  'PSG': 'PSG',
  'PARIS SG': 'PSG',
};

export const TEAM_IDS: Record<string, { apiFootball: number; theOddsApi: string }> = {
  'ARSENAL': { apiFootball: 42, theOddsApi: 'Arsenal' },
  'MAN_CITY': { apiFootball: 50, theOddsApi: 'Manchester City' },
  'LIVERPOOL': { apiFootball: 40, theOddsApi: 'Liverpool' },
  'CHELSEA': { apiFootball: 49, theOddsApi: 'Chelsea' },
  'TOTTENHAM': { apiFootball: 47, theOddsApi: 'Tottenham Hotspur' },
  'MAN_UTD': { apiFootball: 33, theOddsApi: 'Manchester United' },
  'NEWCASTLE': { apiFootball: 34, theOddsApi: 'Newcastle United' },
  'ASTON_VILLA': { apiFootball: 66, theOddsApi: 'Aston Villa' },
  'BRIGHTON': { apiFootball: 51, theOddsApi: 'Brighton and Hove Albion' },
  'WEST_HAM': { apiFootball: 48, theOddsApi: 'West Ham United' },
  'BRENTFORD': { apiFootball: 55, theOddsApi: 'Brentford' },
  'CRYSTAL_PALACE': { apiFootball: 52, theOddsApi: 'Crystal Palace' },
  'EVERTON': { apiFootball: 45, theOddsApi: 'Everton' },
  'FULHAM': { apiFootball: 36, theOddsApi: 'Fulham' },
  'WOLVES': { apiFootball: 38, theOddsApi: 'Wolverhampton Wanderers' },
  'BOURNEMOUTH': { apiFootball: 35, theOddsApi: 'AFC Bournemouth' },
  'NOTTINGHAM_FOREST': { apiFootball: 65, theOddsApi: 'Nottingham Forest' },
  'REAL_MADRID': { apiFootball: 541, theOddsApi: 'Real Madrid' },
  'BARCELONA': { apiFootball: 529, theOddsApi: 'Barcelona' },
  'ATLETICO': { apiFootball: 530, theOddsApi: 'Atletico Madrid' },
  'SEVILLA': { apiFootball: 536, theOddsApi: 'Sevilla' },
  'REAL_SOCIEDAD': { apiFootball: 548, theOddsApi: 'Real Sociedad' },
  'VILLARREAL': { apiFootball: 533, theOddsApi: 'Villarreal' },
  'ATHLETIC_BILBAO': { apiFootball: 531, theOddsApi: 'Athletic Bilbao' },
  'BETIS': { apiFootball: 543, theOddsApi: 'Real Betis' },
  'VALENCIA': { apiFootball: 532, theOddsApi: 'Valencia' },
  'GETAFE': { apiFootball: 546, theOddsApi: 'Getafe' },
  'CELTA_VIGO': { apiFootball: 538, theOddsApi: 'Celta Vigo' },
  'GIRONA': { apiFootball: 547, theOddsApi: 'Girona' },
  'OSASUNA': { apiFootball: 542, theOddsApi: 'Osasuna' },
  'LAS_PALMAS': { apiFootball: 537, theOddsApi: 'Las Palmas' },
  'MALLORCA': { apiFootball: 545, theOddsApi: 'Mallorca' },
  'ALAVES': { apiFootball: 544, theOddsApi: 'Alaves' },
  'CADIZ': { apiFootball: 534, theOddsApi: 'Cadiz' },
  'GRANADA': { apiFootball: 535, theOddsApi: 'Granada' },
  'ALMERIA': { apiFootball: 540, theOddsApi: 'Almeris' },
  'BAYERN': { apiFootball: 157, theOddsApi: 'Bayern Munich' },
  'DORTMUND': { apiFootball: 165, theOddsApi: 'Borussia Dortmund' },
  'LEVERKUSEN': { apiFootball: 168, theOddsApi: 'Bayer Leverkusen' },
  'RB_LEIPZIG': { apiFootball: 173, theOddsApi: 'RB Leipzig' },
  'STUTTGART': { apiFootball: 172, theOddsApi: 'VfB Stuttgart' },
  'FRANKFURT': { apiFootball: 169, theOddsApi: 'Eintracht Frankfurt' },
  'WOLFSBURG': { apiFootball: 161, theOddsApi: 'VfL Wolfsburg' },
  'GLADBACH': { apiFootball: 163, theOddsApi: 'Borussia Monchengladbach' },
  'FREIBURG': { apiFootball: 160, theOddsApi: 'SC Freiburg' },
  'HOFFENHEIM': { apiFootball: 167, theOddsApi: 'TSG 1899 Hoffenheim' },
  'UNION_BERLIN': { apiFootball: 182, theOddsApi: 'Union Berlin' },
  'BOCHUM': { apiFootball: 176, theOddsApi: 'VfL Bochum' },
  'AUGSBURG': { apiFootball: 170, theOddsApi: 'FC Augsburg' },
  'MAINZ': { apiFootball: 164, theOddsApi: 'FSV Mainz 05' },
  'INTER': { apiFootball: 505, theOddsApi: 'Inter Milan' },
  'MILAN': { apiFootball: 489, theOddsApi: 'AC Milan' },
  'JUVENTUS': { apiFootball: 496, theOddsApi: 'Juventus' },
  'NAPOLI': { apiFootball: 492, theOddsApi: 'Napoli' },
  'ROMA': { apiFootball: 497, theOddsApi: 'AS Roma' },
  'LAZIO': { apiFootball: 487, theOddsApi: 'Lazio' },
  'ATALANTA': { apiFootball: 499, theOddsApi: 'Atalanta' },
  'FIORENTINA': { apiFootball: 502, theOddsApi: 'Fiorentina' },
  'BOLOGNA': { apiFootball: 500, theOddsApi: 'Bologna' },
  'TORINO': { apiFootball: 503, theOddsApi: 'Torino' },
  'MONZA': { apiFootball: 1579, theOddsApi: 'Monza' },
  'UDINESE': { apiFootball: 494, theOddsApi: 'Udinese' },
  'SASSUOLO': { apiFootball: 488, theOddsApi: 'Sassuolo' },
  'EMPOLI': { apiFootball: 511, theOddsApi: 'Empoli' },
  'CAGLIARI': { apiFootball: 490, theOddsApi: 'Cagliari' },
  'GENOA': { apiFootball: 495, theOddsApi: 'Genoa' },
  'VERONA': { apiFootball: 504, theOddsApi: 'Hellas Verona' },
  'LECCE': { apiFootball: 867, theOddsApi: 'Lecce' },
  'SALERNITANA': { apiFootball: 514, theOddsApi: 'Salernitana' },
  'FROSINONE': { apiFootball: 512, theOddsApi: 'Frosinone' },
  'PSG': { apiFootball: 85, theOddsApi: 'Paris Saint Germain' },
  'MARSEILLE': { apiFootball: 81, theOddsApi: 'Olympique Marseille' },
  'MONACO': { apiFootball: 91, theOddsApi: 'Monaco' },
  'LYON': { apiFootball: 80, theOddsApi: 'Olympique Lyonnais' },
  'LILLE': { apiFootball: 79, theOddsApi: 'Lille' },
  'RENNES': { apiFootball: 94, theOddsApi: 'Stade Rennais' },
  'NICE': { apiFootball: 84, theOddsApi: 'Nice' },
  'LENS': { apiFootball: 116, theOddsApi: 'Lens' },
  'STRASBOURG': { apiFootball: 95, theOddsApi: 'Strasbourg' },
  'TOULOUSE': { apiFootball: 96, theOddsApi: 'Toulouse' },
  'MONTPELLIER': { apiFootball: 82, theOddsApi: 'Montpellier' },
  'NANTES': { apiFootball: 83, theOddsApi: 'Nantes' },
  'REIMS': { apiFootball: 93, theOddsApi: 'Stade de Reims' },
  'BREST': { apiFootball: 106, theOddsApi: 'Stade Brestois 29' },
  'LORIENT': { apiFootball: 97, theOddsApi: 'Lorient' },
  'CLERMONT': { apiFootball: 115, theOddsApi: 'Clermont Foot' },
  'METZ': { apiFootball: 112, theOddsApi: 'Metz' },
  'LE_HAVRE': { apiFootball: 111, theOddsApi: 'Le Havre' },
};

const idMaps = {
  apiFootball: new Map<number, string>(),
  theOddsApi: new Map<string, string>()
};

// Initialize reverse maps
Object.entries(TEAM_IDS).forEach(([name, ids]) => {
  idMaps.apiFootball.set(ids.apiFootball, name);
  idMaps.theOddsApi.set(ids.theOddsApi, name);
});

export function resolveById(source: 'apiFootball' | 'theOddsApi', id: string | number): TeamIdentity {
  let canonicalId: string | undefined;
  if (source === 'apiFootball') canonicalId = idMaps.apiFootball.get(id as number);
  if (source === 'theOddsApi') canonicalId = idMaps.theOddsApi.get(id as string);

  if (!canonicalId) {
    return { id: String(id), name: String(id), league: 'UNKNOWN', country: 'UNKNOWN', externalIds: {} };
  }
  
  return {
    id: canonicalId,
    name: canonicalId,
    league: 'ELITE',
    country: 'EUROPE',
    externalIds: {
      apiFootball: TEAM_IDS[canonicalId].apiFootball,
      theOddsApi: TEAM_IDS[canonicalId].theOddsApi
    }
  };
}

export function resolveTeam(name: string): TeamIdentity {
  const normalized = name.toUpperCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
  const underscoreName = normalized.replace(/ /g, '_');
  
  if (TEAM_STATS[underscoreName] || TEAM_IDS[underscoreName]) {
    const canonical = underscoreName;
    return {
      id: canonical,
      name: canonical,
      league: 'ELITE',
      country: 'EUROPE',
      externalIds: TEAM_IDS[canonical] || {}
    };
  }
  
  const aliasCanonical = TEAM_ALIASES[normalized];
  if (aliasCanonical) {
     return {
      id: aliasCanonical,
      name: aliasCanonical,
      league: 'ELITE',
      country: 'EUROPE',
      externalIds: TEAM_IDS[aliasCanonical] || {}
    };
  }

  return {
    id: underscoreName,
    name: normalized,
    league: 'UNKNOWN',
    country: 'UNKNOWN',
    externalIds: {}
  };
}
