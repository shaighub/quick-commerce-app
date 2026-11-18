import type { Request, Response } from 'express';
import { serviceabilityQuerySchema } from '@qc/shared';
import { queryRecord } from '../lib/request-input.js';
import type { ServiceabilityService } from '../services/serviceability.service.js';

export interface ServiceabilityController {
  check(req: Request, res: Response): Promise<void>;
}

export function createServiceabilityController(deps: {
  serviceability: ServiceabilityService;
}): ServiceabilityController {
  return {
    check(req: Request, res: Response): Promise<void> {
      const query = serviceabilityQuerySchema.parse(queryRecord(req.query));
      res.status(200).json(deps.serviceability.check(query.pincode));
      return Promise.resolve();
    },
  };
}
