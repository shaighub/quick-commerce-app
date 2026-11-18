import type { Request, Response } from 'express';
import {
  adminCategoryListQuerySchema,
  adminProductListQuerySchema,
  createCategoryBodySchema,
  createProductBodySchema,
  createSubcategoryBodySchema,
  idParamSchema,
  productListQuerySchema,
  slugParamSchema,
  updateCategoryBodySchema,
  updateProductBodySchema,
  updateSubcategoryBodySchema,
} from '@qc/shared';
import type { CatalogCache } from '../lib/catalog-cache.js';
import { sendCached, storeAndSend } from '../lib/http-cache.js';
import { normalizeCatalogBody, queryRecord, routeParam } from '../lib/request-input.js';
import type { CatalogService } from '../services/catalog.service.js';

export interface CatalogController {
  listCategories(req: Request, res: Response): Promise<void>;
  listAdminCategories(req: Request, res: Response): Promise<void>;
  createCategory(req: Request, res: Response): Promise<void>;
  updateCategory(req: Request, res: Response): Promise<void>;
  deleteCategory(req: Request, res: Response): Promise<void>;
  createSubcategory(req: Request, res: Response): Promise<void>;
  updateSubcategory(req: Request, res: Response): Promise<void>;
  deleteSubcategory(req: Request, res: Response): Promise<void>;
  listProducts(req: Request, res: Response): Promise<void>;
  getProduct(req: Request, res: Response): Promise<void>;
  listAdminProducts(req: Request, res: Response): Promise<void>;
  getAdminProduct(req: Request, res: Response): Promise<void>;
  createProduct(req: Request, res: Response): Promise<void>;
  updateProduct(req: Request, res: Response): Promise<void>;
  deleteProduct(req: Request, res: Response): Promise<void>;
}

export function createCatalogController(deps: {
  catalog: CatalogService;
  cache: CatalogCache;
  imageHosts: readonly string[];
}): CatalogController {
  const createCategorySchema = createCategoryBodySchema(deps.imageHosts);
  const updateCategorySchema = updateCategoryBodySchema(deps.imageHosts);
  const createSubcategorySchema = createSubcategoryBodySchema();
  const updateSubcategorySchema = updateSubcategoryBodySchema();
  const createProductSchema = createProductBodySchema(deps.imageHosts);
  const updateProductSchema = updateProductBodySchema(deps.imageHosts);

  return {
    async listCategories(req: Request, res: Response): Promise<void> {
      const key = 'categories';
      if (sendCached(req, res, deps.cache, key)) {
        return;
      }
      const categories = await deps.catalog.listPublicCategories();
      storeAndSend(req, res, deps.cache, key, categories);
    },

    async listAdminCategories(req: Request, res: Response): Promise<void> {
      const query = adminCategoryListQuerySchema.parse(queryRecord(req.query));
      const categories = await deps.catalog.listAdminCategories(query.includeInactive === 'true');
      res.status(200).json(categories);
    },

    async createCategory(req: Request, res: Response): Promise<void> {
      const body = createCategorySchema.parse(normalizeCatalogBody(req.body));
      const category = await deps.catalog.createCategory(body);
      res.status(201).json({ category });
    },

    async updateCategory(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      const body = updateCategorySchema.parse(normalizeCatalogBody(req.body));
      const category = await deps.catalog.updateCategory(id, body);
      res.status(200).json({ category });
    },

    async deleteCategory(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      await deps.catalog.deleteCategory(id);
      res.status(204).send();
    },

    async createSubcategory(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      const body = createSubcategorySchema.parse(normalizeCatalogBody(req.body));
      const subcategory = await deps.catalog.createSubcategory(id, body);
      res.status(201).json({ subcategory });
    },

    async updateSubcategory(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      const body = updateSubcategorySchema.parse(normalizeCatalogBody(req.body));
      const subcategory = await deps.catalog.updateSubcategory(id, body);
      res.status(200).json({ subcategory });
    },

    async deleteSubcategory(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      await deps.catalog.deleteSubcategory(id);
      res.status(204).send();
    },

    async listProducts(req: Request, res: Response): Promise<void> {
      const query = productListQuerySchema.parse(queryRecord(req.query));
      const key = `products:${JSON.stringify(query)}`;
      if (sendCached(req, res, deps.cache, key)) {
        return;
      }
      const products = await deps.catalog.listPublicProducts(query);
      storeAndSend(req, res, deps.cache, key, products);
    },

    async getProduct(req: Request, res: Response): Promise<void> {
      const { slug } = slugParamSchema.parse({ slug: routeParam(req.params.slug) });
      const key = `product:${slug}`;
      if (sendCached(req, res, deps.cache, key)) {
        return;
      }
      const product = await deps.catalog.getPublicProduct(slug);
      storeAndSend(req, res, deps.cache, key, { product });
    },

    async listAdminProducts(req: Request, res: Response): Promise<void> {
      const query = adminProductListQuerySchema.parse(queryRecord(req.query));
      const products = await deps.catalog.listAdminProducts(query);
      res.status(200).json(products);
    },

    async getAdminProduct(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      const product = await deps.catalog.getAdminProduct(id);
      res.status(200).json({ product });
    },

    async createProduct(req: Request, res: Response): Promise<void> {
      const body = createProductSchema.parse(normalizeCatalogBody(req.body));
      const product = await deps.catalog.createProduct(body);
      res.status(201).json({ product });
    },

    async updateProduct(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      const body = updateProductSchema.parse(normalizeCatalogBody(req.body));
      const product = await deps.catalog.updateProduct(id, body);
      res.status(200).json({ product });
    },

    async deleteProduct(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.id) });
      await deps.catalog.deleteProduct(id);
      res.status(204).send();
    },
  };
}
