import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase } from '../src/db/seed.js';
import { createDatabase } from '../src/lib/prisma.js';
import { silentLogger, testConfig } from './helpers.js';

const database = createDatabase(testConfig().databaseUrl, silentLogger());
const prisma = database.prisma;

const expectedIndexes = [
  'users_pkey',
  'users_email_key',
  'users_role_idx',
  'refresh_tokens_pkey',
  'refresh_tokens_token_hash_key',
  'refresh_tokens_user_idx',
  'refresh_tokens_family_idx',
  'refresh_tokens_expires_idx',
  'categories_pkey',
  'categories_slug_live_key',
  'categories_name_live_key',
  'categories_active_sort_idx',
  'subcategories_pkey',
  'subcategories_cat_slug_live_key',
  'subcategories_cat_name_live_key',
  'subcategories_cat_sort_idx',
  'products_pkey',
  'products_slug_live_key',
  'products_sku_live_key',
  'products_search_gin',
  'products_name_trgm',
  'products_subcat_active_idx',
  'products_price_idx',
  'products_created_idx',
  'products_low_stock_idx',
  'carts_pkey',
  'carts_user_id_key',
  'cart_items_pkey',
  'cart_items_cart_product_key',
  'cart_items_product_idx',
  'orders_pkey',
  'orders_order_number_key',
  'orders_user_idem_key',
  'orders_user_placed_idx',
  'orders_status_placed_idx',
  'orders_placed_idx',
  'orders_pending_idx',
  'order_items_pkey',
  'order_items_order_product_key',
  'order_items_product_idx',
  'payments_pkey',
  'payments_order_idx',
  'payments_provider_ref_key',
  'order_status_history_pkey',
  'order_status_history_order_idx',
  'order_number_counters_pkey',
];

beforeAll(async () => {
  await seedDatabase(prisma, { email: 'admin@example.com', password: 'Adminpass1' });
});

afterAll(async () => {
  await database.close();
});

describe('database foundation', () => {
  it('installs extensions and the designed indexes', async () => {
    const extensions = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'pgcrypto') ORDER BY extname
    `;
    expect(extensions.map((row) => row.extname)).toEqual(['pg_trgm', 'pgcrypto']);

    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const names = new Set(indexes.map((row) => row.indexname));
    for (const name of expectedIndexes) {
      expect(names.has(name), name).toBe(true);
    }

    const trigram = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'products_name_trgm'
    `;
    expect(trigram[0]?.indexdef).toContain('gin_trgm_ops');

    const score = await prisma.$queryRaw<{ score: number }[]>`
      SELECT similarity('Amul Butter', 'amul buter') AS score
    `;
    expect(Number(score[0]?.score)).toBeGreaterThan(0.3);
  });

  it('reuses a slug after a soft delete and rejects a live duplicate', async () => {
    const slug = `slug-${randomUUID()}`;
    const first = await prisma.category.create({
      data: { name: `Name ${slug}`, slug, sortOrder: 9 },
    });
    await expect(
      prisma.category.create({ data: { name: `Other ${slug}`, slug, sortOrder: 9 } }),
    ).rejects.toThrow();
    await prisma.category.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const reused = await prisma.category.create({
      data: { name: `Again ${slug}`, slug, sortOrder: 9 },
    });
    await prisma.category.deleteMany({ where: { id: { in: [first.id, reused.id] } } });
  });

  it('enforces price, stock, quantity, pincode, and total checks', async () => {
    const subcategory = await prisma.subcategory.findFirstOrThrow({ where: { slug: 'milk' } });
    const sku = `SKU-${randomUUID()}`;
    await expect(
      prisma.$executeRaw`
        INSERT INTO products (id, subcategory_id, name, slug, sku, unit_label, price_paise, stock, is_active)
        VALUES (gen_random_uuid(), ${subcategory.id}::uuid, 'Bad price', ${sku}, ${sku}, '1 pc', 0, 1, true)
      `,
    ).rejects.toThrow();

    const product = await prisma.product.create({
      data: {
        subcategoryId: subcategory.id,
        name: 'Constraint item',
        slug: `constraint-${sku}`,
        sku,
        unitLabel: '1 pc',
        pricePaise: 100,
        stock: 2,
      },
    });
    await expect(
      prisma.product.update({ where: { id: product.id }, data: { stock: -1 } }),
    ).rejects.toThrow();

    const user = await prisma.user.create({
      data: {
        email: `constraint-${sku}@example.com`,
        passwordHash: 'x'.repeat(60),
        name: 'Constraint',
      },
    });
    const cart = await prisma.cart.create({ data: { userId: user.id } });
    await expect(
      prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 11 } }),
    ).rejects.toThrow();

    await expect(
      prisma.$executeRaw`
        INSERT INTO orders (
          id, order_number, user_id, status, idempotency_key, request_hash, item_count,
          subtotal_paise, delivery_fee_paise, total_paise, ship_name, ship_phone, ship_line1,
          ship_city, ship_state, ship_pincode
        ) VALUES (
          gen_random_uuid(), ${`QC-TEST-${sku.slice(0, 6)}`}, ${user.id}::uuid, 'PENDING_PAYMENT',
          ${sku}, ${'a'.repeat(64)}, 1, 100, 0, 100, 'A', '+919876543210', 'Line', 'City', 'State', '000000'
        )
      `,
    ).rejects.toThrow();

    await prisma.cart.delete({ where: { id: cart.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it('issues consecutive order numbers for the IST day', async () => {
    const next = () =>
      prisma.$queryRaw<{ day_text: string; last_value: number }[]>`
        WITH upserted AS (
          INSERT INTO order_number_counters (day, last_value)
          VALUES ((now() AT TIME ZONE 'Asia/Kolkata')::date, 1)
          ON CONFLICT (day) DO UPDATE
            SET last_value = order_number_counters.last_value + 1,
                updated_at = now()
          RETURNING day, last_value
        )
        SELECT to_char(day, 'YYYYMMDD') AS day_text, last_value FROM upserted
      `;

    const first = (await next())[0];
    const second = (await next())[0];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) {
      return;
    }
    expect(second.last_value).toBe(first.last_value + 1);
    expect(`QC-${first.day_text}-${String(first.last_value).padStart(6, '0')}`).toMatch(
      /^QC-\d{8}-\d{6}$/,
    );
  });
});
