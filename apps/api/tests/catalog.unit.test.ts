import { ErrorCodes } from '@qc/shared';
import { describe, expect, it } from 'vitest';
import { createCatalogCache } from '../src/lib/catalog-cache.js';
import { catalogEtag, ifNoneMatch } from '../src/lib/http-cache.js';
import { uniqueConflict } from '../src/lib/unique-conflict.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { CategoryRepository } from '../src/repositories/category.repository.js';
import type { ProductRepository } from '../src/repositories/product.repository.js';
import { createCatalogService } from '../src/services/catalog.service.js';
import { createSearchService } from '../src/services/search.service.js';
import type { ProductQuery } from '../src/domain/catalog.js';
import { AppError } from '../src/lib/errors.js';

function categoryRepo(partial: Partial<CategoryRepository>): CategoryRepository {
  const unexpected = (): never => {
    throw new Error('unexpected category call');
  };
  return {
    listPublic: unexpected,
    listAdmin: unexpected,
    getAdmin: unexpected,
    findCategory: unexpected,
    findSubcategory: unexpected,
    categoryNameTaken: unexpected,
    categorySlugTaken: unexpected,
    subcategoryNameTaken: unexpected,
    subcategorySlugTaken: unexpected,
    countLiveSubcategories: unexpected,
    countLiveProducts: unexpected,
    createCategory: unexpected,
    updateCategory: unexpected,
    softDeleteCategory: unexpected,
    createSubcategory: unexpected,
    updateSubcategory: unexpected,
    softDeleteSubcategory: unexpected,
    ...partial,
  };
}

describe('catalog cache', () => {
  it('expires entries and drops them on invalidate', () => {
    let clock = 1_000;
    const cache = createCatalogCache({ ttlMs: 60_000, now: () => clock });
    cache.set('categories', '[]', '"a"');
    expect(cache.get('categories')?.body).toBe('[]');
    clock += 60_001;
    expect(cache.get('categories')).toBeUndefined();
    cache.set('categories', '[{"id":"1"}]', '"b"');
    cache.invalidate();
    expect(cache.get('categories')).toBeUndefined();
  });

  it('evicts the oldest entry past the max size', () => {
    const cache = createCatalogCache({ maxEntries: 1 });
    cache.set('a', '1', '"1"');
    cache.set('b', '2', '"2"');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')?.body).toBe('2');
  });
});

describe('http cache helpers', () => {
  it('matches a strong or weak etag in a list', () => {
    const etag = catalogEtag('{"ok":true}');
    expect(etag.startsWith('"')).toBe(true);
    expect(ifNoneMatch(undefined, etag)).toBe(false);
    expect(ifNoneMatch(etag, etag)).toBe(true);
    expect(ifNoneMatch(`W/${etag}, "other"`, etag)).toBe(true);
    expect(ifNoneMatch('"nope"', etag)).toBe(false);
  });
});

describe('unique conflict mapping', () => {
  it('reads the constraint name', () => {
    const sku = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: 'products_sku_live_key' },
    });
    const slug = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['slug'] },
    });
    expect(uniqueConflict(sku)).toBe('SKU_TAKEN');
    expect(uniqueConflict(slug)).toBe('SLUG_TAKEN');
    expect(uniqueConflict(new Error('nope'))).toBeNull();
    expect(
      uniqueConflict(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    ).toBe('NAME_TAKEN');
  });
});

describe('search plan', () => {
  it('uses trigram only when full-text finds nothing', async () => {
    const calls: Array<ProductQuery['mode']> = [];
    const products: Pick<ProductRepository, 'query'> = {
      query: (input) => {
        calls.push(input.mode);
        return Promise.resolve({
          total: input.mode === 'fulltext' ? 0 : 2,
          ids: input.mode === 'trigram' ? ['a'] : [],
        });
      },
    };
    const search = createSearchService(products);
    const base = {
      audience: 'public' as const,
      sort: 'relevance' as const,
      page: 1,
      pageSize: 24,
      q: 'amul buter',
    };
    const typo = await search.search(base);
    expect(calls).toEqual(['fulltext', 'trigram']);
    expect(typo.ids).toEqual(['a']);

    calls.length = 0;
    products.query = (input) => {
      calls.push(input.mode);
      return Promise.resolve({ total: 3, ids: ['b'] });
    };
    const hit = await search.search(base);
    expect(calls).toEqual(['fulltext']);
    expect(hit.total).toBe(3);

    calls.length = 0;
    const browse = await search.search({ ...base, q: undefined });
    expect(calls).toEqual(['browse']);
    expect(browse.total).toBe(3);
  });
});

describe('catalog delete guards', () => {
  const cache = createCatalogCache();
  const products = { query: () => Promise.resolve({ total: 0, ids: [] }) };

  it('blocks a category that still has a subcategory', async () => {
    const deleted: string[] = [];
    const service = createCatalogService({
      categories: categoryRepo({
        findCategory: () =>
          Promise.resolve({
            id: 'c1',
            name: 'Dairy',
            slug: 'dairy',
            description: null,
            imageUrl: null,
            sortOrder: 0,
            isActive: true,
            deletedAt: null,
          }),
        countLiveSubcategories: () => Promise.resolve(1),
        softDeleteCategory: (id) => {
          deleted.push(id);
          return Promise.resolve();
        },
      }),
      products: products as unknown as ProductRepository,
      search: { search: () => Promise.resolve({ total: 0, ids: [] }) },
      cache,
    });
    await expect(service.deleteCategory('c1')).rejects.toMatchObject({
      status: 409,
      code: ErrorCodes.CATEGORY_NOT_EMPTY,
    });
    expect(deleted).toEqual([]);
  });

  it('rejects a name that does not produce a slug', async () => {
    const service = createCatalogService({
      categories: categoryRepo({
        categoryNameTaken: () => Promise.resolve(false),
        categorySlugTaken: () => Promise.resolve(false),
      }),
      products: products as unknown as ProductRepository,
      search: { search: () => Promise.resolve({ total: 0, ids: [] }) },
      cache,
    });
    await expect(
      service.createCategory({ name: '!!!', description: undefined }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('assigns a slug from the category name', async () => {
    let slug = '';
    const service = createCatalogService({
      categories: categoryRepo({
        categoryNameTaken: () => Promise.resolve(false),
        categorySlugTaken: () => Promise.resolve(false),
        createCategory: (input) => {
          slug = input.slug;
          return Promise.resolve({
            id: 'c1',
            name: input.name,
            slug: input.slug,
            description: null,
            imageUrl: null,
            sortOrder: 0,
            isActive: true,
            deletedAt: null,
          });
        },
        getAdmin: () =>
          Promise.resolve({
            id: 'c1',
            name: 'Dairy & Bread',
            slug: 'dairy-bread',
            description: null,
            imageUrl: null,
            sortOrder: 0,
            isActive: true,
            subcategoryCount: 0,
            productCount: 0,
            subcategories: [],
          }),
      }),
      products: products as unknown as ProductRepository,
      search: { search: () => Promise.resolve({ total: 0, ids: [] }) },
      cache,
    });
    const created = await service.createCategory({ name: 'Dairy & Bread', description: undefined });
    expect(slug).toBe('dairy-bread');
    expect(created.slug).toBe('dairy-bread');
  });
});
