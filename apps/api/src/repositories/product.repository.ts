import { STOCK_LOW_AT } from '@qc/shared';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type {
  CatalogProduct,
  ProductPatch,
  ProductQuery,
  ProductWrite,
} from '../domain/catalog.js';

const productInclude = {
  subcategory: { include: { category: true } },
} as const;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface ProductRepository {
  query(input: ProductQuery): Promise<{ total: number; ids: string[] }>;
  findManyByIds(ids: string[]): Promise<CatalogProduct[]>;
  findPublicBySlug(slug: string): Promise<CatalogProduct | null>;
  findById(id: string): Promise<CatalogProduct | null>;
  subcategoryIsLive(id: string): Promise<boolean>;
  skuTaken(sku: string, exceptId?: string): Promise<boolean>;
  slugTaken(slug: string, exceptId?: string): Promise<boolean>;
  create(input: ProductWrite): Promise<CatalogProduct>;
  update(id: string, input: ProductPatch): Promise<void>;
  softDelete(id: string, at: Date): Promise<void>;
}

function mapProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    subcategoryId: row.subcategoryId,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    description: row.description,
    unitLabel: row.unitLabel,
    pricePaise: row.pricePaise,
    stock: row.stock,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: {
      id: row.subcategory.category.id,
      name: row.subcategory.category.name,
      slug: row.subcategory.category.slug,
    },
    subcategory: {
      id: row.subcategory.id,
      name: row.subcategory.name,
      slug: row.subcategory.slug,
    },
  };
}

function filtersFor(input: ProductQuery): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  if (input.audience === 'public') {
    parts.push(
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.is_active = true`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`s.is_active = true`,
      Prisma.sql`c.deleted_at IS NULL`,
      Prisma.sql`c.is_active = true`,
    );
  } else if (input.status === 'deleted') {
    parts.push(Prisma.sql`p.deleted_at IS NOT NULL`);
  } else if (input.status === 'inactive') {
    parts.push(Prisma.sql`p.deleted_at IS NULL`, Prisma.sql`p.is_active = false`);
  } else if (input.status === 'active') {
    parts.push(Prisma.sql`p.deleted_at IS NULL`, Prisma.sql`p.is_active = true`);
  } else {
    parts.push(Prisma.sql`p.deleted_at IS NULL`);
  }

  if (input.categoryId) {
    parts.push(Prisma.sql`c.id = ${input.categoryId}::uuid`);
  }
  if (input.subcategoryId) {
    parts.push(Prisma.sql`s.id = ${input.subcategoryId}::uuid`);
  }
  if (input.minPrice !== undefined) {
    parts.push(Prisma.sql`p.price_paise >= ${input.minPrice}`);
  }
  if (input.maxPrice !== undefined) {
    parts.push(Prisma.sql`p.price_paise <= ${input.maxPrice}`);
  }
  if (input.inStock) {
    parts.push(Prisma.sql`p.stock > 0`);
  }
  if (input.lowStock) {
    parts.push(Prisma.sql`p.stock <= ${STOCK_LOW_AT}`);
  }
  if (input.q && input.mode === 'fulltext') {
    parts.push(Prisma.sql`p.search_vector @@ websearch_to_tsquery('simple', ${input.q})`);
  }
  if (input.q && input.mode === 'trigram') {
    parts.push(Prisma.sql`p.name % ${input.q}`);
  }
  return parts;
}

function orderClause(input: ProductQuery): Prisma.Sql {
  if (input.sort === 'price_asc') {
    return Prisma.sql`p.price_paise ASC, p.id ASC`;
  }
  if (input.sort === 'price_desc') {
    return Prisma.sql`p.price_paise DESC, p.id ASC`;
  }
  const q = input.q;
  if (input.sort === 'newest' || input.mode === 'browse' || q === undefined) {
    return Prisma.sql`p.created_at DESC, p.id ASC`;
  }
  if (input.mode === 'trigram') {
    return Prisma.sql`similarity(p.name, ${q}) DESC, p.id ASC`;
  }
  return Prisma.sql`ts_rank(p.search_vector, websearch_to_tsquery('simple', ${q})) DESC, similarity(p.name, ${q}) DESC, p.id ASC`;
}

function readTotal(value: number | bigint | undefined): number {
  if (value === undefined) {
    return 0;
  }
  return typeof value === 'bigint' ? Number(value) : value;
}

export function createProductRepository(prisma: PrismaClient): ProductRepository {
  return {
    async query(input: ProductQuery): Promise<{ total: number; ids: string[] }> {
      const where = Prisma.join(filtersFor(input), ' AND ');
      const orderBy = orderClause(input);
      const offset = (input.page - 1) * input.pageSize;
      const cap = input.audience === 'public' ? Prisma.sql`LIMIT 1000` : Prisma.empty;
      return prisma.$transaction(async (tx) => {
        if (input.mode === 'trigram') {
          await tx.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', '0.3', true)`;
        }
        const totals = await tx.$queryRaw<Array<{ total: number | bigint }>>`
          SELECT COUNT(*)::int AS total FROM (
            SELECT p.id
            FROM products p
            JOIN subcategories s ON s.id = p.subcategory_id
            JOIN categories c ON c.id = s.category_id
            WHERE ${where}
            ${cap}
          ) matched
        `;
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT p.id
          FROM products p
          JOIN subcategories s ON s.id = p.subcategory_id
          JOIN categories c ON c.id = s.category_id
          WHERE ${where}
          ORDER BY ${orderBy}
          LIMIT ${input.pageSize} OFFSET ${offset}
        `;
        return {
          total: readTotal(totals[0]?.total),
          ids: rows.map((row) => row.id),
        };
      });
    },

    async findManyByIds(ids: string[]): Promise<CatalogProduct[]> {
      if (ids.length === 0) {
        return [];
      }
      const rows = await prisma.product.findMany({
        where: { id: { in: ids } },
        include: productInclude,
      });
      return rows.map(mapProduct);
    },

    async findPublicBySlug(slug: string): Promise<CatalogProduct | null> {
      const row = await prisma.product.findFirst({
        where: {
          slug,
          deletedAt: null,
          isActive: true,
          subcategory: {
            deletedAt: null,
            isActive: true,
            category: { deletedAt: null, isActive: true },
          },
        },
        include: productInclude,
      });
      return row ? mapProduct(row) : null;
    },

    async findById(id: string): Promise<CatalogProduct | null> {
      const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
      return row ? mapProduct(row) : null;
    },

    async subcategoryIsLive(id: string): Promise<boolean> {
      const row = await prisma.subcategory.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      return row !== null;
    },

    async skuTaken(sku: string, exceptId?: string): Promise<boolean> {
      const row = await prisma.product.findFirst({
        where: {
          deletedAt: null,
          sku,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
      const row = await prisma.product.findFirst({
        where: {
          deletedAt: null,
          slug,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async create(input: ProductWrite): Promise<CatalogProduct> {
      const row = await prisma.product.create({ data: input, include: productInclude });
      return mapProduct(row);
    },

    async update(id: string, input: ProductPatch): Promise<void> {
      await prisma.product.update({ where: { id }, data: input });
    },

    async softDelete(id: string, at: Date): Promise<void> {
      await prisma.product.update({ where: { id }, data: { deletedAt: at } });
    },
  };
}
