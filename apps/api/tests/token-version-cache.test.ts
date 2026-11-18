import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTokenVersionCache } from '../src/services/token-version-cache.js';

describe('token version cache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a version for 30 seconds and reloads after invalidation or expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T00:00:00.000Z'));
    const cache = createTokenVersionCache();
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve({ tokenVersion: loads, isActive: true });
    };

    await expect(cache.resolve('user-1', load)).resolves.toEqual({
      tokenVersion: 1,
      isActive: true,
    });
    await expect(cache.resolve('user-1', load)).resolves.toEqual({
      tokenVersion: 1,
      isActive: true,
    });
    expect(loads).toBe(1);

    vi.advanceTimersByTime(29_999);
    await cache.resolve('user-1', load);
    expect(loads).toBe(1);

    vi.advanceTimersByTime(1);
    await expect(cache.resolve('user-1', load)).resolves.toEqual({
      tokenVersion: 2,
      isActive: true,
    });
    expect(loads).toBe(2);

    cache.invalidate('user-1');
    await expect(cache.resolve('user-1', load)).resolves.toEqual({
      tokenVersion: 3,
      isActive: true,
    });
    expect(loads).toBe(3);
  });

  it('does not cache a missing user', async () => {
    const cache = createTokenVersionCache();
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve(null);
    };
    await expect(cache.resolve('missing', load)).resolves.toBeNull();
    await expect(cache.resolve('missing', load)).resolves.toBeNull();
    expect(loads).toBe(2);
  });
});
