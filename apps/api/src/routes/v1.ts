import { Router } from 'express';
import type { Security } from '../auth/create-security.js';
import type { AppConfig } from '../config/env.js';
import { createHealthController } from '../controllers/health.controller.js';
import { loadOpenApiSpec } from '../openapi/load.js';
import { createAuthRouter } from './auth.routes.js';
import { createDocsRouter } from './docs.routes.js';
import { createHealthRouter } from './health.routes.js';

export function createV1Router(deps: {
  config: AppConfig;
  checkDb: () => Promise<boolean>;
  security: Security;
}): Router {
  const router = Router();
  router.use(
    createAuthRouter({
      controller: deps.security.controller,
      requireAuth: deps.security.requireAuth,
    }),
  );
  const health = createHealthController({ version: deps.config.version, checkDb: deps.checkDb });
  router.use(createHealthRouter(health));
  if (deps.config.docsEnabled) {
    router.use(createDocsRouter(loadOpenApiSpec()));
  }
  return router;
}
