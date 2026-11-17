import type { Request, Response } from 'express';

export interface HealthControllerDeps {
  version: string;
  checkDb: () => Promise<boolean>;
}

export function createHealthController(deps: HealthControllerDeps) {
  return {
    async getHealth(_req: Request, res: Response): Promise<void> {
      const dbUp = await deps.checkDb();
      res.status(dbUp ? 200 : 503).json({
        status: dbUp ? 'ok' : 'unavailable',
        db: dbUp ? 'up' : 'down',
        version: deps.version,
      });
    },
  };
}

export type HealthController = ReturnType<typeof createHealthController>;
