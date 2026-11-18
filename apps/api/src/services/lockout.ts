import { createHash } from 'node:crypto';

/** FR-AUTH-08: five consecutive failures, then 15 minutes. */
export const LOGIN_FAILURE_LIMIT = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface LockoutState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export interface LockoutDecision {
  failedLoginCount: number;
  lockedUntil: Date | null;
  locked: boolean;
  retryAfter: number;
}

/** A lock that has already expired starts the counter over on the next attempt. */
export function effectiveLockout(state: LockoutState, now: Date): LockoutState {
  if (state.lockedUntil && state.lockedUntil.getTime() <= now.getTime()) {
    return { failedLoginCount: 0, lockedUntil: null };
  }
  return state;
}

export function lockoutStatus(
  state: LockoutState,
  now: Date,
): { locked: true; retryAfter: number } | { locked: false } {
  if (state.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
    const retryAfter = Math.max(1, Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000));
    return { locked: true, retryAfter };
  }
  return { locked: false };
}

export function nextFailure(state: LockoutState, now: Date): LockoutDecision {
  const failedLoginCount = state.failedLoginCount + 1;
  if (failedLoginCount >= LOGIN_FAILURE_LIMIT) {
    const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    return {
      failedLoginCount,
      lockedUntil,
      locked: true,
      retryAfter: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }
  return { failedLoginCount, lockedUntil: null, locked: false, retryAfter: 0 };
}

/** Unknown emails are counted in memory under a hash so the raw address is not kept. */
export function hashEmailKey(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}
