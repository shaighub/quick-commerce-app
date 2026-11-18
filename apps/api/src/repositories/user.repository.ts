import type { DeliveryAddress, Role } from '@qc/shared';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { AuthState } from '../services/token-version-cache.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  tokenVersion: number;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  phone: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findAuthState(id: string): Promise<AuthState | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updateLockout(id: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void>;
  recordSuccessfulLogin(id: string, at: Date): Promise<void>;
  incrementTokenVersion(id: string): Promise<number>;
  findLatestAddress(userId: string): Promise<DeliveryAddress | null>;
}

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  tokenVersion: number;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash.trim(),
    name: row.name,
    phone: row.phone,
    role: row.role,
    isActive: row.isActive,
    tokenVersion: row.tokenVersion,
    failedLoginCount: row.failedLoginCount,
    lockedUntil: row.lockedUntil,
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email: string): Promise<UserRecord | null> {
      const row = await prisma.user.findUnique({ where: { email } });
      return row ? toUser(row) : null;
    },
    async findById(id: string): Promise<UserRecord | null> {
      const row = await prisma.user.findUnique({ where: { id } });
      return row ? toUser(row) : null;
    },
    async findAuthState(id: string): Promise<AuthState | null> {
      const row = await prisma.user.findUnique({
        where: { id },
        select: { tokenVersion: true, isActive: true },
      });
      return row;
    },
    async create(input: CreateUserInput): Promise<UserRecord> {
      const row = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          phone: input.phone,
          role: 'CUSTOMER',
        },
      });
      return toUser(row);
    },
    async updateLockout(
      id: string,
      failedLoginCount: number,
      lockedUntil: Date | null,
    ): Promise<void> {
      await prisma.user.update({
        where: { id },
        data: { failedLoginCount, lockedUntil },
      });
    },
    async recordSuccessfulLogin(id: string, at: Date): Promise<void> {
      await prisma.user.update({
        where: { id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
      });
    },
    async incrementTokenVersion(id: string): Promise<number> {
      const row = await prisma.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      return row.tokenVersion;
    },
    async findLatestAddress(userId: string): Promise<DeliveryAddress | null> {
      const order = await prisma.order.findFirst({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        select: {
          shipName: true,
          shipPhone: true,
          shipLine1: true,
          shipLine2: true,
          shipCity: true,
          shipState: true,
          shipPincode: true,
        },
      });
      if (!order) {
        return null;
      }
      return {
        name: order.shipName,
        phone: order.shipPhone.trim(),
        line1: order.shipLine1,
        line2: order.shipLine2,
        city: order.shipCity,
        state: order.shipState,
        pincode: order.shipPincode.trim(),
      };
    },
  };
}
