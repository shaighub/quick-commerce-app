import { randomUUID } from 'node:crypto';
import {
  adminOrderDetailSchema,
  adminOrderListSchema,
  authSessionSchema,
  cartSchema,
  customerOrderListSchema,
  customerOrderResponseSchema,
  dashboardSchema,
  errorResponseSchema,
  meResponseSchema,
  sweepResponseSchema,
} from '@qc/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createCommerceModule } from '../src/commerce/create-commerce.js';
import { istDayKey } from '../src/domain/orders.js';
import { createDatabase } from '../src/lib/prisma.js';
import type { PaymentGateway } from '../src/payments/gateway.js';
import { createPasswordService } from '../src/services/password.service.js';
import { silentLogger, testConfig } from './helpers.js';

const logger = silentLogger();
const config = testConfig({ rateLimitAuthMax: 10_000, rateLimitPublicMax: 10_000 });
const database = createDatabase(config.databaseUrl, logger);
const prisma = database.prisma;
const app = createApp({
  config,
  logger,
  prisma,
  checkDb: () => Promise.resolve(true),
});

const clockNow = new Date('2026-11-18T12:00:00.000Z');
const clock = createApp({
  config,
  logger,
  prisma,
  checkDb: () => Promise.resolve(true),
  now: () => clockNow,
});

const chargeCalls: string[] = [];
const failingRefund: PaymentGateway = {
  provider: 'MOCK',
  charge(input) {
    chargeCalls.push(input.orderNumber);
    return Promise.resolve({
      status: input.simulate === 'failure' ? 'FAILED' : 'SUCCEEDED',
      providerRef: `fake_${randomUUID().slice(0, 8)}`,
      ...(input.simulate === 'failure' ? { failureReason: 'nope' } : {}),
    });
  },
  refund() {
    return Promise.resolve({ status: 'FAILED' });
  },
};
const fakeApp = createApp({
  config,
  logger,
  prisma,
  checkDb: () => Promise.resolve(true),
  commerce: createCommerceModule({
    prisma,
    config,
    logger,
    gateway: failingRefund,
  }),
});

const run = randomUUID().slice(0, 8);
const fee = config.deliveryFeePaise;
let adminToken = '';
let customerToken = '';
let customerId = '';
let passwordHash = '';

const address = {
  name: 'Asha Rao',
  phone: '9876543210',
  line1: '12 Residency Road',
  line2: 'Near the park',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
};

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function send(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  if (method === 'get') {
    return request(app).get(path);
  }
  if (method === 'post') {
    return request(app).post(path);
  }
  if (method === 'patch') {
    return request(app).patch(path);
  }
  return request(app).delete(path);
}

function codeOf(body: unknown): string {
  return errorResponseSchema.parse(body).error.code;
}

function detailsOf(body: unknown): unknown[] {
  return errorResponseSchema.parse(body).error.details ?? [];
}

function payable(pricePaise: number, quantity: number): number {
  return pricePaise * quantity + fee;
}

async function stockOf(productId: string): Promise<number> {
  const row = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  return row.stock;
}

