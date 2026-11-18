import { randomUUID } from 'node:crypto';
import {
  accessTokenResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  meResponseSchema,
} from '@qc/shared';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createSecurity } from '../src/auth/create-security.js';
import { createApp } from '../src/app.js';
import { hashRefreshToken } from '../src/services/token.service.js';
import { createPasswordService } from '../src/services/password.service.js';
import { createRefreshTokenRepository } from '../src/repositories/refresh-token.repository.js';
import { createDatabase } from '../src/lib/prisma.js';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { collectingLogger, silentLogger, testConfig } from './helpers.js';

const logger = silentLogger();
const config = testConfig({ rateLimitAuthMax: 10_000, rateLimitPublicMax: 10_000 });
const database = createDatabase(config.databaseUrl, logger);
const security = createSecurity({ prisma: database.prisma, config, logger });
const app = createApp({
  config,
  logger,
  prisma: database.prisma,
  checkDb: () => Promise.resolve(true),
  security,
});

const probe = express();
probe.get('/admin', security.requireRole('ADMIN'), (_req, res) => {
  res.json({ ok: true });
});
probe.get('/customer', security.requireRole('CUSTOMER'), (_req, res) => {
  res.json({ ok: true });
});
probe.use(createErrorHandler(logger));

afterAll(async () => {
  await database.close();
});

function jsonOf(response: request.Response): unknown {
  return response.body as unknown;
}

function codeOf(response: request.Response): string {
  return errorResponseSchema.parse(jsonOf(response)).error.code;
}

function messageOf(response: request.Response): string {
  return errorResponseSchema.parse(jsonOf(response)).error.message;
}

function sessionOf(response: request.Response) {
  return authSessionSchema.parse(jsonOf(response));
}

function meOf(response: request.Response) {
  return meResponseSchema.parse(jsonOf(response));
}

function refreshCookie(response: request.Response): string {
  const header: unknown = response.headers['set-cookie'];
  const lines = Array.isArray(header)
    ? header.filter((entry): entry is string => typeof entry === 'string')
    : typeof header === 'string'
      ? [header]
      : [];
  const line = lines.find((entry) => entry.startsWith('qc_rt='));
  expect(line, 'refresh cookie').toBeDefined();
  expect(line).toContain('HttpOnly');
  expect(line).toContain('Secure');
  expect(line?.toLowerCase()).toContain('samesite=strict');
  expect(line).toContain('Path=/v1/auth');
  return (line ?? '').split(';')[0] ?? '';
}

function rawToken(cookie: string): string {
  return decodeURIComponent(cookie.slice('qc_rt='.length));
}

function csrf(call: request.Test): request.Test {
  return call.set('X-Requested-With', 'XMLHttpRequest');
}

async function register(target: express.Express = app, email = `user-${randomUUID()}@example.com`) {
  const response = await request(target)
    .post('/v1/auth/signup')
    .send({ name: 'Asha Rao', email, password: 'Password1' });
  return { response, email, password: 'Password1' };
}

