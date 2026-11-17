import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { setRequestId } from '../src/lib/request-id.js';
import { silentLogger } from './helpers.js';

function invoke(error: unknown): { status: number; body: unknown } {
  const handler = createErrorHandler(silentLogger());
  const req = { method: 'POST', path: '/v1/example' } as unknown as Request;
  setRequestId(req, 'req-unit');
  let status = 0;
  let body: unknown;
  const res = {
    headersSent: false,
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
  return { status, body };
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
