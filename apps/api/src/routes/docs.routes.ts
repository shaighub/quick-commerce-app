import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

export function createDocsRouter(spec: Record<string, unknown>): Router {
  const router = Router();
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, { customSiteTitle: 'Quick Commerce API' }),
  );
  return router;
}
