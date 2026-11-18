import type { DeliveryAddress, PublicUser, Role } from '@qc/shared';

export interface AuthPrincipal {
  id: string;
  role: Role;
  tokenVersion: number;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface IssuedRefreshToken {
  raw: string;
  expiresAt: Date;
  id: string;
}

export interface AuthSessionResult {
  user: PublicUser;
  accessToken: string;
  refresh: IssuedRefreshToken;
}

export interface MeResult {
  user: PublicUser & { lastAddress: DeliveryAddress | null };
}

export const REVOKED_REASONS = [
  'LOGOUT',
  'LOGOUT_ALL',
  'ROTATED',
  'REUSE_DETECTED',
  'USER_DISABLED',
] as const;

export type RevokedReason = (typeof REVOKED_REASONS)[number];
