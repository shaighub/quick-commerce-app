import type { AdminCategory, AdminSubcategory, PublicCategory } from '@qc/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import type {
  CategoryPatch,
  CategoryWrite,
  SubcategoryPatch,
  SubcategoryWrite,
} from '../domain/catalog.js';

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface SubcategoryRecord {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface CategoryRepository {
  listPublic(): Promise<PublicCategory[]>;
  listAdmin(includeInactive: boolean): Promise<AdminCategory[]>;
  getAdmin(id: string): Promise<AdminCategory | null>;
  findCategory(id: string): Promise<CategoryRecord | null>;
  findSubcategory(id: string): Promise<SubcategoryRecord | null>;
  categoryNameTaken(name: string, exceptId?: string): Promise<boolean>;
  categorySlugTaken(slug: string, exceptId?: string): Promise<boolean>;
  subcategoryNameTaken(categoryId: string, name: string, exceptId?: string): Promise<boolean>;
  subcategorySlugTaken(categoryId: string, slug: string, exceptId?: string): Promise<boolean>;
  countLiveSubcategories(categoryId: string): Promise<number>;
  countLiveProducts(subcategoryId: string): Promise<number>;
  createCategory(input: CategoryWrite): Promise<CategoryRecord>;
  updateCategory(id: string, input: CategoryPatch): Promise<void>;
  softDeleteCategory(id: string, at: Date): Promise<void>;
  createSubcategory(input: SubcategoryWrite): Promise<SubcategoryRecord>;
  updateSubcategory(id: string, input: SubcategoryPatch): Promise<void>;
  softDeleteSubcategory(id: string, at: Date): Promise<void>;
}

const subcategoryOrder = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

function mapSub(row: {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}): AdminSubcategory {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export function createCategoryRepository(prisma: PrismaClient): CategoryRepository {
  return {
    async listPublic(): Promise<PublicCategory[]> {
      const rows = await prisma.category.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          subcategories: {
            where: { deletedAt: null, isActive: true },
            orderBy: subcategoryOrder,
          },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        imageUrl: row.imageUrl,
        subcategories: row.subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
        })),
      }));
    },

    async listAdmin(includeInactive: boolean): Promise<AdminCategory[]> {
      const rows = await prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          subcategories: {
            where: { deletedAt: null },
            orderBy: subcategoryOrder,
          },
        },
      });
      const counts = await prisma.product.groupBy({
        by: ['subcategoryId'],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      const bySub = new Map(counts.map((row) => [row.subcategoryId, row._count._all]));
      return rows
        .filter((row) => includeInactive || row.isActive)
        .map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          imageUrl: row.imageUrl,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
          subcategoryCount: row.subcategories.length,
          productCount: row.subcategories.reduce((sum, sub) => sum + (bySub.get(sub.id) ?? 0), 0),
          subcategories: row.subcategories
            .filter((sub) => includeInactive || sub.isActive)
            .map(mapSub),
        }));
    },

    async getAdmin(id: string): Promise<AdminCategory | null> {
      const row = await prisma.category.findFirst({
        where: { id, deletedAt: null },
        include: {
          subcategories: {
            where: { deletedAt: null },
            orderBy: subcategoryOrder,
          },
        },
      });
      if (!row) {
        return null;
      }
      const productCount = await prisma.product.count({
        where: { deletedAt: null, subcategory: { categoryId: id, deletedAt: null } },
      });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl: row.imageUrl,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        subcategoryCount: row.subcategories.length,
        productCount,
        subcategories: row.subcategories.map(mapSub),
      };
    },

    async findCategory(id: string): Promise<CategoryRecord | null> {
      return prisma.category.findUnique({ where: { id } });
    },

    async findSubcategory(id: string): Promise<SubcategoryRecord | null> {
      return prisma.subcategory.findUnique({ where: { id } });
    },

    async categoryNameTaken(name: string, exceptId?: string): Promise<boolean> {
      const row = await prisma.category.findFirst({
        where: {
          deletedAt: null,
          name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async categorySlugTaken(slug: string, exceptId?: string): Promise<boolean> {
      const row = await prisma.category.findFirst({
        where: {
          deletedAt: null,
          slug,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async subcategoryNameTaken(
      categoryId: string,
      name: string,
      exceptId?: string,
    ): Promise<boolean> {
      const row = await prisma.subcategory.findFirst({
        where: {
          deletedAt: null,
          categoryId,
          name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async subcategorySlugTaken(
      categoryId: string,
      slug: string,
      exceptId?: string,
    ): Promise<boolean> {
      const row = await prisma.subcategory.findFirst({
        where: {
          deletedAt: null,
          categoryId,
          slug,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
      });
      return row !== null;
    },

    async countLiveSubcategories(categoryId: string): Promise<number> {
      return prisma.subcategory.count({ where: { categoryId, deletedAt: null } });
    },

    async countLiveProducts(subcategoryId: string): Promise<number> {
      return prisma.product.count({ where: { subcategoryId, deletedAt: null } });
    },

    async createCategory(input: CategoryWrite): Promise<CategoryRecord> {
      return prisma.category.create({ data: input });
    },

    async updateCategory(id: string, input: CategoryPatch): Promise<void> {
      await prisma.category.update({ where: { id }, data: input });
    },

    async softDeleteCategory(id: string, at: Date): Promise<void> {
      await prisma.category.update({ where: { id }, data: { deletedAt: at } });
    },

    async createSubcategory(input: SubcategoryWrite): Promise<SubcategoryRecord> {
      return prisma.subcategory.create({ data: input });
    },

    async updateSubcategory(id: string, input: SubcategoryPatch): Promise<void> {
      await prisma.subcategory.update({ where: { id }, data: input });
    },

    async softDeleteSubcategory(id: string, at: Date): Promise<void> {
      await prisma.subcategory.update({ where: { id }, data: { deletedAt: at } });
    },
  };
}
