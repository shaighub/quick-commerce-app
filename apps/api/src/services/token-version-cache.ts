export interface AuthState {
  tokenVersion: number;
  isActive: boolean;
}

export interface TokenVersionCache {
  resolve(userId: string, load: () => Promise<AuthState | null>): Promise<AuthState | null>;
  invalidate(userId: string): void;
}

interface CacheEntry {
  state: AuthState;
  expiresAt: number;
}

/**
 * FR-AUTH-07 caches token_version for 30 seconds. The process that bumps the
 * version invalidates its own entry so logout-all takes effect on the next
 * request; other processes observe the new version when the entry expires.
 */
export function createTokenVersionCache(
  ttlMs = 30_000,
  now: () => number = Date.now,
): TokenVersionCache {
  const entries = new Map<string, CacheEntry>();

  return {
    async resolve(
      userId: string,
      load: () => Promise<AuthState | null>,
    ): Promise<AuthState | null> {
      const hit = entries.get(userId);
      const current = now();
      if (hit && hit.expiresAt > current) {
        return hit.state;
      }
      const loaded = await load();
      if (!loaded) {
        entries.delete(userId);
        return null;
      }
      entries.set(userId, { state: loaded, expiresAt: current + ttlMs });
      return loaded;
    },
    invalidate(userId: string): void {
      entries.delete(userId);
    },
  };
}
