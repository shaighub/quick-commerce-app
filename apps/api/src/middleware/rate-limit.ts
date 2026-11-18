import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { errorBody, ErrorCodes } from '../lib/errors.js';
import { getRequestId } from '../lib/request-id.js';

export function createRateLimiter(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res
        .status(429)
        .json(errorBody(ErrorCodes.RATE_LIMITED, 'Too many requests', getRequestId(req)));
    },
  });
}
