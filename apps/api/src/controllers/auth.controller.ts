import type { Request, Response } from 'express';
import { loginSchema, signupSchema } from '@qc/shared';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../lib/cookies.js';
import { requestMeta } from '../lib/client-ip.js';
import { ErrorCodes } from '../lib/errors.js';
import { AppError } from '../lib/errors.js';
import type { AuthService } from '../services/auth.service.js';
import type { TokenService } from '../services/token.service.js';

export interface AuthController {
  signup(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  refresh(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  logoutAll(req: Request, res: Response): Promise<void>;
  me(req: Request, res: Response): Promise<void>;
}

export function createAuthController(deps: {
  auth: AuthService;
  tokens: TokenService;
}): AuthController {
  return {
    async signup(req: Request, res: Response): Promise<void> {
      const body = signupSchema.parse(req.body);
      const session = await deps.auth.signup(
        {
          name: body.name,
          email: body.email,
          password: body.password,
          ...(body.phone === undefined ? {} : { phone: body.phone }),
        },
        requestMeta(req),
      );
      setRefreshCookie(res, session.refresh.raw, session.refresh.expiresAt);
      res.status(201).json({ user: session.user, accessToken: session.accessToken });
    },

    async login(req: Request, res: Response): Promise<void> {
      const body = loginSchema.parse(req.body);
      const session = await deps.auth.login(body.email, body.password, requestMeta(req));
      setRefreshCookie(res, session.refresh.raw, session.refresh.expiresAt);
      res.status(200).json({ user: session.user, accessToken: session.accessToken });
    },

    async refresh(req: Request, res: Response): Promise<void> {
      const raw = readRefreshCookie(req);
      if (!raw) {
        throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Refresh token is invalid');
      }
      const rotated = await deps.tokens.rotate(raw, requestMeta(req));
      setRefreshCookie(res, rotated.refresh.raw, rotated.refresh.expiresAt);
      res.status(200).json({ accessToken: rotated.accessToken });
    },

    async logout(req: Request, res: Response): Promise<void> {
      const raw = readRefreshCookie(req);
      if (raw) {
        await deps.tokens.revoke(raw, 'LOGOUT');
      }
      clearRefreshCookie(res);
      res.status(204).send();
    },

    async logoutAll(req: Request, res: Response): Promise<void> {
      if (!req.auth) {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
      }
      await deps.auth.logoutAll(req.auth.id);
      clearRefreshCookie(res);
      res.status(204).send();
    },

    async me(req: Request, res: Response): Promise<void> {
      if (!req.auth) {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
      }
      const result = await deps.auth.me(req.auth.id);
      res.status(200).json(result);
    },
  };
}
