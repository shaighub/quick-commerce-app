import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import type { RequestMeta, RevokedReason } from '../src/domain/auth.js';
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../src/repositories/refresh-token.repository.js';
import type { UserRecord } from '../src/repositories/user.repository.js';
import {
  createTokenService,
  hashRefreshToken,
  readAccessToken,
} from '../src/services/token.service.js';

const secret = 'local-dev-only-jwt-secret-32chars-min';
const meta: RequestMeta = { ip: '127.0.0.1', userAgent: 'vitest', requestId: 'req-token' };

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    email: 'a@b.co',
    passwordHash: 'hash',
    name: 'Asha',
    phone: null,
    role: 'CUSTOMER',
    isActive: true,
    tokenVersion: 4,
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

function memoryRepo(failClaim = false): RefreshTokenRepository & { rows: RefreshTokenRecord[] } {
  const rows: RefreshTokenRecord[] = [];
  return {
    rows,
    async insert(input: NewRefreshToken): Promise<RefreshTokenRecord> {
      await Promise.resolve();
      const row: RefreshTokenRecord = {
        id: randomUUID(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        replacedById: null,
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedReason: null,
      };
      rows.push(row);
      return row;
    },
    async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
      await Promise.resolve();
      return rows.find((row) => row.tokenHash === tokenHash) ?? null;
    },
    async claimForRotation(id: string, replacedById: string, at: Date): Promise<boolean> {
      await Promise.resolve();
      if (failClaim) {
        return false;
      }
      const row = rows.find((item) => item.id === id && item.revokedAt === null);
      if (!row) {
        return false;
      }
      row.revokedAt = at;
      row.revokedReason = 'ROTATED';
      row.replacedById = replacedById;
      return true;
    },
    async revokeById(id: string, reason: RevokedReason, at: Date): Promise<void> {
      await Promise.resolve();
      const row = rows.find((item) => item.id === id && item.revokedAt === null);
      if (row) {
        row.revokedAt = at;
        row.revokedReason = reason;
      }
    },
    async revokeFamily(familyId: string, reason: RevokedReason, at: Date): Promise<void> {
      await Promise.resolve();
      for (const row of rows) {
        if (row.familyId === familyId && row.revokedAt === null) {
          row.revokedAt = at;
          row.revokedReason = reason;
        }
      }
    },
    async revokeAllForUser(userId: string, reason: RevokedReason, at: Date): Promise<void> {
      await Promise.resolve();
      for (const row of rows) {
        if (row.userId === userId && row.revokedAt === null) {
          row.revokedAt = at;
          row.revokedReason = reason;
        }
      }
    },
  };
}

function service(repo: RefreshTokenRepository, current: UserRecord, clock: () => Date) {
  return createTokenService({
    users: {
      findById() {
        return Promise.resolve(current);
      },
    },
    refreshTokens: repo,
    jwtSecret: secret,
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604_800,
    now: clock,
  });
}

