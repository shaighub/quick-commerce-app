import { Prisma } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import type { UserRecord, UserRepository } from '../src/repositories/user.repository.js';
import { isUniqueViolation } from '../src/repositories/user.repository.js';
import { createAuthService } from '../src/services/auth.service.js';
import { createPasswordService } from '../src/services/password.service.js';
import { createTokenVersionCache } from '../src/services/token-version-cache.js';
import type { TokenService } from '../src/services/token.service.js';
import { silentLogger } from './helpers.js';

const meta = { ip: null, userAgent: null, requestId: 'req-svc' };

function person(): UserRecord {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    email: 'asha@example.com',
    passwordHash: 'hash',
    name: 'Asha',
    phone: null,
    role: 'CUSTOMER',
    isActive: true,
    tokenVersion: 0,
    failedLoginCount: 0,
    lockedUntil: null,
  };
}

function repository(overrides: Partial<UserRepository>): UserRepository {
  return {
    findByEmail() {
      return Promise.resolve(null);
    },
    findById() {
      return Promise.resolve(null);
    },
    findAuthState() {
      return Promise.resolve(null);
    },
    create() {
      return Promise.reject(new Error('create was not stubbed'));
    },
    updateLockout() {
      return Promise.resolve();
    },
    recordSuccessfulLogin() {
      return Promise.resolve();
    },
    incrementTokenVersion() {
      return Promise.resolve(1);
    },
    findLatestAddress() {
      return Promise.resolve(null);
    },
    ...overrides,
  };
}

function tokens(): TokenService {
  return {
    issueAccess: () => 'access-token',
    issueRefresh() {
      return Promise.resolve({
        raw: 'refresh-raw',
        expiresAt: new Date('2026-11-25T00:00:00.000Z'),
        id: 'rt-1',
      });
    },
    rotate() {
      return Promise.reject(new Error('not used'));
    },
    revoke() {
      return Promise.resolve();
    },
    revokeAllForUser() {
      return Promise.resolve();
    },
  };
}

describe('auth service errors', () => {
  it('recognises a Prisma unique violation', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueViolation(new Error('other'))).toBe(false);
  });

  it('maps a duplicate email and rethrows unexpected create failures', async () => {
    const taken = createAuthService({
      users: repository({
        findByEmail() {
          return Promise.resolve(person());
        },
      }),
      tokens: tokens(),
      passwords: createPasswordService(),
      logger: silentLogger(),
      cache: createTokenVersionCache(),
      now: () => new Date(),
    });
    await expect(
      taken.signup({ name: 'Asha', email: 'Asha@Example.com', password: 'Password1' }, meta),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });

    const raced = createAuthService({
      users: repository({
        create() {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          );
        },
      }),
      tokens: tokens(),
      passwords: createPasswordService(),
      logger: silentLogger(),
      cache: createTokenVersionCache(),
      now: () => new Date(),
    });
    await expect(
      raced.signup({ name: 'Asha', email: 'new@example.com', password: 'Password1' }, meta),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });

    const broken = createAuthService({
      users: repository({
        create() {
          return Promise.reject(new Error('disk full'));
        },
      }),
      tokens: tokens(),
      passwords: createPasswordService(),
      logger: silentLogger(),
      cache: createTokenVersionCache(),
      now: () => new Date(),
    });
    await expect(
      broken.signup({ name: 'Asha', email: 'new@example.com', password: 'Password1' }, meta),
    ).rejects.toThrow('disk full');
  });

  it('bumps the token version and refuses a missing profile', async () => {
    const revokeAllForUser = vi.fn(() => Promise.resolve());
    const cache = createTokenVersionCache();
    const invalidate = vi.spyOn(cache, 'invalidate');
    const service = createAuthService({
      users: repository({
        incrementTokenVersion() {
          return Promise.resolve(3);
        },
      }),
      tokens: { ...tokens(), revokeAllForUser },
      passwords: createPasswordService(),
      logger: silentLogger(),
      cache,
      now: () => new Date(),
    });
    await service.logoutAll('user-1');
    expect(revokeAllForUser).toHaveBeenCalledWith('user-1', 'LOGOUT_ALL');
    expect(invalidate).toHaveBeenCalledWith('user-1');
    await expect(service.me('missing')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
});
