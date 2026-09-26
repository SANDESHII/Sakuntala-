import { TeamIdentity, DataGapError } from '../../types';
import { TEAM_STATS, TEAM_ALIASES } from '../../core/constants';

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

function updateExternalIds(id: string, externalIds: TeamIdentity['externalIds']) {
  const identity = registry.get(id);
  if (identity) {
    identity.externalIds = { ...identity.externalIds, ...externalIds };
    if (externalIds.apiFootball) idMaps.apiFootball.set(externalIds.apiFootball, id);
    if (externalIds.theOddsApi) idMaps.theOddsApi.set(externalIds.theOddsApi, id);
  }
}

// Initialize
Object.keys(TEAM_STATS).forEach(canonicalName => {
  add({
    id: canonicalName,
    name: canonicalName,
    aliases: Object.entries(TEAM_ALIASES)
      .filter(([_, canonical]) => canonical === canonicalName)
      .map(([alias, _]) => alias),
    externalIds: {}
  });
});

updateExternalIds('ARSENAL', { apiFootball: 42, theOddsApi: 'Arsenal' });
updateExternalIds('MAN_CITY', { apiFootball: 50, theOddsApi: 'Manchester City' });
updateExternalIds('LIVERPOOL', { apiFootball: 40, theOddsApi: 'Liverpool' });
updateExternalIds('CHELSEA', { apiFootball: 49, theOddsApi: 'Chelsea' });
updateExternalIds('TOTTENHAM', { apiFootball: 47, theOddsApi: 'Tottenham' });
updateExternalIds('MAN_UTD', { apiFootball: 33, theOddsApi: 'Manchester United' });

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

    throw new DataGapError('Team Identity', `Name: ${name}`);
  }
};
