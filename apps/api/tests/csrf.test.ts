import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import { requireCsrf } from '../src/middleware/csrf.js';

function run(headers: Record<string, string | undefined>, host = 'shop.local'): unknown {
  const req = {
    protocol: 'https',
    get(name: string) {
      if (name === 'host') {
        return host;
      }
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
  let result: unknown = 'next';
  const next: NextFunction = (error?: unknown) => {
    result = error ?? 'next';
  };
  requireCsrf(req, {} as unknown as Response, next);
  return result;
}

describe('CSRF middleware', () => {
  it('requires X-Requested-With', () => {
    expect(run({})).toBeInstanceOf(AppError);
    expect((run({ 'x-requested-with': '   ' }) as AppError).status).toBe(403);
  });

  it('rejects a foreign origin and a cross-site fetch', () => {
    const foreign = run({
      'x-requested-with': 'XMLHttpRequest',
      origin: 'https://evil.example',
    }) as AppError;
    expect(foreign.status).toBe(403);
    expect(foreign.code).toBe('FORBIDDEN');

    const crossSite = run({
      'x-requested-with': 'XMLHttpRequest',
      'sec-fetch-site': 'cross-site',
    }) as AppError;
    expect(crossSite.status).toBe(403);

    const sameSite = run({
      'x-requested-with': 'XMLHttpRequest',
      'sec-fetch-site': 'same-site',
    }) as AppError;
    expect(sameSite.status).toBe(403);
  });

  it('allows a proxied browser call whose origin is the web app, not the API host', () => {
    expect(
      run({
        'x-requested-with': 'XMLHttpRequest',
        origin: 'http://127.0.0.1:5173',
        'sec-fetch-site': 'same-origin',
      }),
    ).toBe('next');
  });

  it('allows a matching origin and same-origin or none fetch metadata', () => {
    expect(
      run({
        'x-requested-with': 'XMLHttpRequest',
        origin: 'https://shop.local',
        'sec-fetch-site': 'same-origin',
      }),
    ).toBe('next');
    expect(run({ 'x-requested-with': 'XMLHttpRequest', 'sec-fetch-site': 'none' })).toBe('next');
    expect(run({ 'x-requested-with': 'XMLHttpRequest' })).toBe('next');
  });
});
