import { z } from 'zod';
import { indianPincodeSchema, pricePaiseSchema, uuidSchema } from './ids.js';
import { optionalImageUrlSchema } from './image-url.js';
import { paginationQuerySchema } from './pagination.js';

export const STOCK_LOW_AT = 5;

export const stockStatusSchema = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']);

export type StockStatus = z.infer<typeof stockStatusSchema>;

export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) {
    return 'OUT_OF_STOCK';
  }
  if (stock <= STOCK_LOW_AT) {
    return 'LOW_STOCK';
  }
  return 'IN_STOCK';
}

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'Name must be at most 80 characters');

export const productNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(150, 'Name must be at most 150 characters');

export const catalogDescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters')
  .nullable()
  .optional();

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(5000, 'Description must be at most 5000 characters')
  .nullable()
  .optional();

export const sortOrderSchema = z.number().int().min(-1_000_000).max(1_000_000);

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(170, 'Slug must be at most 170 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens');

export const skuSchema = z
  .string()
  .trim()
  .min(1, 'SKU is required')
  .max(40, 'SKU must be at most 40 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'SKU must start with a letter or number');

export const unitLabelSchema = z
  .string()
  .trim()
  .min(1, 'Unit is required')
  .max(40, 'Unit must be at most 40 characters');

export const stockSchema = z.number().int().nonnegative().max(1_000_000);

const boundedPriceSchema = pricePaiseSchema.max(2_000_000_000);

export function createCategoryBodySchema(hosts: readonly string[]) {
  return z.object({
    name: categoryNameSchema,
    description: catalogDescriptionSchema,
    imageUrl: optionalImageUrlSchema(hosts),
    sortOrder: sortOrderSchema.optional(),
    isActive: z.boolean().optional(),
  });
}

export function updateCategoryBodySchema(hosts: readonly string[]) {
  return createCategoryBodySchema(hosts).partial();
}

export function createSubcategoryBodySchema() {
  return z.object({
    name: categoryNameSchema,
    description: catalogDescriptionSchema,
    sortOrder: sortOrderSchema.optional(),
    isActive: z.boolean().optional(),
  });
}

export function updateSubcategoryBodySchema() {
  return createSubcategoryBodySchema().partial().extend({
    categoryId: uuidSchema.optional(),
  });
}

export function createProductBodySchema(hosts: readonly string[]) {
  return z.object({
    name: productNameSchema,
    slug: slugSchema.optional(),
    sku: skuSchema,
    subcategoryId: uuidSchema,
    pricePaise: boundedPriceSchema,
    unitLabel: unitLabelSchema,
    stock: stockSchema,
    imageUrl: optionalImageUrlSchema(hosts),
    description: productDescriptionSchema,
    isActive: z.boolean(),
  });
}

export function updateProductBodySchema(hosts: readonly string[]) {
  return createProductBodySchema(hosts).partial();
}

export type CreateCategoryInput = z.infer<ReturnType<typeof createCategoryBodySchema>>;
export type UpdateCategoryInput = z.infer<ReturnType<typeof updateCategoryBodySchema>>;
export type CreateSubcategoryInput = z.infer<ReturnType<typeof createSubcategoryBodySchema>>;
export type UpdateSubcategoryInput = z.infer<ReturnType<typeof updateSubcategoryBodySchema>>;
export type CreateProductInput = z.infer<ReturnType<typeof createProductBodySchema>>;
export type UpdateProductInput = z.infer<ReturnType<typeof updateProductBodySchema>>;

function blankToUndefined(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (value === '' || value === null) {
    return undefined;
  }
  return value;
}

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().min(1).max(max).optional());

const optionalUuid = z.preprocess(blankToUndefined, uuidSchema.optional());

const optionalPaise = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().nonnegative().max(2_000_000_000).optional(),
);

const optionalFlag = z.preprocess(blankToUndefined, z.enum(['true', 'false']).optional());

export const productSortSchema = z.enum(['relevance', 'price_asc', 'price_desc', 'newest']);

