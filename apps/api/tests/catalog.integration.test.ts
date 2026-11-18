import { randomUUID } from 'node:crypto';
import {
  adminCategorySchema,
  adminProductSchema,
  authSessionSchema,
  errorResponseSchema,
  productDetailResponseSchema,
  productListResponseSchema,
  publicCategoryListSchema,
  serviceabilityResponseSchema,
  subcategoryResponseSchema,
} from '@qc/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/lib/prisma.js';
import { createPasswordService } from '../src/services/password.service.js';
import { silentLogger, testConfig } from './helpers.js';

const logger = silentLogger();
const config = testConfig({ rateLimitAuthMax: 10_000, rateLimitPublicMax: 10_000 });
const database = createDatabase(config.databaseUrl, logger);
const app = createApp({
  config,
  logger,
  prisma: database.prisma,
  checkDb: () => Promise.resolve(true),
});

const limited = createApp({
  config: testConfig({ rateLimitPublicMax: 100, rateLimitAuthMax: 10_000 }),
  logger,
  prisma: database.prisma,
  checkDb: () => Promise.resolve(true),
});

const run = randomUUID().slice(0, 8);
const prisma = database.prisma;
let adminToken = '';
let customerToken = '';
let customerId = '';

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function codeOf(body: unknown): string {
  return errorResponseSchema.parse(body).error.code;
}

function bodyField(body: unknown, key: string): unknown {
  if (typeof body !== 'object' || body === null || !(key in body)) {
    return undefined;
  }
  return Object.getOwnPropertyDescriptor(body, key)?.value as unknown;
}

function sku(suffix: string): string {
  return `M3${run}${suffix}`.slice(0, 40);
}

async function createCategory(name: string, extra: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/v1/admin/categories')
    .set(bearer(adminToken))
    .send({ name, ...extra });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return adminCategorySchema.parse(bodyField(response.body, 'category'));
}

async function createSubcategory(categoryId: string, name: string) {
  const response = await request(app)
    .post(`/v1/admin/categories/${categoryId}/subcategories`)
    .set(bearer(adminToken))
    .send({ name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return subcategoryResponseSchema.parse(response.body).subcategory;
}

async function createProduct(
  subcategoryId: string,
  suffix: string,
  extra: Record<string, unknown> = {},
) {
  const response = await request(app)
    .post('/v1/admin/products')
    .set(bearer(adminToken))
    .send({
      name: `M3 ${run} ${suffix}`,
      sku: sku(suffix),
      subcategoryId,
      pricePaise: 2500,
      unitLabel: '1 pc',
      stock: 8,
      isActive: true,
      ...extra,
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return adminProductSchema.parse(bodyField(response.body, 'product'));
}

beforeAll(async () => {
  const email = `m3-admin-${run}@example.com`;
  const passwords = createPasswordService();
  await prisma.user.create({
    data: {
      email,
      passwordHash: await passwords.hash('Adminpass1'),
      name: 'Catalog Admin',
      role: 'ADMIN',
    },
  });
  const adminLogin = await request(app)
    .post('/v1/auth/login')
    .send({ email, password: 'Adminpass1' });
  adminToken = authSessionSchema.parse(adminLogin.body).accessToken;

  const signup = await request(app)
    .post('/v1/auth/signup')
    .send({
      name: 'Catalog Customer',
      email: `m3-customer-${run}@example.com`,
      password: 'Password1',
    });
  const session = authSessionSchema.parse(signup.body);
  customerToken = session.accessToken;
  customerId = session.user.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { sku: { startsWith: `M3${run}` } } });
  await prisma.order.deleteMany({ where: { userId: customerId } });
  await prisma.cartItem.deleteMany({ where: { product: { sku: { startsWith: `M3${run}` } } } });
  await prisma.cart.deleteMany({ where: { userId: customerId } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: `M3${run}` } } });
  await prisma.subcategory.deleteMany({ where: { name: { startsWith: `M3 ${run}` } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: `M3 ${run}` } } });
  await prisma.user.deleteMany({
    where: { email: { in: [`m3-admin-${run}@example.com`, `m3-customer-${run}@example.com`] } },
  });
  await database.close();
});

