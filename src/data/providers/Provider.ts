import { DataSource, Provenance } from '../types';

export interface Provider {
  readonly source: DataSource;
  getProvenance(quality: Provenance['quality'], season?: string | number): Provenance;
}

export abstract class BaseProvider implements Provider {
  constructor(public readonly source: DataSource) {}

  getProvenance(quality: Provenance['quality'], season?: string | number): Provenance {
    return {
      source: this.source,
      sourceSeason: season,
      fetchedAt: new Date().toISOString(),
      quality
    };
  }
}
