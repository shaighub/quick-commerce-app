import { Router } from 'express';
import { asyncRoute } from '../lib/async-route.js';
import type { HealthController } from '../controllers/health.controller.js';

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get(
    '/health',
    asyncRoute(async (req, res) => {
      await controller.getHealth(req, res);
    }),
  );
  return router;
}
