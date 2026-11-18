import type { PrismaClient } from '../generated/prisma/client.js';
import type { RevokedReason } from '../domain/auth.js';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedById: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

export interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface RefreshTokenRepository {
  insert(input: NewRefreshToken): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  claimForRotation(id: string, replacedById: string, at: Date): Promise<boolean>;
  revokeById(id: string, reason: RevokedReason, at: Date): Promise<void>;
  revokeFamily(familyId: string, reason: RevokedReason, at: Date): Promise<void>;
  revokeAllForUser(userId: string, reason: RevokedReason, at: Date): Promise<void>;
}

function toRecord(row: {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedById: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash.trim(),
    familyId: row.familyId,
    replacedById: row.replacedById,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
  };
}

export function createRefreshTokenRepository(prisma: PrismaClient): RefreshTokenRepository {
  return {
    async insert(input: NewRefreshToken): Promise<RefreshTokenRecord> {
      const row = await prisma.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
      });
      return toRecord(row);
    },
    async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
      const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      return row ? toRecord(row) : null;
    },
    async claimForRotation(id: string, replacedById: string, at: Date): Promise<boolean> {
      const result = await prisma.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: at, revokedReason: 'ROTATED', replacedById },
      });
      return result.count === 1;
    },
    async revokeById(id: string, reason: RevokedReason, at: Date): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: at, revokedReason: reason },
      });
    },
    async revokeFamily(familyId: string, reason: RevokedReason, at: Date): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: at, revokedReason: reason },
      });
    },
    async revokeAllForUser(userId: string, reason: RevokedReason, at: Date): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: at, revokedReason: reason },
      });
    },
  };
}