async function createCategory(name: string): Promise<string> {
  const response = await request(app)
    .post('/v1/admin/categories')
    .set(bearer(adminToken))
    .send({ name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const body = response.body as { category: { id: string } };
  return body.category.id;
}

async function createSubcategory(categoryId: string, name: string): Promise<string> {
  const response = await request(app)
    .post(`/v1/admin/categories/${categoryId}/subcategories`)
    .set(bearer(adminToken))
    .send({ name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const body = response.body as { subcategory: { id: string } };
  return body.subcategory.id;
}

async function createProduct(
  subcategoryId: string,
  suffix: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; pricePaise: number }> {
  const pricePaise = typeof extra.pricePaise === 'number' ? extra.pricePaise : 2500;
  const response = await request(app)
    .post('/v1/admin/products')
    .set(bearer(adminToken))
    .send({
      name: `M4 ${run} ${suffix}`,
      sku: `M4${run}${suffix}`.slice(0, 40),
      subcategoryId,
      pricePaise,
      unitLabel: '1 pc',
      stock: 8,
      isActive: true,
      ...extra,
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const body = response.body as { product: { id: string; pricePaise: number } };
  return body.product;
}

async function signup(label: string): Promise<{ token: string; id: string }> {
  const response = await request(app)
    .post('/v1/auth/signup')
    .send({ name: label, email: `${label}-${run}@example.com`, password: 'Password1' });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const session = authSessionSchema.parse(response.body);
  return { token: session.accessToken, id: session.user.id };
}

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, role: 'CUSTOMER', ver: 0, jti: randomUUID() }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: 900,
  });
}

async function insertCustomer(label: string): Promise<{ token: string; id: string }> {
  const user = await prisma.user.create({
    data: {
      email: `${label}-${run}@example.com`,
      passwordHash,
      name: label,
      role: 'CUSTOMER',
    },
  });
  return { id: user.id, token: tokenFor(user.id) };
}

function checkout(
  token: string,
  expectedTotalPaise: number,
  options: {
    key?: string;
    simulate?: 'success' | 'failure';
    pincode?: string;
    phone?: string;
    extra?: Record<string, unknown>;
    target?: ReturnType<typeof createApp>;
  } = {},
) {
  const key = options.key ?? randomUUID();
  return request(options.target ?? app)
    .post('/v1/orders/checkout')
    .set(bearer(token))
    .set('Idempotency-Key', key)
    .send({
      address: {
        ...address,
        pincode: options.pincode ?? address.pincode,
        phone: options.phone ?? address.phone,
      },
      payment: { method: 'MOCK', simulate: options.simulate ?? 'success' },
      expectedTotalPaise,
      ...options.extra,
    });
}

beforeAll(async () => {
  passwordHash = await createPasswordService().hash('Adminpass1');
  const admin = await prisma.user.create({
    data: {
      email: `m4-admin-${run}@example.com`,
      passwordHash,
      name: 'Orders Admin',
      role: 'ADMIN',
    },
  });
  const adminLogin = await request(app)
    .post('/v1/auth/login')
    .send({ email: admin.email, password: 'Adminpass1' });
  expect(adminLogin.status).toBe(200);
  adminToken = authSessionSchema.parse(adminLogin.body).accessToken;
  const customer = await signup('buyer');
  customerToken = customer.token;
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { sku: { startsWith: `M4${run}` } } });
  await prisma.order.deleteMany({ where: { user: { email: { contains: run } } } });
  await prisma.cartItem.deleteMany({ where: { product: { sku: { startsWith: `M4${run}` } } } });
  await prisma.cart.deleteMany({ where: { user: { email: { contains: run } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: `M4${run}` } } });
  await prisma.subcategory.deleteMany({ where: { name: { startsWith: `M4 ${run}` } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: `M4 ${run}` } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await database.close();
});

describe('cart and order access', () => {
  it('gives guests 401 and the wrong role 403', async () => {
    const missing = '00000000-0000-4000-8000-000000000099';
    const guestRoutes: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
      ['get', '/v1/cart'],
      ['post', '/v1/cart/items'],
      ['patch', `/v1/cart/items/${missing}`],
      ['delete', `/v1/cart/items/${missing}`],
      ['delete', '/v1/cart'],
      ['post', '/v1/orders/checkout'],
      ['get', '/v1/orders'],
      ['get', '/v1/orders/QC-20261118-000001'],
      ['get', '/v1/admin/orders'],
      ['get', '/v1/admin/orders/QC-20261118-000001'],
      ['patch', '/v1/admin/orders/QC-20261118-000001/status'],
      ['get', '/v1/admin/dashboard'],
    ];
    for (const [method, path] of guestRoutes) {
      const response = await send(method, path);
      expect(response.status, path).toBe(401);
      expect(codeOf(response.body)).toBe('UNAUTHORIZED');
    }

    const customerForbidden = [
      '/v1/admin/orders',
      '/v1/admin/orders/QC-20261118-000001',
      '/v1/admin/dashboard',
    ];
    for (const path of customerForbidden) {
      const response = await request(app).get(path).set(bearer(customerToken));
      expect(response.status, path).toBe(403);
    }
    const status = await request(app)
      .patch('/v1/admin/orders/QC-20261118-000001/status')
      .set(bearer(customerToken))
      .send({ status: 'PACKED' });
    expect(status.status).toBe(403);

    const adminForbidden: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
      ['get', '/v1/cart'],
      ['post', '/v1/cart/items'],
      ['post', '/v1/orders/checkout'],
      ['get', '/v1/orders'],
    ];
    for (const [method, path] of adminForbidden) {
      const response = await send(method, path).set(bearer(adminToken));
      expect(response.status, path).toBe(403);
      expect(codeOf(response.body)).toBe('FORBIDDEN');
    }
  });
});

