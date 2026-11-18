import type { Request, Response } from 'express';

/** Design: cookie qc_rt, HttpOnly, Secure, SameSite=Strict, Path=/v1/auth. */
export const REFRESH_COOKIE_NAME = 'qc_rt';
export const REFRESH_COOKIE_PATH = '/v1/auth';

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: REFRESH_COOKIE_PATH,
};

export function setRefreshCookie(res: Response, raw: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, raw, { ...cookieOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req.get('cookie'), REFRESH_COOKIE_NAME);
}