describe('token service', () => {
  it('issues an access token with sub, role, ver, and jti', () => {
    const tokens = service(memoryRepo(), user(), () => new Date('2026-11-18T00:00:00.000Z'));
    const token = tokens.issueAccess(user());
    const decoded = jwt.decode(token);
    expect(decoded).toMatchObject({ sub: user().id, role: 'CUSTOMER', ver: 4 });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('expected claims');
    }
    expect(decoded.jti).toEqual(expect.any(String));
    expect(decoded.exp).toBe((decoded.iat ?? 0) + 900);
    expect(readAccessToken(token, secret).ver).toBe(4);
  });

  it('stores only the hash and rotates inside the same family', async () => {
    const repo = memoryRepo();
    const clock = new Date('2026-11-18T00:00:00.000Z');
    const tokens = service(repo, user(), () => clock);
    const issued = await tokens.issueRefresh(user().id, meta);
    expect(issued.raw).not.toBe(hashRefreshToken(issued.raw));
    expect(repo.rows[0]?.tokenHash).toBe(hashRefreshToken(issued.raw));
    expect(repo.rows[0]?.expiresAt.toISOString()).toBe('2026-11-25T00:00:00.000Z');

    const rotated = await tokens.rotate(issued.raw, meta);
    expect(rotated.refresh.raw).not.toBe(issued.raw);
    expect(repo.rows[0]?.revokedReason).toBe('ROTATED');
    expect(repo.rows[0]?.replacedById).toBe(rotated.refresh.id);
    expect(repo.rows[1]?.familyId).toBe(repo.rows[0]?.familyId);
    expect(readAccessToken(rotated.accessToken, secret).ver).toBe(4);
  });

  it('revokes the family when a rotated token is presented again', async () => {
    const repo = memoryRepo();
    const tokens = service(repo, user(), () => new Date('2026-11-18T00:00:00.000Z'));
    const issued = await tokens.issueRefresh(user().id, meta);
    const rotated = await tokens.rotate(issued.raw, meta);
    await expect(tokens.rotate(issued.raw, meta)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_INVALID',
    });
    expect(repo.rows.find((row) => row.id === rotated.refresh.id)?.revokedReason).toBe(
      'REUSE_DETECTED',
    );
    await expect(tokens.rotate(rotated.refresh.raw, meta)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired refresh token without treating it as reuse', async () => {
    const repo = memoryRepo();
    let now = new Date('2026-11-18T00:00:00.000Z');
    const tokens = createTokenService({
      users: {
        findById() {
          return Promise.resolve(user());
        },
      },
      refreshTokens: repo,
      jwtSecret: secret,
      accessTtlSeconds: 900,
      refreshTtlSeconds: 5,
      now: () => now,
    });
    const issued = await tokens.issueRefresh(user().id, meta);
    now = new Date(now.getTime() + 6_000);
    await expect(tokens.rotate(issued.raw, meta)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(repo.rows[0]?.revokedAt).toBeNull();
  });

  it('rejects a missing token, an inactive user, and a lost rotation race', async () => {
    const repo = memoryRepo();
    const inactive = user({ isActive: false });
    const tokens = service(repo, inactive, () => new Date('2026-11-18T00:00:00.000Z'));
    await expect(tokens.rotate('missing', meta)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    const issued = await tokens.issueRefresh(inactive.id, meta);
    await expect(tokens.rotate(issued.raw, meta)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(repo.rows[0]?.revokedReason).toBe('USER_DISABLED');

    const raceRepo = memoryRepo(true);
    const active = service(raceRepo, user(), () => new Date('2026-11-18T00:00:00.000Z'));
    const first = await active.issueRefresh(user().id, meta);
    await expect(active.rotate(first.raw, meta)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(
      raceRepo.rows.every((row) => row.revokedReason === 'REUSE_DETECTED' || row.revokedAt),
    ).toBe(true);
  });

  it('revokes the current token on logout and ignores a token that is already gone', async () => {
    const repo = memoryRepo();
    const tokens = service(repo, user(), () => new Date('2026-11-18T00:00:00.000Z'));
    const issued = await tokens.issueRefresh(user().id, meta);
    await tokens.revoke(issued.raw, 'LOGOUT');
    expect(repo.rows[0]?.revokedReason).toBe('LOGOUT');
    await tokens.revoke(issued.raw, 'LOGOUT');
    await tokens.revoke('missing', 'LOGOUT');
    expect(repo.rows).toHaveLength(1);
  });

  it('maps a bad signature and an expired access token', () => {
    expect(() => readAccessToken('not-a-jwt', secret)).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
    const expired = jwt.sign(
      {
        sub: user().id,
        role: 'CUSTOMER',
        ver: 0,
        jti: 'jti-old',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      secret,
      { algorithm: 'HS256' },
    );
    expect(() => readAccessToken(expired, secret)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
    );
    const wrongShape = jwt.sign({ sub: user().id }, secret, { algorithm: 'HS256', expiresIn: 60 });
    expect(() => readAccessToken(wrongShape, secret)).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
  });
});
