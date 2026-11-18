import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@qc/shared';
import { ErrorCodes } from '@qc/shared';
import type { IssuedRefreshToken, RequestMeta, RevokedReason } from '../domain/auth.js';
import { AppError } from '../lib/errors.js';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';

export interface AccessTokenUser {
  id: string;
  role: Role;
  tokenVersion: number;
}

export interface AccessClaims {
  sub: string;
  role: Role;
  ver: number;
  jti: string;
}

export interface TokenService {
  issueAccess(user: AccessTokenUser): string;
  issueRefresh(userId: string, meta: RequestMeta, familyId?: string): Promise<IssuedRefreshToken>;
  rotate(
    raw: string,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refresh: IssuedRefreshToken }>;
  revoke(raw: string, reason: 'LOGOUT'): Promise<void>;
  revokeAllForUser(userId: string, reason: RevokedReason): Promise<void>;
}

const INVALID_REFRESH = 'Refresh token is invalid';

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function newRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

function invalidRefresh(): AppError {
  return new AppError(401, ErrorCodes.TOKEN_INVALID, INVALID_REFRESH);
}

function isAccessClaims(value: jwt.JwtPayload): value is jwt.JwtPayload & AccessClaims {
  return (
    typeof value.sub === 'string' &&
    (value.role === 'ADMIN' || value.role === 'CUSTOMER') &&
    typeof value.ver === 'number' &&
    typeof value.jti === 'string'
  );
}

export function readAccessToken(token: string, secret: string): AccessClaims {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !isAccessClaims(decoded)) {
      throw invalidRefreshAccess();
    }
    return { sub: decoded.sub, role: decoded.role, ver: decoded.ver, jti: decoded.jti };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ErrorCodes.TOKEN_EXPIRED, 'Access token expired');
    }
    throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication required');
  }
}

function invalidRefreshAccess(): AppError {
  return new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication required');
}

export function createTokenService(deps: {
  users: Pick<UserRepository, 'findById'>;
  refreshTokens: RefreshTokenRepository;
  jwtSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  now: () => Date;
}): TokenService {
  const { users, refreshTokens, jwtSecret, accessTtlSeconds, refreshTtlSeconds, now } = deps;

  function issueAccess(user: AccessTokenUser): string {
    return jwt.sign(
      { sub: user.id, role: user.role, ver: user.tokenVersion, jti: randomUUID() },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: accessTtlSeconds },
    );
  }

  async function issueRefresh(
    userId: string,
    meta: RequestMeta,
    familyId?: string,
  ): Promise<IssuedRefreshToken> {
    const raw = newRefreshSecret();
    const issuedAt = now();
    const record = await refreshTokens.insert({
      userId,
      tokenHash: hashRefreshToken(raw),
      familyId: familyId ?? randomUUID(),
      expiresAt: new Date(issuedAt.getTime() + refreshTtlSeconds * 1000),
      userAgent: meta.userAgent,
      ipAddress: meta.ip,
    });
    return { raw, expiresAt: record.expiresAt, id: record.id };
  }

  return {
    issueAccess,
    issueRefresh,
    async rotate(raw: string, meta: RequestMeta) {
      const existing = await refreshTokens.findByHash(hashRefreshToken(raw));
      if (!existing) {
        throw invalidRefresh();
      }
      const issuedAt = now();
      if (existing.revokedAt) {
        await refreshTokens.revokeFamily(existing.familyId, 'REUSE_DETECTED', issuedAt);
        throw invalidRefresh();
      }
      if (existing.expiresAt.getTime() <= issuedAt.getTime()) {
        throw invalidRefresh();
      }
      const user = await users.findById(existing.userId);
      if (!user || !user.isActive) {
        await refreshTokens.revokeAllForUser(existing.userId, 'USER_DISABLED', issuedAt);
        throw invalidRefresh();
      }
      const refresh = await issueRefresh(user.id, meta, existing.familyId);
      const claimed = await refreshTokens.claimForRotation(existing.id, refresh.id, issuedAt);
      if (!claimed) {
        await refreshTokens.revokeById(refresh.id, 'REUSE_DETECTED', issuedAt);
        await refreshTokens.revokeFamily(existing.familyId, 'REUSE_DETECTED', issuedAt);
        throw invalidRefresh();
      }
      return {
        accessToken: issueAccess({
          id: user.id,
          role: user.role,
          tokenVersion: user.tokenVersion,
        }),
        refresh,
      };
    },
    async revoke(raw: string, reason: 'LOGOUT'): Promise<void> {
      const existing = await refreshTokens.findByHash(hashRefreshToken(raw));
      if (!existing || existing.revokedAt) {
        return;
      }
      await refreshTokens.revokeById(existing.id, reason, now());
    },
    async revokeAllForUser(userId: string, reason: RevokedReason): Promise<void> {
      await refreshTokens.revokeAllForUser(userId, reason, now());
    },
  };
}
