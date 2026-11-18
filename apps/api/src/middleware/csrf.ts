import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '@qc/shared';
import { AppError } from '../lib/errors.js';

/**
 * ADR-004 / R03. Refresh and logout authenticate with a cookie, so they require
 * a custom header (which a cross-site form cannot set) and reject a foreign Origin.
 * A missing Origin is allowed for non-browser clients; SameSite=Strict still applies.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const requestedWith = req.get('x-requested-with');
  if (!requestedWith || requestedWith.trim() === '') {
    next(new AppError(403, ErrorCodes.FORBIDDEN, 'Request rejected'));
    return;
  }

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    next(new AppError(403, ErrorCodes.FORBIDDEN, 'Request rejected'));
    return;
  }

  const origin = req.get('origin');
  if (origin) {
    const expected = `${req.protocol}://${req.get('host') ?? ''}`;
    // The browser's Origin is the web origin. Vite and the Vercel rewrite
    // forward that header while the API host is the upstream, so a matching
    // Sec-Fetch-Site is the same-origin signal in that case.
    const proxiedSameOrigin = fetchSite === 'same-origin' || fetchSite === 'none';
    if (origin !== expected && !proxiedSameOrigin) {
      next(new AppError(403, ErrorCodes.FORBIDDEN, 'Request rejected'));
      return;
    }
  }

  next();
}
