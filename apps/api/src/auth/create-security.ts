import type { AppConfig } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppLogger } from '../lib/logger.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthMiddleware, type AuthMiddleware } from '../middleware/auth.js';
import { createRefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { createAuthService, type AuthService } from '../services/auth.service.js';
import { createPasswordService } from '../services/password.service.js';
import { createTokenService, type TokenService } from '../services/token.service.js';
import {
  createTokenVersionCache,
  type TokenVersionCache,
} from '../services/token-version-cache.js';

export interface Security extends AuthMiddleware {
  auth: AuthService;
  tokens: TokenService;
  cache: TokenVersionCache;
  controller: ReturnType<typeof createAuthController>;
}

export function createSecurity(deps: {
  prisma: PrismaClient;
  config: AppConfig;
  logger: AppLogger;
  now?: () => Date;
}): Security {
  const now = deps.now ?? (() => new Date());
  const users = createUserRepository(deps.prisma);
  const refreshTokens = createRefreshTokenRepository(deps.prisma);
  const cache = createTokenVersionCache();
  const tokens = createTokenService({
    users,
    refreshTokens,
    jwtSecret: deps.config.jwtSecret,
    accessTtlSeconds: deps.config.accessTokenTtlSeconds,
    refreshTtlSeconds: deps.config.refreshTokenTtlSeconds,
    now,
  });
  const auth = createAuthService({
    users,
    tokens,
    passwords: createPasswordService(),
    logger: deps.logger,
    cache,
    now,
  });
  const middleware = createAuthMiddleware({
    jwtSecret: deps.config.jwtSecret,
    users,
    cache,
  });
  return {
    ...middleware,
    auth,
    tokens,
    cache,
    controller: createAuthController({ auth, tokens }),
  };
}