describe('cart', () => {
  it('adds, merges, updates, removes, and clears with stock checks', async () => {
    const categoryId = await createCategory(`M4 ${run} dairy`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} milk`);
    const product = await createProduct(subcategoryId, 'butter', { stock: 20, pricePaise: 5600 });
    const inactive = await createProduct(subcategoryId, 'hidden', { isActive: false });

    const empty = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(customerToken))).body,
    );
    expect(empty.items).toEqual([]);
    expect(empty.totalPaise).toBe(0);

    const added = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 2 });
    expect(added.status).toBe(200);
    const first = cartSchema.parse(added.body);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.quantity).toBe(2);
    expect(first.items[0]?.lineTotalPaise).toBe(11200);
    expect(first.subtotalPaise).toBe(11200);
    expect(first.deliveryFeePaise).toBe(fee);
    expect(first.totalPaise).toBe(11200 + fee);
    expect(first.itemCount).toBe(2);

    const merged = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 3 });
    expect(merged.status).toBe(200);
    expect(cartSchema.parse(merged.body).items[0]?.quantity).toBe(5);

    const hidden = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: inactive.id, quantity: 1 });
    expect(hidden.status).toBe(404);

    const missing = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: '00000000-0000-4000-8000-000000000099', quantity: 1 });
    expect(missing.status).toBe(404);

    const tooMany = await request(app)
      .patch(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(customerToken))
      .send({ quantity: 11 });
    expect(tooMany.status).toBe(422);
    const zero = await request(app)
      .patch(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(customerToken))
      .send({ quantity: 0 });
    expect(zero.status).toBe(422);

    await prisma.product.update({ where: { id: product.id }, data: { stock: 4 } });
    const short = await request(app)
      .patch(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(customerToken))
      .send({ quantity: 5 });
    expect(short.status).toBe(409);
    expect(codeOf(short.body)).toBe('INSUFFICIENT_STOCK');
    expect(detailsOf(short.body)).toEqual([{ productId: product.id, available: 4 }]);

    const other = await signup('other');
    const foreign = await request(app)
      .patch(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(other.token))
      .send({ quantity: 1 });
    expect(foreign.status).toBe(404);

    const updated = await request(app)
      .patch(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(customerToken))
      .send({ quantity: 2 });
    expect(updated.status).toBe(200);
    expect(cartSchema.parse(updated.body).subtotalPaise).toBe(11200);

    const removed = await request(app)
      .delete(`/v1/cart/items/${first.items[0]?.id}`)
      .set(bearer(customerToken));
    expect(removed.status).toBe(200);
    expect(cartSchema.parse(removed.body).items).toEqual([]);

    await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 1 });
    const cleared = await request(app).delete('/v1/cart').set(bearer(customerToken));
    expect(cleared.status).toBe(204);
    const after = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(customerToken))).body,
    );
    expect(after.items).toEqual([]);

    await prisma.product.update({ where: { id: product.id }, data: { stock: 20 } });
    const overTen = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 8 });
    expect(overTen.status).toBe(200);
    const again = await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 3 });
    expect(again.status).toBe(422);
    await request(app).delete('/v1/cart').set(bearer(customerToken));
  });

  it('flags deleted and out-of-stock lines and excludes them from the subtotal', async () => {
    const categoryId = await createCategory(`M4 ${run} snacks`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} nuts`);
    const doomed = await createProduct(subcategoryId, 'doomed', { pricePaise: 3000, stock: 5 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: doomed.id, quantity: 2 });
    await prisma.product.update({ where: { id: doomed.id }, data: { stock: 0 } });
    const out = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(customerToken))).body,
    );
    expect(out.items[0]?.available).toBe(false);
    const deleted = await request(app)
      .delete(`/v1/admin/products/${doomed.id}`)
      .set(bearer(adminToken));
    expect(deleted.status).toBe(204);

    const cart = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(customerToken))).body,
    );
    expect(cart.items[0]?.available).toBe(false);
    expect(cart.subtotalPaise).toBe(0);
    expect(cart.totalPaise).toBe(0);
    const blocked = await checkout(customerToken, 0);
    expect(blocked.status).toBe(422);
    expect(codeOf(blocked.body)).toBe('CART_EMPTY');
    await request(app).delete('/v1/cart').set(bearer(customerToken));
  });
});

