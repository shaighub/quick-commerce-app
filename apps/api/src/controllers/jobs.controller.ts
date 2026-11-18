import type { Request, Response } from 'express';
import { ErrorCodes, sweepRequestSchema } from '@qc/shared';
import { AppError } from '../lib/errors.js';
import { secretsEqual } from '../lib/secret-equal.js';
import type { OrderService } from '../services/order.service.js';

export interface JobsController {
  sweep(req: Request, res: Response): Promise<void>;
}

export function createJobsController(deps: {
  orders: OrderService;
  jobsToken: string;
}): JobsController {
  return {
    async sweep(req: Request, res: Response): Promise<void> {
      const provided = req.get('x-jobs-token') ?? '';
      if (!secretsEqual(provided, deps.jobsToken)) {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
      }
      const body: unknown = req.body === undefined || req.body === null ? {} : req.body;
      const input = sweepRequestSchema.parse(body);
      const result = await deps.orders.sweepPendingPayments(input.olderThanMinutes);
      res.status(200).json(result);
    },
  };
}
