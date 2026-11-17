import { afterAll, describe, expect, it } from 'vitest';
import { assertAdminSeedInput, seedDatabase } from '../src/db/seed.js';
import { createDatabase } from '../src/lib/prisma.js';
import { silentLogger, testConfig } from './helpers.js';

const database = createDatabase(testConfig().databaseUrl, silentLogger());

afterAll(async () => {
  await database.close();
});

describe('admin seed', () => {
  it('refuses a missing or weak password', () => {
    expect(() => assertAdminSeedInput({ email: 'admin@example.com', password: undefined })).toThrow(
      /ADMIN_PASSWORD is required/,
    );
    expect(() => assertAdminSeedInput({ email: '', password: 'Adminpass1' })).toThrow(
      /ADMIN_EMAIL/,
    );
    expect(() =>
      assertAdminSeedInput({ email: 'admin@example.com', password: 'longpassword' }),
    ).toThrow(/number/);
    expect(() =>
      assertAdminSeedInput({ email: 'admin@example.com', password: 'password1' }),
    ).toThrow(/weak password/);
  });

  it('creates one admin and the sample catalog, and is idempotent', async () => {
    const input = { email: 'Admin@Example.com', password: 'Adminpass1' };
    await seedDatabase(database.prisma, input);
    await seedDatabase(database.prisma, input);

    const admins = await database.prisma.user.findMany({
      where: { email: 'admin@example.com', role: 'ADMIN' },
    });
    expect(admins).toHaveLength(1);
    expect(admins[0]?.passwordHash.startsWith('$2')).toBe(true);
    expect(admins[0]?.passwordHash.includes('$12$')).toBe(true);
    expect(admins[0]?.name).toBe('Store Admin');

    expect(await database.prisma.category.count()).toBe(3);
    expect(await database.prisma.subcategory.count()).toBe(4);
    expect(await database.prisma.product.count()).toBe(6);

    const rows = await database.prisma.$queryRaw<{ search_vector: string }[]>`
      SELECT search_vector::text AS search_vector
      FROM products
      WHERE sku = 'BUTTER-AMUL-500'
    `;
    expect(rows[0]?.search_vector.toLowerCase()).toContain('butter');
  });
});
