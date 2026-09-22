import { TeamIdentity, DataGapError } from '../types';
import { TEAM_STATS, TEAM_ALIASES } from '../../core/constants';

export class TeamRegistry {
  private static registry: Map<string, TeamIdentity> = new Map();
  private static idMaps: {
    apiFootball: Map<number, string>;
    understat: Map<string, string>;
    theOddsApi: Map<string, string>;
  } = {
    apiFootball: new Map(),
    understat: new Map(),
    theOddsApi: new Map()
  };

  /**
   * Initializes the registry from hardcoded constants and existing mappings
   */
  static init() {
    // Basic initialization from existing constants
    Object.keys(TEAM_STATS).forEach(canonicalName => {
      const identity: TeamIdentity = {
        id: canonicalName,
        name: canonicalName,
        aliases: Object.entries(TEAM_ALIASES)
          .filter(([_, canonical]) => canonical === canonicalName)
          .map(([alias, _]) => alias),
        externalIds: {}
      };
      this.add(identity);
    });

    // Known static ID mappings (sample for top teams to demonstrate)
    this.updateExternalIds('ARSENAL', { apiFootball: 42, understat: '83', theOddsApi: 'Arsenal' });
    this.updateExternalIds('MAN_CITY', { apiFootball: 50, understat: '88', theOddsApi: 'Manchester City' });
    this.updateExternalIds('LIVERPOOL', { apiFootball: 40, understat: '87', theOddsApi: 'Liverpool' });
    this.updateExternalIds('CHELSEA', { apiFootball: 49, understat: '80', theOddsApi: 'Chelsea' });
    this.updateExternalIds('TOTTENHAM', { apiFootball: 47, understat: '82', theOddsApi: 'Tottenham' });
    this.updateExternalIds('MAN_UTD', { apiFootball: 33, understat: '89', theOddsApi: 'Manchester United' });
  }

  static add(identity: TeamIdentity) {
    this.registry.set(identity.id, identity);
    if (identity.externalIds.apiFootball) this.idMaps.apiFootball.set(identity.externalIds.apiFootball, identity.id);
    if (identity.externalIds.understat) this.idMaps.understat.set(identity.externalIds.understat, identity.id);
    if (identity.externalIds.theOddsApi) this.idMaps.theOddsApi.set(identity.externalIds.theOddsApi, identity.id);
  }

  static updateExternalIds(id: string, externalIds: TeamIdentity['externalIds']) {
    const identity = this.registry.get(id);
    if (identity) {
      identity.externalIds = { ...identity.externalIds, ...externalIds };
      if (externalIds.apiFootball) this.idMaps.apiFootball.set(externalIds.apiFootball, id);
      if (externalIds.understat) this.idMaps.understat.set(externalIds.understat, id);
      if (externalIds.theOddsApi) this.idMaps.theOddsApi.set(externalIds.theOddsApi, id);
    }
  }

  static resolveById(source: keyof TeamIdentity['externalIds'], id: string | number): TeamIdentity {
    let canonicalId: string | undefined;
    if (source === 'apiFootball') canonicalId = this.idMaps.apiFootball.get(id as number);
    if (source === 'understat') canonicalId = this.idMaps.understat.get(id as string);
    if (source === 'theOddsApi') canonicalId = this.idMaps.theOddsApi.get(id as string);

    if (!canonicalId) {
      throw new DataGapError('Team Identity', `${source} ID: ${id}`);
    }

    return this.registry.get(canonicalId)!;
  }

  static resolveByName(name: string): TeamIdentity {
    const normalized = name.toUpperCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
    
    // 1. Exact match
    if (this.registry.has(normalized)) return this.registry.get(normalized)!;
    if (this.registry.has(normalized.replace(/ /g, '_'))) return this.registry.get(normalized.replace(/ /g, '_'))!;

    // 2. Alias match
    const aliasCanonical = TEAM_ALIASES[normalized];
    if (aliasCanonical && this.registry.has(aliasCanonical)) return this.registry.get(aliasCanonical)!;

    throw new DataGapError('Team Identity', `Name: ${name}`);
  }
}

TeamRegistry.init();
