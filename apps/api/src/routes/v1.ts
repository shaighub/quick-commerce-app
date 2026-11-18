import { Router } from 'express';
import type { Security } from '../auth/create-security.js';
import type { CatalogModule } from '../catalog/create-catalog.js';
import type { CommerceModule } from '../commerce/create-commerce.js';
import type { AppConfig } from '../config/env.js';
import { createHealthController } from '../controllers/health.controller.js';
import { loadOpenApiSpec } from '../openapi/load.js';
import { createAuthRouter } from './auth.routes.js';
import { createCartRouter } from './cart.routes.js';
import { createCatalogRouter } from './catalog.routes.js';
import { createDocsRouter } from './docs.routes.js';
import { createHealthRouter } from './health.routes.js';
import { createJobsRouter } from './jobs.routes.js';
import { createOrderRouter } from './order.routes.js';

export function createV1Router(deps: {
  config: AppConfig;
  checkDb: () => Promise<boolean>;
  security: Security;
  catalog: CatalogModule;
  commerce: CommerceModule;
}): Router {
  const router = Router();
  router.use(
    createAuthRouter({
      controller: deps.security.controller,
      requireAuth: deps.security.requireAuth,
    }),
  );
  router.use(
    createCatalogRouter({
      catalog: deps.catalog.controller,
      serviceability: deps.catalog.serviceability,
      requireAdmin: deps.security.requireRole('ADMIN'),
    }),
  );
  router.use(
    createCartRouter({
      cart: deps.commerce.cartController,
      requireCustomer: deps.security.requireRole('CUSTOMER'),
    }),
  );
  router.use(
    createOrderRouter({
      orders: deps.commerce.orderController,
      requireCustomer: deps.security.requireRole('CUSTOMER'),
      requireAdmin: deps.security.requireRole('ADMIN'),
    }),
  );
  router.use(createJobsRouter(deps.commerce.jobs));
  const health = createHealthController({ version: deps.config.version, checkDb: deps.checkDb });
  router.use(createHealthRouter(health));
  if (deps.config.docsEnabled) {
    router.use(createDocsRouter(loadOpenApiSpec()));
  }
  return router;
}
