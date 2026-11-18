import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncRoute } from '../lib/async-route.js';
import type { AuthController } from '../controllers/auth.controller.js';
import { requireCsrf } from '../middleware/csrf.js';

export function createAuthRouter(deps: {
  controller: AuthController;
  requireAuth: RequestHandler;
}): Router {
  const router = Router();
  router.post(
    '/auth/signup',
    asyncRoute(async (req, res) => {
      await deps.controller.signup(req, res);
    }),
  );
  router.post(
    '/auth/login',
    asyncRoute(async (req, res) => {
      await deps.controller.login(req, res);
    }),
  );
  router.post(
    '/auth/refresh',
    requireCsrf,
    asyncRoute(async (req, res) => {
      await deps.controller.refresh(req, res);
    }),
  );
  router.post(
    '/auth/logout',
    requireCsrf,
    asyncRoute(async (req, res) => {
      await deps.controller.logout(req, res);
    }),
  );
  router.post(
    '/auth/logout-all',
    requireCsrf,
    deps.requireAuth,
    asyncRoute(async (req, res) => {
      await deps.controller.logoutAll(req, res);
    }),
  );
  router.get(
    '/auth/me',
    deps.requireAuth,
    asyncRoute(async (req, res) => {
      await deps.controller.me(req, res);
    }),
  );
  return router;
}
