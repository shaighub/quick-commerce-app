import type {
  AdminCategory,
  AdminProduct,
  PublicCategory,
  AdminProductListQuery,
  AdminProductListResponse,
  AdminSubcategory,
  CreateCategoryInput,
  CreateProductInput,
  CreateSubcategoryInput,
  ProductCard,
  ProductDetail,
  ProductListQuery,
  ProductListResponse,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateSubcategoryInput,
} from '@qc/shared';
import { capPublicTotal, ErrorCodes, slugify, stockStatus } from '@qc/shared';
import type { CatalogCache } from '../lib/catalog-cache.js';
import type { CatalogProduct, ProductPatch, ProductQuery } from '../domain/catalog.js';
import { AppError } from '../lib/errors.js';
import { uniqueConflict } from '../lib/unique-conflict.js';
import type { CategoryRepository } from '../repositories/category.repository.js';
import type { ProductRepository } from '../repositories/product.repository.js';
import type { SearchService } from './search.service.js';

const CATEGORY_SLUG_MAX = 100;
const PRODUCT_SLUG_MAX = 170;

export interface CatalogService {
  listPublicCategories(): Promise<PublicCategory[]>;
  listAdminCategories(includeInactive: boolean): Promise<AdminCategory[]>;
  createCategory(input: CreateCategoryInput): Promise<AdminCategory>;
  updateCategory(id: string, input: UpdateCategoryInput): Promise<AdminCategory>;
  deleteCategory(id: string): Promise<void>;
  createSubcategory(categoryId: string, input: CreateSubcategoryInput): Promise<AdminSubcategory>;
  updateSubcategory(id: string, input: UpdateSubcategoryInput): Promise<AdminSubcategory>;
  deleteSubcategory(id: string): Promise<void>;
  listPublicProducts(query: ProductListQuery): Promise<ProductListResponse>;
  getPublicProduct(slug: string): Promise<ProductDetail>;
  listAdminProducts(query: AdminProductListQuery): Promise<AdminProductListResponse>;
  getAdminProduct(id: string): Promise<AdminProduct>;
  createProduct(input: CreateProductInput): Promise<AdminProduct>;
  updateProduct(id: string, input: UpdateProductInput): Promise<AdminProduct>;
  deleteProduct(id: string): Promise<void>;
}

function notFound(message: string): AppError {
  return new AppError(404, ErrorCodes.NOT_FOUND, message);
}

function requireSlug(name: string, maxLength: number, explicit?: string): string {
  const slug = explicit ?? slugify(name, maxLength);
  if (slug === '') {
    throw new AppError(422, ErrorCodes.VALIDATION, 'Name must include a letter or number');
  }
  return slug;
}

function orderRows(rows: CatalogProduct[], ids: string[]): CatalogProduct[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: CatalogProduct[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
    }
  }
  return ordered;
}

function toCard(product: CatalogProduct): ProductCard {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    unitLabel: product.unitLabel,
    pricePaise: product.pricePaise,
    imageUrl: product.imageUrl,
    stockStatus: stockStatus(product.stock),
    category: product.category,
    subcategory: product.subcategory,
  };
}

function toDetail(product: CatalogProduct): ProductDetail {
  return {
    ...toCard(product),
    sku: product.sku,
    description: product.description,
    stock: product.stock,
  };
}

function toAdmin(product: CatalogProduct): AdminProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    unitLabel: product.unitLabel,
    pricePaise: product.pricePaise,
    stock: product.stock,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    deletedAt: product.deletedAt ? product.deletedAt.toISOString() : null,
    subcategoryId: product.subcategoryId,
    category: product.category,
    subcategory: product.subcategory,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function rethrowCategoryConflict(error: unknown, message: string): never {
  if (!uniqueConflict(error)) {
    throw error;
  }
  throw new AppError(409, ErrorCodes.NAME_TAKEN, message);
}

function rethrowProductConflict(error: unknown): never {
  const code = uniqueConflict(error);
  if (code === 'SKU_TAKEN') {
    throw new AppError(409, ErrorCodes.SKU_TAKEN, 'A product with this SKU already exists');
  }
  if (code === 'SLUG_TAKEN' || code === 'NAME_TAKEN') {
    throw new AppError(409, ErrorCodes.SLUG_TAKEN, 'A product with this address already exists');
  }
  throw error;
}

