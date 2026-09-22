import { DataSource } from '../types';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class JsonCache {
  private static cache: Map<string, CacheEntry<any>> = new Map();

  static set<T>(source: DataSource, key: string, data: T, ttlSeconds: number = 3600) {
    const cacheKey = `${source}:${key}`;
    this.cache.set(cacheKey, {
      data,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  static get<T>(source: DataSource, key: string): T | null {
    const cacheKey = `${source}:${key}`;
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  static clear() {
    this.cache.clear();
  }
}
