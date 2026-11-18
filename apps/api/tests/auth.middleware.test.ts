import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { errorResponseSchema } from '@qc/shared';
import { describe, expect, it } from 'vitest';
import { createAuthMiddleware } from '../src/middleware/auth.js';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import type { AuthState } from '../src/services/token-version-cache.js';
import { createTokenVersionCache } from '../src/services/token-version-cache.js';
import { silentLogger } from './helpers.js';

const secret = 'local-dev-only-jwt-secret-32chars-min';

function sign(claims: {
  sub: string;
  role: 'ADMIN' | 'CUSTOMER';
  ver: number;
  exp?: number;
}): string {
  return jwt.sign(
    { ...claims, jti: randomUUID() },
    secret,
    claims.exp === undefined ? { algorithm: 'HS256', expiresIn: 60 } : { algorithm: 'HS256' },
  );
}

function probe(states: Map<string, AuthState>) {
  const middleware = createAuthMiddleware({
    jwtSecret: secret,
    users: {
      findAuthState(id: string) {
        return Promise.resolve(states.get(id) ?? null);
      },
    },
    cache: createTokenVersionCache(),
  });
  const app = express();
  app.get('/admin', middleware.requireRole('ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/customer', middleware.requireRole('CUSTOMER'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/either', middleware.requireAuth, (req, res) => {
    res.json({ id: req.auth?.id, role: req.auth?.role });
  });
  app.use(createErrorHandler(silentLogger()));
  return app;
}

describe('auth middleware', () => {
  it('returns 401 for a guest, a bad scheme, an expired token, and a revoked version', async () => {
    const id = randomUUID();
    const states = new Map<string, AuthState>([[id, { tokenVersion: 2, isActive: true }]]);
    const app = probe(states);

    expect((await request(app).get('/either')).status).toBe(401);
    expect((await request(app).get('/either').set('Authorization', 'Basic abc')).status).toBe(401);
    expect((await request(app).get('/either').set('Authorization', 'Bearer')).status).toBe(401);

    const expired = sign({
      sub: id,
      role: 'CUSTOMER',
      ver: 2,
      exp: Math.floor(Date.now() / 1000) - 5,
    });
    const expiredResponse = await request(app)
      .get('/either')
      .set('Authorization', `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);
    expect(errorResponseSchema.parse(expiredResponse.body as unknown).error.code).toBe(
      'TOKEN_EXPIRED',
    );

    const stale = sign({ sub: id, role: 'CUSTOMER', ver: 1 });
    const staleResponse = await request(app).get('/either').set('Authorization', `Bearer ${stale}`);
    expect(staleResponse.status).toBe(401);
    expect(errorResponseSchema.parse(staleResponse.body as unknown).error.code).toBe(
      'TOKEN_INVALID',
    );

    const unknown = sign({ sub: randomUUID(), role: 'CUSTOMER', ver: 0 });
    expect(
      (await request(app).get('/either').set('Authorization', `Bearer ${unknown}`)).status,
    ).toBe(401);
  });

  it('enforces roles and rejects an inactive user', async () => {
    const customerId = randomUUID();
    const adminId = randomUUID();
    const inactiveId = randomUUID();
    const states = new Map<string, AuthState>([
      [customerId, { tokenVersion: 0, isActive: true }],
      [adminId, { tokenVersion: 0, isActive: true }],
      [inactiveId, { tokenVersion: 0, isActive: false }],
    ]);
    const app = probe(states);
    const customer = sign({ sub: customerId, role: 'CUSTOMER', ver: 0 });
    const admin = sign({ sub: adminId, role: 'ADMIN', ver: 0 });
    const inactive = sign({ sub: inactiveId, role: 'CUSTOMER', ver: 0 });

    expect((await request(app).get('/admin')).status).toBe(401);
    expect(
      (await request(app).get('/admin').set('Authorization', `Bearer ${customer}`)).status,
    ).toBe(403);
    expect((await request(app).get('/admin').set('Authorization', `Bearer ${admin}`)).status).toBe(
      200,
    );
    expect(
      (await request(app).get('/customer').set('Authorization', `Bearer ${customer}`)).status,
    ).toBe(200);
    expect(
      (await request(app).get('/customer').set('Authorization', `Bearer ${admin}`)).status,
    ).toBe(403);
    expect(
      (await request(app).get('/either').set('Authorization', `Bearer ${inactive}`)).status,
    ).toBe(401);

    const me = await request(app).get('/either').set('Authorization', `Bearer ${customer}`);
    expect(me.body as unknown).toEqual({ id: customerId, role: 'CUSTOMER' });
  });
});
