import type { NextFunction, Request, Response } from 'express';
import { createImageUrlSchema } from '@qc/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/lib/errors.js';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { setRequestId } from '../src/lib/request-id.js';
import { silentLogger } from './helpers.js';

function invoke(error: unknown): {
  status: number;
  body: unknown;
  headers: Record<string, string>;
} {
  const handler = createErrorHandler(silentLogger());
  const req = { method: 'POST', path: '/v1/example' } as unknown as Request;
  setRequestId(req, 'req-unit');
  let status = 0;
  let body: unknown;
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  handler(error, req, res, (() => undefined) as NextFunction);
  return { status, body, headers };
}

describe('error handler', () => {
  it('maps a Zod failure to 422 VALIDATION', () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    if (parsed.success) {
      throw new Error('expected a validation failure');
    }
    const result = invoke(parsed.error);
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({
      error: {
        code: 'VALIDATION',
        message: 'Request validation failed',
        requestId: 'req-unit',
      },
    });
  });

  it('maps an unlisted image host to IMAGE_HOST_NOT_ALLOWED', () => {
    const parsed = createImageUrlSchema(['images.example.com']).safeParse(
      'https://evil.example/a.png',
    );
    if (parsed.success) {
      throw new Error('expected the host to be rejected');
    }
    const result = invoke(parsed.error);
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({
      error: { code: 'IMAGE_HOST_NOT_ALLOWED', message: 'Image host is not allowlisted' },
    });
  });

  it('copies AppError headers such as Retry-After', () => {
    const result = invoke(
      new AppError(
        423,
        'ACCOUNT_LOCKED',
        'Too many failed attempts. Try again later.',
        [{ retryAfter: 90 }],
        {
          'Retry-After': '90',
        },
      ),
    );
    expect(result.status).toBe(423);
    expect(result.headers['Retry-After']).toBe('90');
    expect(result.body).toMatchObject({
      error: { code: 'ACCOUNT_LOCKED', details: [{ retryAfter: 90 }] },
    });
  });

  it('hides unexpected error details', () => {
    const result = invoke(new Error('secret table users'));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        requestId: 'req-unit',
      },
    });
  });
});
