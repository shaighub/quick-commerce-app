import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  createErrorReporter,
  parseSentryDsn,
  toReportedError,
} from '../src/lib/error-reporting.js';
import { createDatabase } from '../src/lib/prisma.js';
import { silentLogger, testConfig } from './helpers.js';

function bodyText(body: unknown): string {
  return typeof body === 'string' ? body : '';
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return 'unknown';
}

describe('sentry envelope', () => {
  it('accepts an https project dsn and rejects unsafe values', () => {
    expect(parseSentryDsn('https://public@o0.ingest.sentry.io/42')).toEqual({
      dsn: 'https://public@o0.ingest.sentry.io/42',
      publicKey: 'public',
      envelopeUrl: 'https://o0.ingest.sentry.io/api/42/envelope/',
    });
    expect(parseSentryDsn('http://public@sentry.example.com/1')).toBeNull();
    expect(parseSentryDsn('https://sentry.example.com/1')).toBeNull();
    expect(parseSentryDsn('https://public@localhost/1')).toBeNull();
    expect(parseSentryDsn('https://public@sentry.example.local/1')).toBeNull();
    expect(parseSentryDsn('not a url')).toBeNull();
  });

  it('describes only Error instances', () => {
    expect(toReportedError(new Error('connection reset'), 'req-1')).toEqual({
      name: 'Error',
      message: 'connection reset',
      requestId: 'req-1',
    });
    expect(toReportedError('plain', 'req-2').message).toBe('Unknown error');
  });

  it('posts the request id and does not follow redirects', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl: typeof fetch = (url, init) => {
      calls.push({ url: requestUrl(url), init });
      return Promise.resolve(new Response(null, { status: 200 }));
    };
    const reporter = createErrorReporter({
      dsn: 'https://public@sentry.example.com/1',
      fetchImpl,
    });
    reporter.capture(new Error('connection reset'), 'req-sentry-1');
    reporter.capture('plain', 'req-sentry-2');
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://sentry.example.com/api/1/envelope/');
    expect(calls[0]?.init?.redirect).toBe('error');
    const body = bodyText(calls[0]?.init?.body);
    expect(body).toContain('req-sentry-1');
    expect(body).toContain('connection reset');
    expect(bodyText(calls[1]?.init?.body)).toContain('Unknown error');
  });

  it('stays quiet without a dsn and logs a transport failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    createErrorReporter({ dsn: undefined, fetchImpl }).capture(new Error('x'), 'req');
    expect(fetchImpl).not.toHaveBeenCalled();

    const warn = vi.fn();
    createErrorReporter({
      dsn: 'https://public@sentry.example.com/1',
      fetchImpl: () => Promise.reject(new Error('network')),
      logger: { warn },
    }).capture(new Error('x'), 'req-fail');
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(warn).toHaveBeenCalledWith({ requestId: 'req-fail' }, 'error report failed');
  });
});

describe('unhandled errors reach the sentry transport', () => {
  const sent: string[] = [];
  const fetchImpl: typeof fetch = (_url, init) => {
    sent.push(bodyText(init?.body));
    return Promise.resolve(new Response(null, { status: 200 }));
  };
  const logger = silentLogger();
  const config = testConfig({ sentryDsn: 'https://public@sentry.example.com/42' });
  const database = createDatabase(config.databaseUrl, logger);
  const app = createApp({
    config,
    logger,
    prisma: database.prisma,
    checkDb: () => Promise.reject(new Error('connection reset')),
    fetchImpl,
  });

  afterAll(async () => {
    await database.close();
  });

  it('reports the caller request id and hides the cause from the client', async () => {
    const response = await request(app).get('/v1/health').set('x-request-id', 'req-sentry-it');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        requestId: 'req-sentry-it',
      },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(sent.join('\n')).toContain('req-sentry-it');
    expect(sent.join('\n')).toContain('connection reset');
  });
});
