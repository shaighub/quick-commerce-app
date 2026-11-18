import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@qc/shared';
import { ErrorCodes } from '@qc/shared';
import { AppError } from '../lib/errors.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { TokenVersionCache } from '../services/token-version-cache.js';
import { readAccessToken } from '../services/token.service.js';

export interface AuthMiddleware {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => void;
}

function unauthorized(): AppError {
  return new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
}

export function createAuthMiddleware(deps: {
  jwtSecret: string;
  users: Pick<UserRepository, 'findAuthState'>;
  cache: TokenVersionCache;
}): AuthMiddleware {
  const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.get('authorization');
    if (!header) {
      next(unauthorized());
      return;
    }
    const separator = header.indexOf(' ');
    const scheme = separator === -1 ? header : header.slice(0, separator);
    const token = separator === -1 ? '' : header.slice(separator + 1).trim();
    if (scheme !== 'Bearer' || token === '') {
      next(unauthorized());
      return;
    }

    let claims;
    try {
      claims = readAccessToken(token, deps.jwtSecret);
    } catch (error: unknown) {
      next(error);
      return;
    }

    void deps.cache
      .resolve(claims.sub, () => deps.users.findAuthState(claims.sub))
      .then((state) => {
        if (!state || !state.isActive || state.tokenVersion !== claims.ver) {
          next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication required'));
          return;
        }
        req.auth = { id: claims.sub, role: claims.role, tokenVersion: claims.ver };
        next();
      })
      .catch(next);
  };

  const requireRole =
    (...roles: Role[]) =>
    (req: Request, res: Response, next: NextFunction): void => {
      requireAuth(req, res, (error?: unknown) => {
        if (error) {
          next(error);
          return;
        }
        if (!req.auth || !roles.includes(req.auth.role)) {
          next(new AppError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this resource'));
          return;
        }
        next();
      });
    };

  return { requireAuth, requireRole };
}
