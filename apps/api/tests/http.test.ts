import { Writable } from 'node:stream';
import { errorResponseSchema } from '@qc/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { createDatabase } from '../src/lib/prisma.js';
import { checkDatabase } from '../src/services/health.service.js';
import { collectingLogger, silentLogger, testConfig } from './helpers.js';

const logLineSchema = z.object({ requestId: z.string().optional() });

function errorCode(body: unknown): string {
  return errorResponseSchema.parse(body).error.code;
}

function errorMessage(body: unknown): string {
  return errorResponseSchema.parse(body).error.message;
}

function errorRequestId(body: unknown): string {
  return errorResponseSchema.parse(body).error.requestId;
}

const config = testConfig();
const logger = silentLogger();
const database = createDatabase(config.databaseUrl, logger);
const app = createApp({
  config,
  logger,
  prisma: database.prisma,
  checkDb: () => checkDatabase(database.prisma, logger),
});

afterAll(async () => {
  await database.close();
});

describe('HTTP skeleton', () => {
  it('reports a healthy database', async () => {
    const response = await request(app).get('/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', db: 'up', version: '0.1.0' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain('https://images.example.com');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not enable CORS for a foreign origin', async () => {
    const response = await request(app).get('/v1/health').set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the error envelope for an unknown route and keeps a safe request id', async () => {
    const response = await request(app).get('/v1/missing').set('x-request-id', 'trace_123');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No route for GET /v1/missing',
        requestId: 'trace_123',
      },
    });
    expect(response.headers['x-request-id']).toBe('trace_123');
  });

  it('replaces an invalid request id', async () => {
    const response = await request(app).get('/v1/missing').set('x-request-id', 'not valid');
    expect(errorRequestId(response.body)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('rejects invalid JSON and oversized bodies', async () => {
    const invalid = await request(app)
      .post('/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken"');
    expect(invalid.status).toBe(400);
    expect(errorCode(invalid.body)).toBe('INVALID_JSON');

    const oversized = await request(app)
      .post('/v1/health')
      .set('Content-Type', 'application/json')
      .send({ blob: 'x'.repeat(120_000) });
    expect(oversized.status).toBe(413);
    expect(errorCode(oversized.body)).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 503 when the database check fails and 500 when it throws', async () => {
    const down = createApp({
      config,
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(false),
    });
    const downResponse = await request(down).get('/v1/health');
    expect(downResponse.status).toBe(503);
    expect(downResponse.body).toMatchObject({ status: 'unavailable', db: 'down' });

    const exploding = createApp({
      config,
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.reject(new Error('connection reset')),
    });
    const errorResponse = await request(exploding).get('/v1/health');
    expect(errorResponse.status).toBe(500);
    expect(errorCode(errorResponse.body)).toBe('INTERNAL_ERROR');
    expect(errorMessage(errorResponse.body)).toBe('Something went wrong');
  });

  it('rate limits public and auth routes', async () => {
    const limited = createApp({
      config: testConfig({ rateLimitPublicMax: 2, rateLimitAuthMax: 2 }),
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    expect((await request(limited).get('/v1/health')).status).toBe(200);
    expect((await request(limited).get('/v1/health')).status).toBe(200);
    const blocked = await request(limited).get('/v1/health');
    expect(blocked.status).toBe(429);
    expect(errorCode(blocked.body)).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();

    const authLimited = createApp({
      config: testConfig({ rateLimitPublicMax: 100, rateLimitAuthMax: 2 }),
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    expect((await request(authLimited).post('/v1/auth/login')).status).toBe(422);
    expect((await request(authLimited).post('/v1/auth/login')).status).toBe(422);
    const authBlocked = await request(authLimited).post('/v1/auth/login');
    expect(authBlocked.status).toBe(429);
  });

  it('serves OpenAPI docs when enabled and hides them when disabled', async () => {
    const docs = await request(app).get('/v1/docs/');
    expect(docs.status).toBe(200);
    expect(docs.text.toLowerCase()).toContain('swagger');

    const hidden = createApp({
      config: testConfig({ docsEnabled: false }),
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    const missing = await request(hidden).get('/v1/docs/');
    expect(missing.status).toBe(404);
    expect(errorCode(missing.body)).toBe('NOT_FOUND');
  });

  it('writes a request id on each access log line', async () => {
    const collected = collectingLogger();
    const logged = createApp({
      config,
      logger: collected.logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    await request(logged).get('/v1/health').set('x-request-id', 'log_line_1');
    const lines = collected.lines().map((line) => logLineSchema.parse(JSON.parse(line) as unknown));
    expect(lines.some((line) => line.requestId === 'log_line_1')).toBe(true);
  });
});

describe('database probe', () => {
  it('returns false when the probe throws', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        callback();
      },
    });
    const probeLogger = createLogger({ logLevel: 'error' }, stream);
    const up = await checkDatabase(
      {
        $queryRaw: () => Promise.reject(new Error('db down')),
      },
      probeLogger,
    );
    expect(up).toBe(false);
    expect(chunks.join('')).toContain('database health check failed');
  });
});