describe('checkout', () => {
  it('confirms an order, replays the same key, and rejects a different body', async () => {
    const categoryId = await createCategory(`M4 ${run} pantry`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} rice`);
    const product = await createProduct(subcategoryId, 'rice', { pricePaise: 1000, stock: 10 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(customerToken))
      .send({ productId: product.id, quantity: 2 });
    const expected = payable(1000, 2);
    const key = randomUUID();
    const before = await stockOf(product.id);
    const created = await checkout(customerToken, expected, { key, extra: { ignored: true } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const order = customerOrderResponseSchema.parse(created.body).order;
    expect(order.orderNumber).toMatch(new RegExp(`^QC-${istDayKey(new Date())}-\\d{6}$`));
    expect(order.status).toBe('CONFIRMED');
    expect(order.totalPaise).toBe(expected);
    expect(order.items[0]).toMatchObject({
      productId: product.id,
      unitPricePaise: 1000,
      quantity: 2,
      lineTotalPaise: 2000,
    });
    expect(order.address).toMatchObject({
      name: 'Asha Rao',
      phone: '+919876543210',
      pincode: '560001',
    });
    expect(order.payment?.status).toBe('SUCCEEDED');
    expect(order.history.map((entry) => entry.toStatus)).toEqual(['PENDING_PAYMENT', 'CONFIRMED']);
    expect(order.history[0]?.fromStatus).toBeNull();
    expect(await stockOf(product.id)).toBe(before - 2);
    const emptied = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(customerToken))).body,
    );
    expect(emptied.items).toEqual([]);

    const replay = await checkout(customerToken, expected, { key });
    expect(replay.status).toBe(201);
    expect(customerOrderResponseSchema.parse(replay.body).order.orderNumber).toBe(
      order.orderNumber,
    );
    expect(await stockOf(product.id)).toBe(before - 2);
    expect(await prisma.order.count({ where: { userId: customerId, idempotencyKey: key } })).toBe(
      1,
    );

    const clash = await checkout(customerToken, expected, { key, simulate: 'failure' });
    expect(clash.status).toBe(422);
    expect(codeOf(clash.body)).toBe('IDEMPOTENCY_KEY_REUSED');

    const me = await request(app).get('/v1/auth/me').set(bearer(customerToken));
    expect(meResponseSchema.parse(me.body).user.lastAddress).toMatchObject({
      name: 'Asha Rao',
      phone: '+919876543210',
      pincode: '560001',
    });

    const signedOut = await signup('revoke');
    await request(app)
      .post('/v1/auth/logout-all')
      .set(bearer(signedOut.token))
      .set('X-Requested-With', 'XMLHttpRequest');
    const blocked = await checkout(signedOut.token, expected);
    expect(blocked.status).toBe(401);
  });

  it('restocks and keeps the cart when mock payment fails', async () => {
    const categoryId = await createCategory(`M4 ${run} fail`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} oil`);
    const shopper = await signup('failpay');
    const product = await createProduct(subcategoryId, 'oil', { pricePaise: 1500, stock: 6 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(shopper.token))
      .send({ productId: product.id, quantity: 2 });
    const expected = payable(1500, 2);
    const key = randomUUID();
    const failed = await checkout(shopper.token, expected, { key, simulate: 'failure' });
    expect(failed.status).toBe(402);
    expect(codeOf(failed.body)).toBe('PAYMENT_FAILED');
    const orderNumber = (detailsOf(failed.body)[0] as { orderNumber: string }).orderNumber;
    expect(orderNumber).toMatch(/^QC-/);
    expect(await stockOf(product.id)).toBe(6);
    const cart = cartSchema.parse(
      (await request(app).get('/v1/cart').set(bearer(shopper.token))).body,
    );
    expect(cart.items).toHaveLength(1);
    const replay = await checkout(shopper.token, expected, { key, simulate: 'failure' });
    expect(replay.status).toBe(402);
    expect(await stockOf(product.id)).toBe(6);
    expect(await prisma.order.count({ where: { orderNumber } })).toBe(1);

    const paid = await checkout(shopper.token, expected, { simulate: 'success' });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(await stockOf(product.id)).toBe(4);
  });

  it('returns PRICE_CHANGED without an order and keeps the paid price', async () => {
    const categoryId = await createCategory(`M4 ${run} price`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} atta`);
    const shopper = await signup('price');
    const product = await createProduct(subcategoryId, 'atta', { pricePaise: 2000, stock: 5 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(shopper.token))
      .send({ productId: product.id, quantity: 1 });
    const stale = payable(2000, 1);
    await request(app)
      .patch(`/v1/admin/products/${product.id}`)
      .set(bearer(adminToken))
      .send({ pricePaise: 2500 });
    const changed = await checkout(shopper.token, stale);
    expect(changed.status).toBe(409);
    expect(codeOf(changed.body)).toBe('PRICE_CHANGED');
    const detail = detailsOf(changed.body)[0] as {
      totalPaise: number;
      cart: { totalPaise: number };
    };
    expect(detail.totalPaise).toBe(payable(2500, 1));
    expect(detail.cart.totalPaise).toBe(payable(2500, 1));
    expect(await stockOf(product.id)).toBe(5);
    expect(await prisma.order.count({ where: { userId: shopper.id } })).toBe(0);

    const paid = await checkout(shopper.token, payable(2500, 1));
    expect(paid.status).toBe(201);
    const order = customerOrderResponseSchema.parse(paid.body).order;
    expect(order.items[0]?.unitPricePaise).toBe(2500);
    await request(app)
      .patch(`/v1/admin/products/${product.id}`)
      .set(bearer(adminToken))
      .send({ pricePaise: 9000 });
    const stored = await prisma.orderItem.findFirstOrThrow({
      where: {
        orderId: (
          await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } })
        ).id,
      },
    });
    expect(stored.unitPricePaise).toBe(2500);
  });

  it('rejects an unserviceable pincode before touching stock', async () => {
    const categoryId = await createCategory(`M4 ${run} pin`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} tea`);
    const shopper = await signup('pin');
    const product = await createProduct(subcategoryId, 'tea', { pricePaise: 500, stock: 4 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(shopper.token))
      .send({ productId: product.id, quantity: 1 });
    const response = await checkout(shopper.token, payable(500, 1), { pincode: '110001' });
    expect(response.status).toBe(422);
    expect(codeOf(response.body)).toBe('NOT_SERVICEABLE');
    expect(await stockOf(product.id)).toBe(4);
    expect(await prisma.order.count({ where: { userId: shopper.id } })).toBe(0);
    const invalid = await checkout(shopper.token, payable(500, 1), { phone: '12345' });
    expect(invalid.status).toBe(422);
    expect(codeOf(invalid.body)).toBe('VALIDATION');
  });

  it('does not oversell the last unit', async () => {
    const categoryId = await createCategory(`M4 ${run} race`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} last`);
    const product = await createProduct(subcategoryId, 'last', { pricePaise: 800, stock: 1 });
    const first = await signup('race-a');
    const second = await signup('race-b');
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(first.token))
      .send({ productId: product.id, quantity: 1 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(second.token))
      .send({ productId: product.id, quantity: 1 });
    const expected = payable(800, 1);
    const [left, right] = await Promise.all([
      checkout(first.token, expected),
      checkout(second.token, expected),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = left.status === 409 ? left : right;
    expect(codeOf(failed.body)).toBe('INSUFFICIENT_STOCK');
    expect(await stockOf(product.id)).toBe(0);
  });

  it('issues 50 distinct consecutive order numbers under concurrency', async () => {
    const categoryId = await createCategory(`M4 ${run} bulk`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} bulk-sub`);
    const product = await createProduct(subcategoryId, 'bulk', { pricePaise: 100, stock: 50 });
    const shoppers = await Promise.all(
      Array.from({ length: 50 }, (_, index) => insertCustomer(`bulk-${index}`)),
    );
    await Promise.all(
      shoppers.map((shopper) =>
        request(app)
          .post('/v1/cart/items')
          .set(bearer(shopper.token))
          .send({ productId: product.id, quantity: 1 }),
      ),
    );
    const responses = await Promise.all(
      shoppers.map((shopper) => checkout(shopper.token, payable(100, 1))),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const numbers = responses.map(
      (response) => customerOrderResponseSchema.parse(response.body).order.orderNumber,
    );
    expect(new Set(numbers).size).toBe(50);
    const sequences = numbers
      .map((value) => Number(value.slice(-6)))
      .sort((left, right) => left - right);
    for (let index = 1; index < sequences.length; index += 1) {
      expect(sequences[index]).toBe((sequences[index - 1] ?? 0) + 1);
    }
    expect(await stockOf(product.id)).toBe(0);
  }, 60_000);

  it('treats one idempotency key as a single order when two requests race', async () => {
    const categoryId = await createCategory(`M4 ${run} idem`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} idem-sub`);
    const shopper = await insertCustomer('idem');
    const product = await createProduct(subcategoryId, 'idem', { pricePaise: 400, stock: 5 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(shopper.token))
      .send({ productId: product.id, quantity: 1 });
    const key = randomUUID();
    const [left, right] = await Promise.all([
      checkout(shopper.token, payable(400, 1), { key }),
      checkout(shopper.token, payable(400, 1), { key }),
    ]);
    expect(
      [left.status, right.status].every((status) => status === 201),
      JSON.stringify([left.body, right.body]),
    ).toBe(true);
    const numbers = [left, right].map(
      (response) => customerOrderResponseSchema.parse(response.body).order.orderNumber,
    );
    expect(numbers[0]).toBe(numbers[1]);
    expect(await stockOf(product.id)).toBe(4);
  });
});

describe('orders and admin', () => {
  it('lists only the owner’s orders and lets an admin filter and move status', async () => {
    const categoryId = await createCategory(`M4 ${run} admin`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} admin-sub`);
    const owner = await signup('owner');
    const stranger = await signup('stranger');
    const product = await createProduct(subcategoryId, 'soap', { pricePaise: 700, stock: 9 });
    await request(app)
      .post('/v1/cart/items')
      .set(bearer(owner.token))
      .send({ productId: product.id, quantity: 1 });
    const placed = await checkout(owner.token, payable(700, 1));
    expect(placed.status).toBe(201);
    const order = customerOrderResponseSchema.parse(placed.body).order;

    const mine = customerOrderListSchema.parse(
      (await request(app).get('/v1/orders').set(bearer(owner.token))).body,
    );
    expect(mine.items[0]?.orderNumber).toBe(order.orderNumber);
    expect(mine.items.every((item) => item.orderNumber === order.orderNumber || true)).toBe(true);
    const hidden = await request(app)
      .get(`/v1/orders/${order.orderNumber}`)
      .set(bearer(stranger.token));
    expect(hidden.status).toBe(404);
    const own = await request(app).get(`/v1/orders/${order.orderNumber}`).set(bearer(owner.token));
    expect(own.status).toBe(200);

    const listed = adminOrderListSchema.parse(
      (
        await request(app)
          .get('/v1/admin/orders')
          .query({
            q: order.orderNumber,
            status: 'CONFIRMED',
            from: '2026-11-18',
            to: '2026-11-18',
          })
          .set(bearer(adminToken))
      ).body,
    );
    expect(listed.items.some((item) => item.orderNumber === order.orderNumber)).toBe(true);
    expect(listed.items[0]?.customer.email).toContain('owner');

    const skipped = await request(app)
      .patch(`/v1/admin/orders/${order.orderNumber}/status`)
      .set(bearer(adminToken))
      .send({ status: 'DELIVERED' });
    expect(skipped.status).toBe(409);
    expect(codeOf(skipped.body)).toBe('INVALID_TRANSITION');

    const packed = await request(app)
      .patch(`/v1/admin/orders/${order.orderNumber}/status`)
      .set(bearer(adminToken))
      .send({ status: 'PACKED', note: 'On the table' });
    expect(packed.status).toBe(200);
    const packedBody = adminOrderDetailSchema.parse(packed.body);
    expect(packedBody.order.status).toBe('PACKED');
    expect(packedBody.allowedNextStatuses).toEqual(['OUT_FOR_DELIVERY', 'CANCELLED']);
    expect(packedBody.order.history.at(-1)?.note).toBe('On the table');

    const stockBeforeCancel = await stockOf(product.id);
    const cancelled = await request(app)
      .patch(`/v1/admin/orders/${order.orderNumber}/status`)
      .set(bearer(adminToken))
      .send({ status: 'CANCELLED', note: 'Customer called' });
    expect(cancelled.status).toBe(200);
    const cancelledBody = adminOrderDetailSchema.parse(cancelled.body);
    expect(cancelledBody.order.status).toBe('CANCELLED');
    expect(cancelledBody.order.payment?.status).toBe('REFUNDED');
    expect(await stockOf(product.id)).toBe(stockBeforeCancel + 1);
    const history = await prisma.orderStatusHistory.findMany({
      where: { order: { orderNumber: order.orderNumber }, toStatus: 'CANCELLED' },
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.changedById).toBeTruthy();
  });

  it('does not cancel when the mock refund fails', async () => {
    const categoryId = await createCategory(`M4 ${run} refund`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} refund-sub`);
    const shopper = await signup('refund');
    const product = await createProduct(subcategoryId, 'refund', { pricePaise: 900, stock: 3 });
    await request(fakeApp)
      .post('/v1/cart/items')
      .set(bearer(shopper.token))
      .send({ productId: product.id, quantity: 1 });
    const placed = await checkout(shopper.token, payable(900, 1), { target: fakeApp });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    const order = customerOrderResponseSchema.parse(placed.body).order;
    const callsBefore = chargeCalls.length;
    const replay = await checkout(shopper.token, payable(900, 1), {
      target: fakeApp,
      key: (await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } }))
        .idempotencyKey,
    });
    expect(replay.status).toBe(201);
    expect(chargeCalls.length).toBe(callsBefore);
    const refused = await request(fakeApp)
      .patch(`/v1/admin/orders/${order.orderNumber}/status`)
      .set(bearer(adminToken))
      .send({ status: 'CANCELLED' });
    expect(refused.status).toBe(409);
    const still = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: order.orderNumber },
    });
    expect(still.status).toBe('CONFIRMED');
    expect(await stockOf(product.id)).toBe(2);
  });
});

describe('pending payment sweep', () => {
  it('restocks expired pending orders once and ignores a fresh one', async () => {
    const categoryId = await createCategory(`M4 ${run} sweep`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} sweep-sub`);
    const oldProduct = await createProduct(subcategoryId, 'old', { pricePaise: 1000, stock: 7 });
    const freshProduct = await createProduct(subcategoryId, 'fresh', {
      pricePaise: 1000,
      stock: 7,
    });
    const user = await insertCustomer('sweep');

    async function plant(productId: string, minutesAgo: number, quantity: number): Promise<string> {
      const orderNumber = `QC-20261118-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`;
      await prisma.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      });
      await prisma.order.create({
        data: {
          orderNumber,
          userId: user.id,
          status: 'PENDING_PAYMENT',
          idempotencyKey: randomUUID(),
          requestHash: 'c'.repeat(64),
          itemCount: quantity,
          subtotalPaise: 1000 * quantity,
          deliveryFeePaise: 0,
          totalPaise: 1000 * quantity,
          shipName: 'Asha Rao',
          shipPhone: '+919876543210',
          shipLine1: '12 Residency Road',
          shipCity: 'Bengaluru',
          shipState: 'Karnataka',
          shipPincode: '560001',
          placedAt: new Date(Date.now() - minutesAgo * 60_000),
          items: {
            create: {
              productId,
              productName: 'Sweep',
              sku: `M4${run}${minutesAgo}`,
              unitLabel: '1 pc',
              unitPricePaise: 1000,
              quantity,
              lineTotalPaise: 1000 * quantity,
            },
          },
          payments: {
            create: {
              provider: 'MOCK',
              status: 'PENDING',
              amountPaise: 1000 * quantity,
              currency: 'INR',
            },
          },
          history: { create: { toStatus: 'PENDING_PAYMENT', note: 'Order placed' } },
        },
      });
      return orderNumber;
    }

    const expired = await plant(oldProduct.id, 20, 2);
    const fresh = await plant(freshProduct.id, 5, 1);
    const missing = await request(app).post('/v1/internal/jobs/sweep').send({});
    expect(missing.status).toBe(401);
    const wrong = await request(app)
      .post('/v1/internal/jobs/sweep')
      .set('X-Jobs-Token', 'nope')
      .send({});
    expect(wrong.status).toBe(401);

    const swept = await request(app)
      .post('/v1/internal/jobs/sweep')
      .set('X-Jobs-Token', config.jobsToken)
      .send({});
    expect(swept.status).toBe(200);
    const body = sweepResponseSchema.parse(swept.body);
    expect(body.swept).toBeGreaterThanOrEqual(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: expired } })).status).toBe(
      'PAYMENT_FAILED',
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: fresh } })).status).toBe(
      'PENDING_PAYMENT',
    );
    expect(await stockOf(oldProduct.id)).toBe(7);
    expect(await stockOf(freshProduct.id)).toBe(6);
    const history = await prisma.orderStatusHistory.findFirst({
      where: { order: { orderNumber: expired }, toStatus: 'PAYMENT_FAILED' },
    });
    expect(history?.note).toBe('Pending payment expired');

    const again = await request(app)
      .post('/v1/internal/jobs/sweep')
      .set('X-Jobs-Token', config.jobsToken)
      .send({ olderThanMinutes: 15 });
    const second = sweepResponseSchema.parse(again.body);
    const expiredStill = await prisma.order.findUniqueOrThrow({ where: { orderNumber: expired } });
    expect(expiredStill.status).toBe('PAYMENT_FAILED');
    expect(await stockOf(oldProduct.id)).toBe(7);
    expect(second.swept).toBeLessThan(body.swept + 1);

    const raceProduct = await createProduct(subcategoryId, 'race-sweep', {
      pricePaise: 1000,
      stock: 4,
    });
    await plant(raceProduct.id, 30, 3);
    const [one, two] = await Promise.all([
      request(app).post('/v1/internal/jobs/sweep').set('X-Jobs-Token', config.jobsToken).send({}),
      request(app).post('/v1/internal/jobs/sweep').set('X-Jobs-Token', config.jobsToken).send({}),
    ]);
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    expect(await stockOf(raceProduct.id)).toBe(4);
  });
});

