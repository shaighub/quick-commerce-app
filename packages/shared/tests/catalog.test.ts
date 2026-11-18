import { ErrorCodes } from '../src/errors.js';
import { createImageUrlSchema } from '../src/image-url.js';
import {
  capPublicTotal,
  createCategoryBodySchema,
  createProductBodySchema,
  createSubcategoryBodySchema,
  productListQuerySchema,
  serviceabilityQuerySchema,
  slugParamSchema,
  stockStatus,
  updateCategoryBodySchema,
  updateProductBodySchema,
  updateSubcategoryBodySchema,
} from '../src/catalog.js';
import { slugify } from '../src/slug.js';
import { isPincodeServiceable, refusalForUnserviceablePincode } from '../src/serviceability.js';
import { describe, expect, it } from 'vitest';

const hosts = ['images.example.com'];

describe('slugify', () => {
  it('builds a lowercase hyphenated slug and drops punctuation', () => {
    expect(slugify('Dairy & Bread', 100)).toBe('dairy-bread');
    expect(slugify('Amul Butter', 170)).toBe('amul-butter');
    expect(slugify('  Café  Latte  ', 100)).toBe('cafe-latte');
  });

  it('trims to the column length and rejects a name with no letters or digits', () => {
    expect(slugify('A'.repeat(120), 100)).toHaveLength(100);
    expect(slugify('!!!', 100)).toBe('');
  });
});

describe('image URL schema', () => {
  const schema = createImageUrlSchema(hosts);

  it('accepts an https URL on an allowlisted host', () => {
    expect(schema.parse('https://images.example.com/milk.jpg')).toBe(
      'https://images.example.com/milk.jpg',
    );
    expect(schema.parse('https://Images.Example.com/milk.jpg')).toContain('https://');
  });

  it('rejects http, unlisted hosts, and malformed URLs', () => {
    expect(schema.safeParse('http://images.example.com/milk.jpg').success).toBe(false);
    const unlisted = schema.safeParse('https://evil.example/pixel.png');
    expect(unlisted.success).toBe(false);
    if (!unlisted.success) {
      expect(unlisted.error.issues[0]?.message).toBe(ErrorCodes.IMAGE_HOST_NOT_ALLOWED);
    }
    expect(schema.safeParse('https://user:pw@images.example.com/a.jpg').success).toBe(false);
    expect(schema.safeParse('not a url').success).toBe(false);
    expect(schema.safeParse('https:///missing-host').success).toBe(false);
  });
});

describe('catalog schemas', () => {
  it('defaults the product list and rejects a page past 20 or a page size past 50', () => {
    expect(productListQuerySchema.parse({}).page).toBe(1);
    expect(productListQuerySchema.parse({}).pageSize).toBe(24);
    expect(productListQuerySchema.parse({}).sort).toBe('relevance');
    expect(productListQuerySchema.safeParse({ page: '21' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ pageSize: '51' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ minPrice: '500', maxPrice: '100' }).success).toBe(
      false,
    );
  });

  it('parses partial updates, subcategories, and blank query values', () => {
    expect(updateCategoryBodySchema(hosts).parse({ isActive: false }).isActive).toBe(false);
    expect(createSubcategoryBodySchema().parse({ name: 'Milk' }).name).toBe('Milk');
    expect(
      updateSubcategoryBodySchema().parse({
        categoryId: '00000000-0000-4000-8000-000000000001',
      }).categoryId,
    ).toBe('00000000-0000-4000-8000-000000000001');
    expect(updateProductBodySchema(hosts).parse({ stock: 2 }).stock).toBe(2);
    expect(slugParamSchema.parse({ slug: 'amul-butter' }).slug).toBe('amul-butter');
    expect(serviceabilityQuerySchema.parse({ pincode: ' 560001 ' }).pincode).toBe('560001');
    expect(serviceabilityQuerySchema.safeParse({ pincode: 560001 }).success).toBe(false);
    const listed = productListQuerySchema.parse({
      q: '  milk ',
      categoryId: '',
      minPrice: '',
      inStock: '',
    });
    expect(listed.q).toBe('milk');
    expect(listed.categoryId).toBeUndefined();
    expect(productListQuerySchema.parse({ q: null, minPrice: null }).q).toBeUndefined();
    expect(productListQuerySchema.safeParse({ q: 5 }).success).toBe(false);
  });

  it('strips unknown category fields and requires a positive price', () => {
    const parsed = createCategoryBodySchema(hosts).parse({
      name: '  Milk  ',
      role: 'ADMIN',
    });
    expect(parsed.name).toBe('Milk');
    expect(parsed).not.toHaveProperty('role');
    expect(
      createProductBodySchema(hosts).safeParse({
        name: 'Milk',
        sku: 'MILK-1',
        subcategoryId: '00000000-0000-4000-8000-000000000001',
        pricePaise: 0,
        unitLabel: '1 L',
        stock: 1,
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it('maps stock to a status and caps the public total', () => {
    expect(stockStatus(0)).toBe('OUT_OF_STOCK');
    expect(stockStatus(5)).toBe('LOW_STOCK');
    expect(stockStatus(6)).toBe('IN_STOCK');
    expect(capPublicTotal(1001)).toBe(1000);
    expect(capPublicTotal(12)).toBe(12);
  });
});

describe('serviceability', () => {
  const allowlist = ['560001', '560002'];

  it('matches the allowlist and names the checkout refusal', () => {
    expect(isPincodeServiceable('560001', allowlist)).toBe(true);
    expect(isPincodeServiceable('560003', allowlist)).toBe(false);
    expect(refusalForUnserviceablePincode('560001', allowlist)).toBeNull();
    expect(refusalForUnserviceablePincode('110001', allowlist)).toEqual({
      code: 'NOT_SERVICEABLE',
      message: 'Delivery is not available for this pincode',
    });
  });
});