describe('catalog HTTP', () => {
  it('rejects guests and customers on admin catalog routes', async () => {
    const id = '00000000-0000-4000-8000-000000000099';
    const routes: Array<[string, string]> = [
      ['get', '/v1/admin/categories'],
      ['post', '/v1/admin/categories'],
      ['patch', `/v1/admin/categories/${id}`],
      ['delete', `/v1/admin/categories/${id}`],
      ['post', `/v1/admin/categories/${id}/subcategories`],
      ['patch', `/v1/admin/subcategories/${id}`],
      ['delete', `/v1/admin/subcategories/${id}`],
      ['get', '/v1/admin/products'],
      ['post', '/v1/admin/products'],
      ['get', `/v1/admin/products/${id}`],
      ['patch', `/v1/admin/products/${id}`],
      ['delete', `/v1/admin/products/${id}`],
    ];
    for (const [method, path] of routes) {
      const guest = await request(app)[method as 'get'](path).send({});
      expect(guest.status, `${method} ${path} guest`).toBe(401);
      expect(codeOf(guest.body)).toBe('UNAUTHORIZED');
      const customer = await request(app)
        [method as 'get'](path)
        .set(bearer(customerToken))
        .send({});
      expect(customer.status, `${method} ${path} customer`).toBe(403);
      expect(codeOf(customer.body)).toBe('FORBIDDEN');
    }
  });

  it('creates, updates, hides, and soft-deletes categories and subcategories', async () => {
    const category = await createCategory(`M3 ${run} Dairy & Bread`, {
      description: 'Milk and bread',
      imageUrl: 'https://images.example.com/dairy.jpg',
      sortOrder: 4,
      isActive: true,
      ignored: 'stripped',
    });
    expect(category.slug).toBe(`m3-${run}-dairy-bread`);
    expect(category.description).toBe('Milk and bread');

    const duplicate = await request(app)
      .post('/v1/admin/categories')
      .set(bearer(adminToken))
      .send({ name: `m3 ${run} dairy & bread` });
    expect(duplicate.status).toBe(409);
    expect(codeOf(duplicate.body)).toBe('NAME_TAKEN');

    const httpImage = await request(app)
      .post('/v1/admin/categories')
      .set(bearer(adminToken))
      .send({ name: `M3 ${run} Http`, imageUrl: 'http://images.example.com/a.jpg' });
    expect(httpImage.status).toBe(422);
    expect(codeOf(httpImage.body)).toBe('VALIDATION');

    const evilImage = await request(app)
      .post('/v1/admin/categories')
      .set(bearer(adminToken))
      .send({ name: `M3 ${run} Evil`, imageUrl: 'https://evil.example/a.jpg' });
    expect(evilImage.status).toBe(422);
    expect(codeOf(evilImage.body)).toBe('IMAGE_HOST_NOT_ALLOWED');

    const renamed = await request(app)
      .patch(`/v1/admin/categories/${category.id}`)
      .set(bearer(adminToken))
      .send({ name: `M3 ${run} Dairy Renamed`, sortOrder: 1, isActive: false });
    expect(renamed.status).toBe(200);
    const updated = adminCategorySchema.parse(bodyField(renamed.body, 'category'));
    expect(updated.name).toBe(`M3 ${run} Dairy Renamed`);
    expect(updated.slug).toBe(category.slug);
    expect(updated.description).toBe('Milk and bread');
    expect(updated.isActive).toBe(false);

    const missing = await request(app)
      .patch(`/v1/admin/categories/${randomUUID()}`)
      .set(bearer(adminToken))
      .send({ name: `M3 ${run} Missing` });
    expect(missing.status).toBe(404);

    const hidden = await request(app).get('/v1/categories');
    const publicBefore = publicCategoryListSchema.parse(hidden.body);
    expect(publicBefore.find((row) => row.id === category.id)).toBeUndefined();

    await request(app)
      .patch(`/v1/admin/categories/${category.id}`)
      .set(bearer(adminToken))
      .send({ isActive: true });

    const sub = await createSubcategory(category.id, `M3 ${run} Milk`);
    const sameName = await request(app)
      .post(`/v1/admin/categories/${category.id}/subcategories`)
      .set(bearer(adminToken))
      .send({ name: `m3 ${run} milk` });
    expect(sameName.status).toBe(409);
    expect(codeOf(sameName.body)).toBe('NAME_TAKEN');

    const unknownParent = await request(app)
      .post(`/v1/admin/categories/${randomUUID()}/subcategories`)
      .set(bearer(adminToken))
      .send({ name: `M3 ${run} Orphan` });
    expect(unknownParent.status).toBe(404);

    const blocked = await request(app)
      .delete(`/v1/admin/categories/${category.id}`)
      .set(bearer(adminToken));
    expect(blocked.status).toBe(409);
    expect(codeOf(blocked.body)).toBe('CATEGORY_NOT_EMPTY');

    const other = await createCategory(`M3 ${run} Snacks`);
    const moved = await request(app)
      .patch(`/v1/admin/subcategories/${sub.id}`)
      .set(bearer(adminToken))
      .send({ categoryId: other.id, name: `M3 ${run} Milk Moved`, sortOrder: 3 });
    expect(moved.status).toBe(200);
    expect(subcategoryResponseSchema.parse(moved.body).subcategory.categoryId).toBe(other.id);
    expect(subcategoryResponseSchema.parse(moved.body).subcategory.slug).toBe(sub.slug);

    const clash = await createSubcategory(category.id, `M3 ${run} Milk Moved`);
    const moveClash = await request(app)
      .patch(`/v1/admin/subcategories/${clash.id}`)
      .set(bearer(adminToken))
      .send({ categoryId: other.id });
    expect(moveClash.status).toBe(409);

    const empty = await createCategory(`M3 ${run} Empty`);
    const removed = await request(app)
      .delete(`/v1/admin/categories/${empty.id}`)
      .set(bearer(adminToken));
    expect(removed.status).toBe(204);
    const reused = await createCategory(`M3 ${run} Empty`);
    expect(reused.id).not.toBe(empty.id);

    const listed = await request(app)
      .get('/v1/admin/categories?includeInactive=true')
      .set(bearer(adminToken));
    expect(listed.status).toBe(200);
    const adminRows = listed.body as unknown[];
    expect(adminRows.some((row) => adminCategorySchema.parse(row).id === empty.id)).toBe(false);
    expect(adminRows.some((row) => adminCategorySchema.parse(row).id === reused.id)).toBe(true);
  });

  it('paginates, filters, sorts, and caps the public total', async () => {
    const category = await createCategory(`M3 ${run} Pantry`);
    const sub = await createSubcategory(category.id, `M3 ${run} Tins`);
    const otherCategory = await createCategory(`M3 ${run} Other`);
    const otherSub = await createSubcategory(otherCategory.id, `M3 ${run} Other Tins`);

    const cheap = await createProduct(sub.id, 'CHEAP', { pricePaise: 1000, stock: 4 });
    const mid = await createProduct(sub.id, 'MID', { pricePaise: 3000, stock: 0 });
    await createProduct(sub.id, 'RICH', { pricePaise: 9000, stock: 9 });
    await createProduct(otherSub.id, 'ELSE', { pricePaise: 1000, stock: 9 });

    const filtered = await request(app).get('/v1/products').query({
      categoryId: category.id,
      minPrice: 500,
      maxPrice: 2000,
      inStock: 'true',
    });
    expect(filtered.status).toBe(200);
    const filteredBody = productListResponseSchema.parse(filtered.body);
    expect(filteredBody.items.map((item) => item.id)).toEqual([cheap.id]);
    expect(filteredBody.items[0]?.stockStatus).toBe('LOW_STOCK');

    const byPrice = await request(app)
      .get('/v1/products')
      .query({ subcategoryId: sub.id, sort: 'price_asc', pageSize: 10 });
    const prices = productListResponseSchema
      .parse(byPrice.body)
      .items.map((item) => item.pricePaise);
    expect(prices).toEqual([1000, 3000, 9000]);

    const newest = await request(app)
      .get('/v1/products')
      .query({ subcategoryId: sub.id, sort: 'relevance' });
    const newestItems = productListResponseSchema.parse(newest.body).items;
    expect(newestItems[0]?.id).toBeDefined();
    expect(newestItems.map((item) => item.id)).toContain(mid.id);

    await prisma.product.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        subcategoryId: sub.id,
        name: `M3 ${run} Bulk ${index}`,
        slug: `m3-${run}-bulk-${index}`,
        sku: sku(`B${index}`),
        unitLabel: '1 pc',
        pricePaise: 1500,
        stock: 2,
        isActive: true,
      })),
    });
    await request(app)
      .patch(`/v1/admin/categories/${category.id}`)
      .set(bearer(adminToken))
      .send({ sortOrder: 2 });
    const page = await request(app)
      .get('/v1/products')
      .query({ subcategoryId: sub.id, pageSize: 24, page: 1 });
    const pageBody = productListResponseSchema.parse(page.body);
    expect(pageBody.items).toHaveLength(24);
    expect(pageBody.pageSize).toBe(24);
    expect(pageBody.total).toBe(33);
    const page2 = await request(app).get('/v1/products').query({ subcategoryId: sub.id, page: 2 });
    expect(productListResponseSchema.parse(page2.body).items.length).toBeGreaterThan(0);

    expect((await request(app).get('/v1/products').query({ page: 21 })).status).toBe(422);
    expect((await request(app).get('/v1/products').query({ pageSize: 51 })).status).toBe(422);

    await prisma.product.createMany({
      data: Array.from({ length: 1001 }, (_, index) => ({
        subcategoryId: otherSub.id,
        name: `M3 ${run} Cap ${index}`,
        slug: `m3-${run}-cap-${index}`,
        sku: sku(`C${index}`),
        unitLabel: '1 pc',
        pricePaise: 1100,
        stock: 1,
        isActive: true,
      })),
    });
    await request(app)
      .patch(`/v1/admin/categories/${otherCategory.id}`)
      .set(bearer(adminToken))
      .send({ sortOrder: 3 });
    const capped = await request(app).get('/v1/products').query({ subcategoryId: otherSub.id });
    expect(productListResponseSchema.parse(capped.body).total).toBe(1000);
  });

  it('ranks name matches above description matches and tolerates a typo', async () => {
    const category = await createCategory(`M3 ${run} Search`);
    const sub = await createSubcategory(category.id, `M3 ${run} Search Items`);
    const named = await createProduct(sub.id, 'NAME', {
      name: `Zephyrbutter ${run}`,
      description: 'Plain tin',
    });
    const described = await createProduct(sub.id, 'DESC', {
      name: `Kitchen Tin ${run}`,
      description: `A zephyrbutter ${run} spread for toast`,
    });
    const ranked = await request(app)
      .get('/v1/products')
      .query({ q: `zephyrbutter ${run}`, categoryId: category.id });
    const rankedItems = productListResponseSchema.parse(ranked.body).items;
    expect(rankedItems[0]?.id).toBe(named.id);
    expect(rankedItems.map((item) => item.id)).toContain(described.id);

    const typo = await request(app)
      .get('/v1/products')
      .query({ q: `zephyrbuter ${run}`, categoryId: category.id });
    const typoItems = productListResponseSchema.parse(typo.body).items;
    expect(typoItems.map((item) => item.id)).toContain(named.id);
  });

  it('keeps order prices, soft-deletes products, and serves admin filters', async () => {
    const category = await createCategory(`M3 ${run} Goods`);
    const sub = await createSubcategory(category.id, `M3 ${run} Goods Items`);
    const inactiveCategory = await createCategory(`M3 ${run} Hidden Cat`, { isActive: false });
    const inactiveSub = await createSubcategory(inactiveCategory.id, `M3 ${run} Hidden Sub`);
    const product = await createProduct(sub.id, 'BUTTER', {
      pricePaise: 5600,
      stock: 5,
      description: 'Salted',
      imageUrl: 'https://images.example.com/butter.jpg',
    });
    const inactive = await createProduct(sub.id, 'OFF', { isActive: false, stock: 2 });
    const out = await createProduct(sub.id, 'ZERO', { stock: 0 });
    const hiddenParent = await createProduct(inactiveSub.id, 'PARENT', { stock: 6 });

    const zero = await request(app)
      .post('/v1/admin/products')
      .set(bearer(adminToken))
      .send({
        name: `M3 ${run} Free`,
        sku: sku('FREE'),
        subcategoryId: sub.id,
        pricePaise: 0,
        unitLabel: '1 pc',
        stock: 1,
        isActive: true,
      });
    expect(zero.status).toBe(422);

    const duplicateSku = await request(app)
      .post('/v1/admin/products')
      .set(bearer(adminToken))
      .send({
        name: `M3 ${run} Copy`,
        sku: product.sku,
        subcategoryId: sub.id,
        pricePaise: 100,
        unitLabel: '1 pc',
        stock: 1,
        isActive: true,
      });
    expect(duplicateSku.status).toBe(409);
    expect(codeOf(duplicateSku.body)).toBe('SKU_TAKEN');

    const detail = await request(app).get(`/v1/products/${product.slug}`);
    expect(detail.status).toBe(200);
    const parsedDetail = productDetailResponseSchema.parse(detail.body);
    expect(parsedDetail.product.pricePaise).toBe(5600);
    expect(parsedDetail.product.stockStatus).toBe('LOW_STOCK');
    expect(parsedDetail.product.category.id).toBe(category.id);
    expect(detail.headers['cache-control']).toContain('max-age=60');
    expect(detail.headers.etag).toBeDefined();

    const order = await prisma.order.create({
      data: {
        orderNumber: `QC-20261118-${run.slice(0, 6)}`,
        userId: customerId,
        status: 'CONFIRMED',
        idempotencyKey: randomUUID(),
        requestHash: 'a'.repeat(64),
        itemCount: 1,
        subtotalPaise: 5600,
        deliveryFeePaise: 0,
        totalPaise: 5600,
        shipName: 'Asha',
        shipPhone: '+919876543210',
        shipLine1: '1 Road',
        shipCity: 'Bengaluru',
        shipState: 'KA',
        shipPincode: '560001',
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitLabel: '1 pc',
            unitPricePaise: 5600,
            quantity: 1,
            lineTotalPaise: 5600,
          },
        },
      },
    });

    const patched = await request(app)
      .patch(`/v1/admin/products/${product.id}`)
      .set(bearer(adminToken))
      .send({ pricePaise: 9900, stock: 20 });
    expect(patched.status).toBe(200);
    expect(adminProductSchema.parse(bodyField(patched.body, 'product')).pricePaise).toBe(9900);
    const snapshot = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    expect(snapshot?.unitPricePaise).toBe(5600);

    const cart = await prisma.cart.create({ data: { userId: customerId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    const removed = await request(app)
      .delete(`/v1/admin/products/${product.id}`)
      .set(bearer(adminToken));
    expect(removed.status).toBe(204);
    expect((await request(app).get(`/v1/products/${product.slug}`)).status).toBe(404);
    const stillThere = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    expect(stillThere?.unitPricePaise).toBe(5600);
    expect(await prisma.cartItem.count({ where: { cartId: cart.id, productId: product.id } })).toBe(
      1,
    );

    const publicList = productListResponseSchema.parse(
      (await request(app).get('/v1/products').query({ subcategoryId: sub.id, pageSize: 50 })).body,
    );
    const publicIds = publicList.items.map((item) => item.id);
    expect(publicIds).not.toContain(product.id);
    expect(publicIds).not.toContain(inactive.id);
    expect(publicIds).toContain(out.id);

    const hiddenList = productListResponseSchema.parse(
      (await request(app).get('/v1/products').query({ categoryId: inactiveCategory.id })).body,
    );
    expect(hiddenList.items.map((item) => item.id)).not.toContain(hiddenParent.id);

    const low = await request(app)
      .get('/v1/admin/products')
      .query({ subcategoryId: sub.id, lowStock: 'true', status: 'active' })
      .set(bearer(adminToken));
    const lowItems = low.body as { items: unknown[] };
    const lowIds = lowItems.items.map((item) => adminProductSchema.parse(item).id);
    expect(lowIds).toContain(out.id);
    expect(lowIds).not.toContain(inactive.id);

    const inactiveList = await request(app)
      .get('/v1/admin/products')
      .query({ subcategoryId: sub.id, status: 'inactive' })
      .set(bearer(adminToken));
    expect(
      (inactiveList.body as { items: unknown[] }).items.map(
        (item) => adminProductSchema.parse(item).id,
      ),
    ).toContain(inactive.id);

    const deletedList = await request(app)
      .get('/v1/admin/products')
      .query({ status: 'deleted', q: product.name })
      .set(bearer(adminToken));
    expect(
      (deletedList.body as { items: unknown[] }).items.map(
        (item) => adminProductSchema.parse(item).id,
      ),
    ).toContain(product.id);

    const blockedSub = await request(app)
      .delete(`/v1/admin/subcategories/${sub.id}`)
      .set(bearer(adminToken));
    expect(blockedSub.status).toBe(409);
    expect(codeOf(blockedSub.body)).toBe('SUBCATEGORY_NOT_EMPTY');

    const emptySubCategory = await createCategory(`M3 ${run} Sub Parent`);
    const emptySub = await createSubcategory(emptySubCategory.id, `M3 ${run} Empty Sub`);
    const removedSub = await request(app)
      .delete(`/v1/admin/subcategories/${emptySub.id}`)
      .set(bearer(adminToken));
    expect(removedSub.status).toBe(204);
  });

  it('sends cache headers and invalidates the in-process catalog cache on writes', async () => {
    const first = await request(app).get('/v1/categories');
    expect(first.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
    const etag = first.headers.etag;
    expect(typeof etag).toBe('string');
    const cached = await request(app).get('/v1/categories').set('If-None-Match', String(etag));
    expect(cached.status).toBe(304);
    expect(cached.text).toBe('');

    const created = await createCategory(`M3 ${run} Cache`);
    const fresh = await request(app).get('/v1/categories');
    expect(fresh.status).toBe(200);
    expect(publicCategoryListSchema.parse(fresh.body).some((row) => row.id === created.id)).toBe(
      true,
    );
    const stale = await request(app).get('/v1/categories').set('If-None-Match', String(etag));
    expect(stale.status).toBe(200);
  });

  it('reports serviceability without rejecting an unserved pincode', async () => {
    const served = await request(app).get('/v1/serviceability').query({ pincode: '560001' });
    expect(serviceabilityResponseSchema.parse(served.body)).toEqual({
      pincode: '560001',
      serviceable: true,
      deliveryFeePaise: 2500,
    });
    const unserved = await request(app).get('/v1/serviceability').query({ pincode: '110001' });
    expect(serviceabilityResponseSchema.parse(unserved.body).serviceable).toBe(false);
    const invalid = await request(app).get('/v1/serviceability').query({ pincode: '012345' });
    expect(invalid.status).toBe(422);
    expect(codeOf(invalid.body)).toBe('VALIDATION');
  });

  it('rate limits public catalog reads at 100 per minute', async () => {
    let last = await request(limited).get('/v1/serviceability').query({ pincode: '560001' });
    for (let attempt = 1; attempt < 100; attempt += 1) {
      last = await request(limited).get('/v1/serviceability').query({ pincode: '560001' });
      expect(last.status).toBe(200);
    }
    const blocked = await request(limited).get('/v1/serviceability').query({ pincode: '560001' });
    expect(blocked.status).toBe(429);
    expect(codeOf(blocked.body)).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