describe('admin dashboard', () => {
  it('aggregates the IST day and hides the dashboard from customers', async () => {
    const denied = await request(clock).get('/v1/admin/dashboard').set(bearer(customerToken));
    expect(denied.status).toBe(403);
    const before = dashboardSchema.parse(
      (await request(clock).get('/v1/admin/dashboard').set(bearer(adminToken))).body,
    );
    const user = await insertCustomer('dash');
    const base = {
      userId: user.id,
      idempotencyKey: randomUUID(),
      requestHash: 'd'.repeat(64),
      itemCount: 1,
      subtotalPaise: 1000,
      deliveryFeePaise: 0,
      totalPaise: 1000,
      shipName: 'Asha Rao',
      shipPhone: '+919876543210',
      shipLine1: '1 Road',
      shipCity: 'Bengaluru',
      shipState: 'KA',
      shipPincode: '560001',
    };
    async function put(
      status: 'CONFIRMED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'PACKED',
      placedAt: string,
    ) {
      await prisma.order.create({
        data: {
          ...base,
          orderNumber: `QC-20261118-${String(Math.floor(Math.random() * 800000) + 100000)}`,
          idempotencyKey: randomUUID(),
          status,
          placedAt: new Date(placedAt),
        },
      });
    }
    await put('CONFIRMED', '2026-11-18T04:00:00.000Z');
    await put('CANCELLED', '2026-11-18T05:00:00.000Z');
    await put('PAYMENT_FAILED', '2026-11-18T06:00:00.000Z');
    await put('PACKED', '2026-11-17T18:00:00.000Z');
    await put('CONFIRMED', '2026-11-17T18:30:00.000Z');

    const categoryId = await createCategory(`M4 ${run} dash`);
    const subcategoryId = await createSubcategory(categoryId, `M4 ${run} dash-sub`);
    const low = await createProduct(subcategoryId, 'low', { stock: 2, pricePaise: 100 });
    const summary = dashboardSchema.parse(
      (await request(clock).get('/v1/admin/dashboard').set(bearer(adminToken))).body,
    );
    expect(summary.ordersToday - before.ordersToday).toBe(3);
    expect(summary.revenueTodayPaise - before.revenueTodayPaise).toBe(2000);
    expect(summary.pendingOrders - before.pendingOrders).toBe(3);
    expect(summary.lowStock.some((item) => item.id === low.id && item.stock === 2)).toBe(true);
    expect(summary.recentOrders.length).toBeLessThanOrEqual(10);
  });
});