describe('auth HTTP', () => {
  it('signs up a customer, ignores a role, and rejects a duplicate email case-insensitively', async () => {
    const email = `Case-${randomUUID()}@Example.com`;
    const created = await request(app).post('/v1/auth/signup').send({
      name: 'Asha Rao',
      email,
      password: 'Password1',
      phone: '+919876543210',
      role: 'ADMIN',
    });
    expect(created.status).toBe(201);
    const session = sessionOf(created);
    expect(session.user).toMatchObject({
      email: email.toLowerCase(),
      name: 'Asha Rao',
      role: 'CUSTOMER',
    });
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(session)).not.toContain('Password1');
    expect(JSON.stringify(session)).not.toContain('$2');
    const cookie = refreshCookie(created);
    const decoded = jwt.decode(session.accessToken);
    expect(decoded).toMatchObject({ role: 'CUSTOMER', ver: 0, sub: session.user.id });

    const row = await database.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(row?.role).toBe('CUSTOMER');
    expect(row?.phone).toBe('+919876543210');
    expect(row?.passwordHash.startsWith('$2')).toBe(true);
    expect(row?.passwordHash.includes('$12$')).toBe(true);
    const stored = await database.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken(cookie)) },
    });
    expect(stored?.tokenHash).not.toBe(rawToken(cookie));
    expect(stored?.userId).toBe(session.user.id);

    const duplicate = await request(app).post('/v1/auth/signup').send({
      name: 'Other',
      email: email.toUpperCase(),
      password: 'Password1',
    });
    expect(duplicate.status).toBe(409);
    expect(codeOf(duplicate)).toBe('EMAIL_TAKEN');
    expect(messageOf(duplicate)).toContain('already exists');
  });

  it('returns 400 for invalid JSON and 422 for a weak password or bad email', async () => {
    const invalid = await request(app)
      .post('/v1/auth/signup')
      .set('Content-Type', 'application/json')
      .send('{"name"');
    expect(invalid.status).toBe(400);
    expect(codeOf(invalid)).toBe('INVALID_JSON');

    const weak = await request(app)
      .post('/v1/auth/signup')
      .send({ name: 'Asha', email: 'asha@example.com', password: 'longpassword' });
    expect(weak.status).toBe(422);
    expect(codeOf(weak)).toBe('VALIDATION');

    const badEmail = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password1' });
    expect(badEmail.status).toBe(422);
    expect(codeOf(badEmail)).toBe('VALIDATION');
  });

  it('logs in with a generic failure and the same message for an unknown or inactive email', async () => {
    const { email } = await register();
    const success = await request(app)
      .post('/v1/auth/login')
      .send({ email: email.toUpperCase(), password: 'Password1' });
    expect(success.status).toBe(200);
    expect(sessionOf(success).user.email).toBe(email);
    refreshCookie(success);

    const wrong = await request(app).post('/v1/auth/login').send({ email, password: 'Password2' });
    const unknown = await request(app)
      .post('/v1/auth/login')
      .send({ email: `missing-${randomUUID()}@example.com`, password: 'Password2' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(codeOf(wrong)).toBe('INVALID_CREDENTIALS');
    expect(messageOf(wrong)).toBe(messageOf(unknown));
    expect(messageOf(wrong)).toBe('Email or password is incorrect');

    await database.prisma.user.update({ where: { email }, data: { isActive: false } });
    const inactive = await request(app)
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' });
    expect(inactive.status).toBe(401);
    expect(messageOf(inactive)).toBe(messageOf(unknown));
  });

  it('rotates refresh tokens and revokes the family when a rotated token is reused', async () => {
    const { response } = await register();
    const first = refreshCookie(response);
    const refreshed = await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', first);
    expect(refreshed.status).toBe(200);
    expect(accessTokenResponseSchema.parse(jsonOf(refreshed)).accessToken).toEqual(
      expect.any(String),
    );
    const second = refreshCookie(refreshed);
    expect(second).not.toBe(first);

    const reused = await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', first);
    expect(reused.status).toBe(401);
    expect(codeOf(reused)).toBe('TOKEN_INVALID');
    const successor = await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', second);
    expect(successor.status).toBe(401);

    const family = await database.prisma.refreshToken.findMany({
      where: { tokenHash: hashRefreshToken(rawToken(second)) },
    });
    expect(family[0]?.revokedReason).toBe('REUSE_DETECTED');
  });

  it('rejects refresh and logout without the CSRF header or from a foreign origin', async () => {
    const { response } = await register();
    const cookie = refreshCookie(response);

    const missing = await request(app).post('/v1/auth/refresh').set('Cookie', cookie);
    expect(missing.status).toBe(403);
    expect(codeOf(missing)).toBe('FORBIDDEN');

    const foreign = await csrf(request(app).post('/v1/auth/logout'))
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example');
    expect(foreign.status).toBe(403);

    const crossSite = await csrf(request(app).post('/v1/auth/refresh'))
      .set('Cookie', cookie)
      .set('Sec-Fetch-Site', 'cross-site');
    expect(crossSite.status).toBe(403);

    const sameOrigin = await csrf(request(app).post('/v1/auth/refresh'))
      .set('Cookie', cookie)
      .set('Host', 'shop.local')
      .set('Origin', 'http://shop.local')
      .set('Sec-Fetch-Site', 'same-origin');
    expect(sameOrigin.status).toBe(200);

    const stillValid = await csrf(request(app).post('/v1/auth/logout')).set(
      'Cookie',
      refreshCookie(sameOrigin),
    );
    expect(stillValid.status).toBe(204);
  });

  it('logs out the current token and then refuses to refresh it', async () => {
    const { response } = await register();
    const cookie = refreshCookie(response);
    const loggedOut = await csrf(request(app).post('/v1/auth/logout')).set('Cookie', cookie);
    expect(loggedOut.status).toBe(204);
    const cleared: unknown = loggedOut.headers['set-cookie'];
    const clearedLine = Array.isArray(cleared)
      ? cleared.filter((entry): entry is string => typeof entry === 'string').join(' ')
      : typeof cleared === 'string'
        ? cleared
        : '';
    expect(clearedLine.toLowerCase()).toContain('qc_rt=');
    expect(clearedLine).toContain('Path=/v1/auth');

    const again = await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', cookie);
    expect(again.status).toBe(401);
    const row = await database.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken(cookie)) },
    });
    expect(row?.revokedReason).toBe('LOGOUT');

    const empty = await csrf(request(app).post('/v1/auth/logout'));
    expect(empty.status).toBe(204);
    const noCookie = await csrf(request(app).post('/v1/auth/refresh'));
    expect(noCookie.status).toBe(401);
  });

  it('logout-all bumps token_version and revokes every refresh token immediately', async () => {
    const { response } = await register();
    const firstCookie = refreshCookie(response);
    const firstSession = sessionOf(response);
    const access = firstSession.accessToken;
    const userId = firstSession.user.id;
    const warmed = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${access}`);
    expect(warmed.status).toBe(200);
    expect(meOf(warmed).user.lastAddress).toBeNull();

    const second = await request(app)
      .post('/v1/auth/login')
      .send({ email: firstSession.user.email, password: 'Password1' });
    const secondCookie = refreshCookie(second);

    const blocked = await request(app)
      .post('/v1/auth/logout-all')
      .set('Authorization', `Bearer ${access}`);
    expect(blocked.status).toBe(403);
    expect((await database.prisma.user.findUnique({ where: { id: userId } }))?.tokenVersion).toBe(
      0,
    );

    const done = await csrf(request(app).post('/v1/auth/logout-all')).set(
      'Authorization',
      `Bearer ${access}`,
    );
    expect(done.status).toBe(204);
    const row = await database.prisma.user.findUnique({ where: { id: userId } });
    expect(row?.tokenVersion).toBe(1);

    const me = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${access}`);
    expect(me.status).toBe(401);
    const secondMe = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${sessionOf(second).accessToken}`);
    expect(secondMe.status).toBe(401);
    expect(
      (await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', firstCookie)).status,
    ).toBe(401);
    expect(
      (await csrf(request(app).post('/v1/auth/refresh')).set('Cookie', secondCookie)).status,
    ).toBe(401);
    const tokens = await database.prisma.refreshToken.findMany({ where: { userId } });
    expect(tokens.every((token) => token.revokedReason === 'LOGOUT_ALL')).toBe(true);
  });

  it('returns the latest order address from me', async () => {
    const { response } = await register();
    const signedUp = sessionOf(response);
    const userId = signedUp.user.id;
    const access = signedUp.accessToken;
    await database.prisma.order.create({
      data: {
        orderNumber: `QC-20261118-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        userId,
        idempotencyKey: randomUUID(),
        requestHash: 'a'.repeat(64),
        itemCount: 1,
        subtotalPaise: 2800,
        deliveryFeePaise: 0,
        totalPaise: 2800,
        shipName: 'Old Name',
        shipPhone: '+919800000000',
        shipLine1: '1 Old Street',
        shipCity: 'Bengaluru',
        shipState: 'KA',
        shipPincode: '560001',
        placedAt: new Date('2026-11-17T00:00:00.000Z'),
      },
    });
    await database.prisma.order.create({
      data: {
        orderNumber: `QC-20261118-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        userId,
        idempotencyKey: randomUUID(),
        requestHash: 'b'.repeat(64),
        itemCount: 1,
        subtotalPaise: 4500,
        deliveryFeePaise: 2500,
        totalPaise: 7000,
        shipName: 'Asha Rao',
        shipPhone: '+919876543210',
        shipLine1: '12 Residency Road',
        shipLine2: null,
        shipCity: 'Bengaluru',
        shipState: 'Karnataka',
        shipPincode: '560002',
        placedAt: new Date('2026-11-18T00:00:00.000Z'),
      },
    });
    const me = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${access}`);
    expect(me.status).toBe(200);
    expect(meOf(me).user.lastAddress).toEqual({
      name: 'Asha Rao',
      phone: '+919876543210',
      line1: '12 Residency Road',
      line2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560002',
    });
    expect((await request(app).get('/v1/auth/me')).status).toBe(401);
  });

  it('locks an account and an unknown email for 15 minutes, then unlocks', async () => {
    let current = new Date('2026-11-18T03:00:00.000Z');
    const clock = createApp({
      config,
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
      now: () => new Date(current.getTime()),
    });
    const email = `lock-${randomUUID()}@example.com`;
    expect(
      (
        await request(clock)
          .post('/v1/auth/signup')
          .send({ name: 'Asha', email, password: 'Password1' })
      ).status,
    ).toBe(201);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await request(clock)
        .post('/v1/auth/login')
        .send({ email, password: 'Wrongpass1' });
      expect(failed.status).toBe(401);
    }
    const lockedWrong = await request(clock)
      .post('/v1/auth/login')
      .send({ email, password: 'Wrongpass1' });
    expect(lockedWrong.status).toBe(423);
    expect(codeOf(lockedWrong)).toBe('ACCOUNT_LOCKED');
    expect(errorResponseSchema.parse(jsonOf(lockedWrong)).error.details).toEqual([
      { retryAfter: 900 },
    ]);
    expect(lockedWrong.headers['retry-after'] as unknown).toBe('900');

    const lockedRight = await request(clock)
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' });
    expect(lockedRight.status).toBe(423);
    expect(messageOf(lockedRight)).toBe(messageOf(lockedWrong));

    const unknownEmail = `nobody-${randomUUID()}@example.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(clock)
        .post('/v1/auth/login')
        .send({ email: unknownEmail, password: 'Wrongpass1' });
    }
    const unknownLocked = await request(clock)
      .post('/v1/auth/login')
      .send({ email: unknownEmail, password: 'Password1' });
    expect(unknownLocked.status).toBe(423);
    expect(messageOf(unknownLocked)).toBe(messageOf(lockedWrong));

    current = new Date('2026-11-18T03:15:01.000Z');
    const unlocked = await request(clock)
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' });
    expect(unlocked.status).toBe(200);
    const unknownAgain = await request(clock)
      .post('/v1/auth/login')
      .send({ email: unknownEmail, password: 'Password1' });
    expect(unknownAgain.status).toBe(401);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const reset = await request(clock)
        .post('/v1/auth/login')
        .send({ email, password: 'Wrongpass1' });
      expect(reset.status).toBe(401);
    }
    const lockedAgain = await request(clock)
      .post('/v1/auth/login')
      .send({ email, password: 'Wrongpass1' });
    expect(lockedAgain.status).toBe(423);
  });

  it('logs an admin failure without the password and keeps a customer failure quiet', async () => {
    const collected = collectingLogger();
    const logged = createApp({
      config,
      logger: collected.logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    const adminEmail = `admin-${randomUUID()}@example.com`;
    const passwordHash = await createPasswordService().hash('Adminpass1');
    await database.prisma.user.create({
      data: { email: adminEmail, passwordHash, name: 'Ops', role: 'ADMIN' },
    });
    const failed = await request(logged)
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: 'Wrongpass1' });
    expect(failed.status).toBe(401);
    const lines = collected.lines().join('\n');
    expect(lines).toContain('admin login failed');
    expect(lines).not.toContain('Wrongpass1');
    expect(lines).not.toContain(passwordHash);

    const customer = await register(logged);
    const before = collected.lines().length;
    await request(logged)
      .post('/v1/auth/login')
      .send({ email: customer.email, password: 'Wrongpass1' });
    const added = collected.lines().slice(before).join('\n');
    expect(added).not.toContain('admin login failed');
    expect(added).not.toContain('Wrongpass1');
  });

  it('returns 401 for a guest and 403 for a customer on an admin role check', async () => {
    const { response } = await register();
    const customer = sessionOf(response).accessToken;
    expect((await request(probe).get('/admin')).status).toBe(401);
    const forbidden = await request(probe).get('/admin').set('Authorization', `Bearer ${customer}`);
    expect(forbidden.status).toBe(403);
    expect(codeOf(forbidden)).toBe('FORBIDDEN');
    expect(
      (await request(probe).get('/customer').set('Authorization', `Bearer ${customer}`)).status,
    ).toBe(200);

    const adminEmail = `rbac-admin-${randomUUID()}@example.com`;
    const passwordHash = await createPasswordService().hash('Adminpass1');
    await database.prisma.user.create({
      data: { email: adminEmail, passwordHash, name: 'Ops', role: 'ADMIN' },
    });
    const adminLogin = await request(app)
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: 'Adminpass1' });
    expect(adminLogin.status).toBe(200);
    const adminSession = sessionOf(adminLogin);
    expect(adminSession.user.role).toBe('ADMIN');
    expect(
      (
        await request(probe)
          .get('/admin')
          .set('Authorization', `Bearer ${adminSession.accessToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(probe)
          .get('/customer')
          .set('Authorization', `Bearer ${adminSession.accessToken}`)
      ).status,
    ).toBe(403);
  });

  it('rate limits the 11th auth request from one IP', async () => {
    const limited = createApp({
      config: testConfig({ rateLimitAuthMax: 10, rateLimitPublicMax: 100 }),
      logger,
      prisma: database.prisma,
      checkDb: () => Promise.resolve(true),
    });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(limited).post('/v1/auth/login').send({});
      expect(response.status).toBe(422);
    }
    const blocked = await request(limited).post('/v1/auth/login').send({
      email: 'a@b.co',
      password: 'Password1',
    });
    expect(blocked.status).toBe(429);
    expect(codeOf(blocked)).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after'] as unknown).toEqual(expect.any(String));
  });

  it('claimForRotation returns false once the token is already revoked', async () => {
    const { response } = await register();
    const cookie = refreshCookie(response);
    await csrf(request(app).post('/v1/auth/logout')).set('Cookie', cookie);
    const row = await database.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(rawToken(cookie)) },
    });
    const repo = createRefreshTokenRepository(database.prisma);
    await expect(repo.claimForRotation(row.id, row.id, new Date())).resolves.toBe(false);
  });
});
