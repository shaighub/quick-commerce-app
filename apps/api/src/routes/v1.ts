import { Router } from 'express';
import type { AppConfig } from '../config/env.js';
import { createHealthController } from '../controllers/health.controller.js';
import { loadOpenApiSpec } from '../openapi/load.js';
import { createDocsRouter } from './docs.routes.js';
import { createHealthRouter } from './health.routes.js';

export function createV1Router(deps: {
  config: AppConfig;
  checkDb: () => Promise<boolean>;
}): Router {
  const router = Router();
  const health = createHealthController({ version: deps.config.version, checkDb: deps.checkDb });
  router.use(createHealthRouter(health));
  if (deps.config.docsEnabled) {
    router.use(createDocsRouter(loadOpenApiSpec()));
  }
  return router;
}
