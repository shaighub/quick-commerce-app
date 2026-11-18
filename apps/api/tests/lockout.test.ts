import { describe, expect, it } from 'vitest';
import {
  effectiveLockout,
  hashEmailKey,
  LOCKOUT_DURATION_MS,
  lockoutStatus,
  nextFailure,
} from '../src/services/lockout.js';

const start = new Date('2026-11-18T00:00:00.000Z');

describe('lockout', () => {
  it('locks on the fifth failure for 15 minutes and resets after the window', () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const failure = nextFailure(state, start);
      expect(failure.locked).toBe(false);
      state = { failedLoginCount: failure.failedLoginCount, lockedUntil: failure.lockedUntil };
    }
    const locked = nextFailure(state, start);
    expect(locked.locked).toBe(true);
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.retryAfter).toBe(LOCKOUT_DURATION_MS / 1000);
    expect(locked.lockedUntil?.toISOString()).toBe('2026-11-18T00:15:00.000Z');

    const during = lockoutStatus(
      { failedLoginCount: 5, lockedUntil: locked.lockedUntil },
      new Date('2026-11-18T00:14:59.100Z'),
    );
    expect(during).toEqual({ locked: true, retryAfter: 1 });

    const expired = effectiveLockout(
      { failedLoginCount: 5, lockedUntil: locked.lockedUntil },
      new Date('2026-11-18T00:15:00.000Z'),
    );
    expect(expired).toEqual({ failedLoginCount: 0, lockedUntil: null });
    expect(lockoutStatus(expired, new Date('2026-11-18T00:15:00.000Z'))).toEqual({ locked: false });
  });

  it('hashes the email key so the raw address is not the map key', () => {
    expect(hashEmailKey('a@b.co')).toHaveLength(64);
    expect(hashEmailKey('a@b.co')).not.toContain('a@b.co');
    expect(hashEmailKey('a@b.co')).toBe(hashEmailKey('a@b.co'));
  });
});