export type ProductSort = z.infer<typeof productSortSchema>;

export const productListQuerySchema = paginationQuerySchema
  .extend({
    q: optionalText(200),
    categoryId: optionalUuid,
    subcategoryId: optionalUuid,
    minPrice: optionalPaise,
    maxPrice: optionalPaise,
    inStock: optionalFlag,
    sort: z.preprocess(blankToUndefined, productSortSchema.default('relevance')),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: 'minPrice cannot be greater than maxPrice', path: ['minPrice'] },
  );

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const adminProductStatusSchema = z.enum(['active', 'inactive', 'deleted']);

export type AdminProductStatus = z.infer<typeof adminProductStatusSchema>;

export const adminProductListQuerySchema = paginationQuerySchema.extend({
  q: optionalText(200),
  categoryId: optionalUuid,
  subcategoryId: optionalUuid,
  status: z.preprocess(blankToUndefined, adminProductStatusSchema.optional()),
  lowStock: optionalFlag,
});

export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

export const adminCategoryListQuerySchema = z.object({
  includeInactive: optionalFlag,
});

export type AdminCategoryListQuery = z.infer<typeof adminCategoryListQuerySchema>;

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(170)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens'),
});

export const serviceabilityQuerySchema = z.object({
  pincode: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    indianPincodeSchema,
  ),
});

export const catalogRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
});

export const productCardSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  unitLabel: z.string(),
  pricePaise: z.number().int(),
  imageUrl: z.string().nullable(),
  stockStatus: stockStatusSchema,
  category: catalogRefSchema,
  subcategory: catalogRefSchema,
});

export type ProductCard = z.infer<typeof productCardSchema>;

export const productListResponseSchema = z.object({
  items: z.array(productCardSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const productDetailSchema = productCardSchema.extend({
  sku: z.string(),
  description: z.string().nullable(),
  stock: z.number().int(),
});

export type ProductDetail = z.infer<typeof productDetailSchema>;

export const productDetailResponseSchema = z.object({
  product: productDetailSchema,
});

export const publicSubcategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
});

export const publicCategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable(),
  subcategories: z.array(publicSubcategorySchema),
});

export type PublicCategory = z.infer<typeof publicCategorySchema>;

export const publicCategoryListSchema = z.array(publicCategorySchema);

export const adminSubcategorySchema = z.object({
  id: uuidSchema,
  categoryId: uuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export type AdminSubcategory = z.infer<typeof adminSubcategorySchema>;

export const adminCategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  subcategoryCount: z.number().int(),
  productCount: z.number().int(),
  subcategories: z.array(adminSubcategorySchema),
});

export type AdminCategory = z.infer<typeof adminCategorySchema>;

export const adminCategoryListSchema = z.array(adminCategorySchema);

export const categoryResponseSchema = z.object({
  category: adminCategorySchema,
});

export const subcategoryResponseSchema = z.object({
  subcategory: adminSubcategorySchema,
});

export const adminProductSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  unitLabel: z.string(),
  pricePaise: z.number().int(),
  stock: z.number().int(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  deletedAt: z.string().nullable(),
  subcategoryId: uuidSchema,
  category: catalogRefSchema,
  subcategory: catalogRefSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminProduct = z.infer<typeof adminProductSchema>;

export const adminProductResponseSchema = z.object({
  product: adminProductSchema,
});

export const adminProductListResponseSchema = z.object({
  items: z.array(adminProductSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type AdminProductListResponse = z.infer<typeof adminProductListResponseSchema>;

export const serviceabilityResponseSchema = z.object({
  pincode: indianPincodeSchema,
  serviceable: z.boolean(),
  deliveryFeePaise: z.number().int().nonnegative(),
});

export type ServiceabilityResponse = z.infer<typeof serviceabilityResponseSchema>;

/** Public list totals stop at 1,000 so deep pages cannot force a full count (ADR-007). */
export function capPublicTotal(total: number): number {
  return Math.min(total, 1000);
}
