export interface CatalogCacheEntry {
  body: string;
  etag: string;
}

export interface CatalogCache {
  get(key: string): CatalogCacheEntry | undefined;
  set(key: string, body: string, etag: string): void;
  invalidate(): void;
}

/**
 * In-process catalog LRU (R09). Admin writes call invalidate so the next public read
 * misses. HTTP Cache-Control still lets browsers keep a response for 60 seconds.
 */
export function createCatalogCache(options?: {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}): CatalogCache {
  const ttlMs = options?.ttlMs ?? 60_000;
  const maxEntries = options?.maxEntries ?? 200;
  const now = options?.now ?? ((): number => Date.now());
  let generation = 0;
  const entries = new Map<string, CatalogCacheEntry & { expiresAt: number }>();

  function fullKey(key: string): string {
    return `${generation}:${key}`;
  }

  return {
    get(key: string): CatalogCacheEntry | undefined {
      const hit = entries.get(fullKey(key));
      if (!hit) {
        return undefined;
      }
      if (hit.expiresAt <= now()) {
        entries.delete(fullKey(key));
        return undefined;
      }
      return { body: hit.body, etag: hit.etag };
    },
    set(key: string, body: string, etag: string): void {
      entries.set(fullKey(key), { body, etag, expiresAt: now() + ttlMs });
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) {
          entries.delete(oldest);
        }
      }
    },
    invalidate(): void {
      generation += 1;
      entries.clear();
    },
  };
}