export function createCatalogService(deps: {
  categories: CategoryRepository;
  products: ProductRepository;
  search: SearchService;
  cache: CatalogCache;
  now?: () => Date;
}): CatalogService {
  const now = deps.now ?? ((): Date => new Date());

  async function requireLiveCategory(id: string) {
    const category = await deps.categories.findCategory(id);
    if (!category || category.deletedAt) {
      throw notFound('Category not found');
    }
    return category;
  }

  async function requireLiveSubcategory(id: string) {
    const subcategory = await deps.categories.findSubcategory(id);
    if (!subcategory || subcategory.deletedAt) {
      throw notFound('Subcategory not found');
    }
    return subcategory;
  }

  async function requireAdminCategory(id: string): Promise<AdminCategory> {
    const category = await deps.categories.getAdmin(id);
    if (!category) {
      throw notFound('Category not found');
    }
    return category;
  }

  async function requireSubcategoryResponse(id: string): Promise<AdminSubcategory> {
    const subcategory = await deps.categories.findSubcategory(id);
    if (!subcategory || subcategory.deletedAt) {
      throw notFound('Subcategory not found');
    }
    return {
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      slug: subcategory.slug,
      description: subcategory.description,
      sortOrder: subcategory.sortOrder,
      isActive: subcategory.isActive,
    };
  }

  async function listProducts(
    query: Omit<ProductQuery, 'mode'>,
    cap: boolean,
  ): Promise<{ rows: CatalogProduct[]; total: number }> {
    const found = await deps.search.search(query);
    const rows = orderRows(await deps.products.findManyByIds(found.ids), found.ids);
    return { rows, total: cap ? capPublicTotal(found.total) : found.total };
  }

  return {
    listPublicCategories() {
      return deps.categories.listPublic();
    },

    listAdminCategories(includeInactive: boolean) {
      return deps.categories.listAdmin(includeInactive);
    },

    async createCategory(input: CreateCategoryInput): Promise<AdminCategory> {
      const slug = requireSlug(input.name, CATEGORY_SLUG_MAX);
      if (await deps.categories.categoryNameTaken(input.name)) {
        throw new AppError(409, ErrorCodes.NAME_TAKEN, 'A category with this name already exists');
      }
      if (await deps.categories.categorySlugTaken(slug)) {
        throw new AppError(409, ErrorCodes.NAME_TAKEN, 'A category with this name already exists');
      }
      try {
        const created = await deps.categories.createCategory({
          name: input.name,
          slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });
        deps.cache.invalidate();
        return await requireAdminCategory(created.id);
      } catch (error: unknown) {
        rethrowCategoryConflict(error, 'A category with this name already exists');
      }
    },

    async updateCategory(id: string, input: UpdateCategoryInput): Promise<AdminCategory> {
      await requireLiveCategory(id);
      if (input.name !== undefined && (await deps.categories.categoryNameTaken(input.name, id))) {
        throw new AppError(409, ErrorCodes.NAME_TAKEN, 'A category with this name already exists');
      }
      try {
        await deps.categories.updateCategory(id, {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        });
        deps.cache.invalidate();
        return await requireAdminCategory(id);
      } catch (error: unknown) {
        rethrowCategoryConflict(error, 'A category with this name already exists');
      }
    },

    async deleteCategory(id: string): Promise<void> {
      await requireLiveCategory(id);
      const children = await deps.categories.countLiveSubcategories(id);
      if (children > 0) {
        throw new AppError(
          409,
          ErrorCodes.CATEGORY_NOT_EMPTY,
          'Remove the subcategories in this category first',
        );
      }
      await deps.categories.softDeleteCategory(id, now());
      deps.cache.invalidate();
    },

    async createSubcategory(
      categoryId: string,
      input: CreateSubcategoryInput,
    ): Promise<AdminSubcategory> {
      await requireLiveCategory(categoryId);
      const slug = requireSlug(input.name, CATEGORY_SLUG_MAX);
      if (await deps.categories.subcategoryNameTaken(categoryId, input.name)) {
        throw new AppError(
          409,
          ErrorCodes.NAME_TAKEN,
          'A subcategory with this name already exists',
        );
      }
      if (await deps.categories.subcategorySlugTaken(categoryId, slug)) {
        throw new AppError(
          409,
          ErrorCodes.NAME_TAKEN,
          'A subcategory with this name already exists',
        );
      }
      try {
        const created = await deps.categories.createSubcategory({
          categoryId,
          name: input.name,
          slug,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });
        deps.cache.invalidate();
        return await requireSubcategoryResponse(created.id);
      } catch (error: unknown) {
        rethrowCategoryConflict(error, 'A subcategory with this name already exists');
      }
    },

    async updateSubcategory(id: string, input: UpdateSubcategoryInput): Promise<AdminSubcategory> {
      const current = await requireLiveSubcategory(id);
      const categoryId = input.categoryId ?? current.categoryId;
      if (input.categoryId !== undefined) {
        await requireLiveCategory(input.categoryId);
      }
      const name = input.name ?? current.name;
      if (
        (input.name !== undefined || input.categoryId !== undefined) &&
        (await deps.categories.subcategoryNameTaken(categoryId, name, id))
      ) {
        throw new AppError(
          409,
          ErrorCodes.NAME_TAKEN,
          'A subcategory with this name already exists',
        );
      }
      if (
        input.categoryId !== undefined &&
        (await deps.categories.subcategorySlugTaken(categoryId, current.slug, id))
      ) {
        throw new AppError(
          409,
          ErrorCodes.NAME_TAKEN,
          'A subcategory with this name already exists in that category',
        );
      }
      try {
        await deps.categories.updateSubcategory(id, {
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        });
        deps.cache.invalidate();
        return await requireSubcategoryResponse(id);
      } catch (error: unknown) {
        rethrowCategoryConflict(error, 'A subcategory with this name already exists');
      }
    },

    async deleteSubcategory(id: string): Promise<void> {
      await requireLiveSubcategory(id);
      const products = await deps.categories.countLiveProducts(id);
      if (products > 0) {
        throw new AppError(
          409,
          ErrorCodes.SUBCATEGORY_NOT_EMPTY,
          'Remove the products in this subcategory first',
        );
      }
      await deps.categories.softDeleteSubcategory(id, now());
      deps.cache.invalidate();
    },

    async listPublicProducts(query: ProductListQuery): Promise<ProductListResponse> {
      const { rows, total } = await listProducts(
        {
          audience: 'public',
          q: query.q,
          categoryId: query.categoryId,
          subcategoryId: query.subcategoryId,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          inStock: query.inStock === 'true',
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        },
        true,
      );
      return {
        items: rows.map(toCard),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    async getPublicProduct(slug: string): Promise<ProductDetail> {
      const product = await deps.products.findPublicBySlug(slug);
      if (!product) {
        throw notFound('Product not found');
      }
      return toDetail(product);
    },

    async listAdminProducts(query: AdminProductListQuery): Promise<AdminProductListResponse> {
      const { rows, total } = await listProducts(
        {
          audience: 'admin',
          q: query.q,
          categoryId: query.categoryId,
          subcategoryId: query.subcategoryId,
          status: query.status,
          lowStock: query.lowStock === 'true',
          sort: query.q ? 'relevance' : 'newest',
          page: query.page,
          pageSize: query.pageSize,
        },
        false,
      );
      return {
        items: rows.map(toAdmin),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    async getAdminProduct(id: string): Promise<AdminProduct> {
      const product = await deps.products.findById(id);
      if (!product) {
        throw notFound('Product not found');
      }
      return toAdmin(product);
    },

    async createProduct(input: CreateProductInput): Promise<AdminProduct> {
      if (!(await deps.products.subcategoryIsLive(input.subcategoryId))) {
        throw notFound('Subcategory not found');
      }
      const slug = requireSlug(input.name, PRODUCT_SLUG_MAX, input.slug);
      if (await deps.products.skuTaken(input.sku)) {
        throw new AppError(409, ErrorCodes.SKU_TAKEN, 'A product with this SKU already exists');
      }
      if (await deps.products.slugTaken(slug)) {
        throw new AppError(
          409,
          ErrorCodes.SLUG_TAKEN,
          'A product with this address already exists',
        );
      }
      try {
        const created = await deps.products.create({
          subcategoryId: input.subcategoryId,
          name: input.name,
          slug,
          sku: input.sku,
          description: input.description ?? null,
          unitLabel: input.unitLabel,
          pricePaise: input.pricePaise,
          stock: input.stock,
          imageUrl: input.imageUrl ?? null,
          isActive: input.isActive,
        });
        deps.cache.invalidate();
        return toAdmin(created);
      } catch (error: unknown) {
        rethrowProductConflict(error);
      }
    },

    async updateProduct(id: string, input: UpdateProductInput): Promise<AdminProduct> {
      const current = await deps.products.findById(id);
      if (!current) {
        throw notFound('Product not found');
      }
      if (
        input.subcategoryId !== undefined &&
        !(await deps.products.subcategoryIsLive(input.subcategoryId))
      ) {
        throw notFound('Subcategory not found');
      }
      if (input.sku !== undefined && (await deps.products.skuTaken(input.sku, id))) {
        throw new AppError(409, ErrorCodes.SKU_TAKEN, 'A product with this SKU already exists');
      }
      if (input.slug !== undefined && (await deps.products.slugTaken(input.slug, id))) {
        throw new AppError(
          409,
          ErrorCodes.SLUG_TAKEN,
          'A product with this address already exists',
        );
      }
      const patch: ProductPatch = {
        ...(input.subcategoryId !== undefined ? { subcategoryId: input.subcategoryId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unitLabel !== undefined ? { unitLabel: input.unitLabel } : {}),
        ...(input.pricePaise !== undefined ? { pricePaise: input.pricePaise } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };
      try {
        await deps.products.update(id, patch);
        deps.cache.invalidate();
        const updated = await deps.products.findById(id);
        if (!updated) {
          throw notFound('Product not found');
        }
        return toAdmin(updated);
      } catch (error: unknown) {
        if (error instanceof AppError) {
          throw error;
        }
        rethrowProductConflict(error);
      }
    },

    async deleteProduct(id: string): Promise<void> {
      const current = await deps.products.findById(id);
      if (!current || current.deletedAt) {
        throw notFound('Product not found');
      }
      await deps.products.softDelete(id, now());
      deps.cache.invalidate();
    },
  };
}
