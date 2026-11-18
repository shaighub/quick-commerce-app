import { Router } from 'express';
import type { JobsController } from '../controllers/jobs.controller.js';
import { asyncRoute } from '../lib/async-route.js';

export function createJobsRouter(jobs: JobsController): Router {
  const router = Router();
  router.post(
    '/internal/jobs/sweep',
    asyncRoute(async (req, res) => {
      await jobs.sweep(req, res);
    }),
  );
  return router;
}
