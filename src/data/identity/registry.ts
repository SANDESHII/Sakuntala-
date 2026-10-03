import { TeamIdentity, DataGapError } from '../../types';
import { TEAM_STATS, TEAM_ALIASES } from '../../core/constants';
import { API_FOOTBALL_MAPPINGS, THE_ODDS_API_MAPPINGS } from './mappings';

const registry = new Map<string, TeamIdentity>();
const idMaps = {
  apiFootball: new Map<number, string>(),
  theOddsApi: new Map<string, string>()
};

function add(identity: TeamIdentity) {
  registry.set(identity.id, identity);
  if (identity.externalIds.apiFootball) idMaps.apiFootball.set(identity.externalIds.apiFootball, identity.id);
  if (identity.externalIds.theOddsApi) idMaps.theOddsApi.set(identity.externalIds.theOddsApi, identity.id);
}

// Initialize
const allTeams = new Set([
  ...Object.keys(TEAM_STATS),
  ...Object.keys(API_FOOTBALL_MAPPINGS),
  ...Object.keys(THE_ODDS_API_MAPPINGS)
]);

allTeams.forEach(canonicalName => {
  add({
    id: canonicalName,
    name: canonicalName,
    league: 'ELITE',
    country: 'EUROPE',
    aliases: Object.entries(TEAM_ALIASES)
      .filter(([_, canonical]) => canonical === canonicalName)
      .map(([alias, _]) => alias),
    externalIds: {
      apiFootball: API_FOOTBALL_MAPPINGS[canonicalName],
      theOddsApi: THE_ODDS_API_MAPPINGS[canonicalName]
    }
  });
});

export const TeamRegistry = {
  resolveById(source: keyof TeamIdentity['externalIds'], id: string | number): TeamIdentity {
    let canonicalId: string | undefined;
    if (source === 'apiFootball') canonicalId = idMaps.apiFootball.get(id as number);
    if (source === 'theOddsApi') canonicalId = idMaps.theOddsApi.get(id as string);

    if (!canonicalId) throw new DataGapError('Team Identity', `${source} ID: ${id}`);
    return registry.get(canonicalId)!;
  },

  resolveByName(name: string): TeamIdentity {
    const normalized = name.toUpperCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
    if (registry.has(normalized)) return registry.get(normalized)!;
    if (registry.has(normalized.replace(/ /g, '_'))) return registry.get(normalized.replace(/ /g, '_'))!;
    
    const aliasCanonical = TEAM_ALIASES[normalized];
    if (aliasCanonical && registry.has(aliasCanonical)) return registry.get(aliasCanonical)!;

    // Fallback for unknown teams: Create a synthetic identity to avoid crashing
    return {
      id: normalized.replace(/ /g, '_'),
      name: normalized,
      league: 'UNKNOWN',
      country: 'UNKNOWN',
      externalIds: {}
    };
  }
};
