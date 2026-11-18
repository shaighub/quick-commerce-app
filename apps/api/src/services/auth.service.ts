import type { PublicUser } from '@qc/shared';
import { ErrorCodes } from '@qc/shared';
import type { AuthSessionResult, MeResult, RequestMeta } from '../domain/auth.js';
import { AppError } from '../lib/errors.js';
import type { AppLogger } from '../lib/logger.js';
import type { UserRecord, UserRepository } from '../repositories/user.repository.js';
import { isUniqueViolation } from '../repositories/user.repository.js';
import {
  effectiveLockout,
  hashEmailKey,
  lockoutStatus,
  nextFailure,
  type LockoutState,
} from './lockout.js';
import type { PasswordService } from './password.service.js';
import type { TokenVersionCache } from './token-version-cache.js';
import type { TokenService } from './token.service.js';

const INVALID_MESSAGE = 'Email or password is incorrect';
const LOCKED_MESSAGE = 'Too many failed attempts. Try again later.';
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists';

export interface SignupCommand {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthService {
  signup(input: SignupCommand, meta: RequestMeta): Promise<AuthSessionResult>;
  login(email: string, password: string, meta: RequestMeta): Promise<AuthSessionResult>;
  logoutAll(userId: string): Promise<void>;
  me(userId: string): Promise<MeResult>;
}

function invalidCredentials(): AppError {
  return new AppError(401, ErrorCodes.INVALID_CREDENTIALS, INVALID_MESSAGE);
}

function accountLocked(retryAfter: number): AppError {
  return new AppError(423, ErrorCodes.ACCOUNT_LOCKED, LOCKED_MESSAGE, [{ retryAfter }], {
    'Retry-After': String(retryAfter),
  });
}

function emailTaken(): AppError {
  return new AppError(409, ErrorCodes.EMAIL_TAKEN, EMAIL_TAKEN_MESSAGE);
}

function toPublic(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function createAuthService(deps: {
  users: UserRepository;
  tokens: TokenService;
  passwords: PasswordService;
  logger: AppLogger;
  cache: TokenVersionCache;
  now: () => Date;
}): AuthService {
  const unknownEmails = new Map<string, LockoutState>();

  async function issueSession(user: UserRecord, meta: RequestMeta): Promise<AuthSessionResult> {
    const refresh = await deps.tokens.issueRefresh(user.id, meta);
    return {
      user: toPublic(user),
      accessToken: deps.tokens.issueAccess({
        id: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
      }),
      refresh,
    };
  }

  function logAdminFailure(user: UserRecord, meta: RequestMeta): void {
    if (user.role !== 'ADMIN') {
      return;
    }
    deps.logger.warn({ userId: user.id, requestId: meta.requestId }, 'admin login failed');
  }

  async function rejectUnknown(email: string, password: string, now: Date): Promise<never> {
    const key = hashEmailKey(email);
    const state = effectiveLockout(
      unknownEmails.get(key) ?? { failedLoginCount: 0, lockedUntil: null },
      now,
    );
    await deps.passwords.verifyUnknown(password);
    const status = lockoutStatus(state, now);
    if (status.locked) {
      throw accountLocked(status.retryAfter);
    }
    const failure = nextFailure(state, now);
    unknownEmails.set(key, {
      failedLoginCount: failure.failedLoginCount,
      lockedUntil: failure.lockedUntil,
    });
    if (failure.locked) {
      throw accountLocked(failure.retryAfter);
    }
    throw invalidCredentials();
  }

  return {
    async signup(input: SignupCommand, meta: RequestMeta): Promise<AuthSessionResult> {
      const email = input.email.trim().toLowerCase();
      const existing = await deps.users.findByEmail(email);
      if (existing) {
        throw emailTaken();
      }
      const passwordHash = await deps.passwords.hash(input.password);
      try {
        const user = await deps.users.create({
          email,
          passwordHash,
          name: input.name.trim(),
          phone: input.phone ?? null,
        });
        return await issueSession(user, meta);
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          throw emailTaken();
        }
        throw error;
      }
    },

    async login(email: string, password: string, meta: RequestMeta): Promise<AuthSessionResult> {
      const normalized = email.trim().toLowerCase();
      const now = deps.now();
      const user = await deps.users.findByEmail(normalized);
      if (!user) {
        return rejectUnknown(normalized, password, now);
      }

      const state = effectiveLockout(
        { failedLoginCount: user.failedLoginCount, lockedUntil: user.lockedUntil },
        now,
      );
      const status = lockoutStatus(state, now);
      const passwordOk = await deps.passwords.verify(password, user.passwordHash);
      if (status.locked) {
        logAdminFailure(user, meta);
        throw accountLocked(status.retryAfter);
      }
      if (!passwordOk || !user.isActive) {
        const failure = nextFailure(state, now);
        await deps.users.updateLockout(user.id, failure.failedLoginCount, failure.lockedUntil);
        logAdminFailure(user, meta);
        if (failure.locked) {
          throw accountLocked(failure.retryAfter);
        }
        throw invalidCredentials();
      }

      await deps.users.recordSuccessfulLogin(user.id, now);
      return issueSession({ ...user, failedLoginCount: 0, lockedUntil: null }, meta);
    },

    async logoutAll(userId: string): Promise<void> {
      await deps.users.incrementTokenVersion(userId);
      await deps.tokens.revokeAllForUser(userId, 'LOGOUT_ALL');
      deps.cache.invalidate(userId);
    },

    async me(userId: string): Promise<MeResult> {
      const user = await deps.users.findById(userId);
      if (!user || !user.isActive) {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
      }
      const lastAddress = await deps.users.findLatestAddress(userId);
      return { user: { ...toPublic(user), lastAddress } };
    },
  };
}
