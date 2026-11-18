import { Router, type RequestHandler } from 'express';
import { asyncRoute } from '../lib/async-route.js';
import type { CatalogController } from '../controllers/catalog.controller.js';
import type { ServiceabilityController } from '../controllers/serviceability.controller.js';

export function createCatalogRouter(deps: {
  catalog: CatalogController;
  serviceability: ServiceabilityController;
  requireAdmin: RequestHandler;
}): Router {
  const router = Router();
  const admin = deps.requireAdmin;

  router.get(
    '/categories',
    asyncRoute(async (req, res) => {
      await deps.catalog.listCategories(req, res);
    }),
  );
  router.get(
    '/admin/categories',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.listAdminCategories(req, res);
    }),
  );
  router.post(
    '/admin/categories',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.createCategory(req, res);
    }),
  );
  router.patch(
    '/admin/categories/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.updateCategory(req, res);
    }),
  );
  router.delete(
    '/admin/categories/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.deleteCategory(req, res);
    }),
  );
  router.post(
    '/admin/categories/:id/subcategories',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.createSubcategory(req, res);
    }),
  );
  router.patch(
    '/admin/subcategories/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.updateSubcategory(req, res);
    }),
  );
  router.delete(
    '/admin/subcategories/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.deleteSubcategory(req, res);
    }),
  );

  router.get(
    '/products',
    asyncRoute(async (req, res) => {
      await deps.catalog.listProducts(req, res);
    }),
  );
  router.get(
    '/products/:slug',
    asyncRoute(async (req, res) => {
      await deps.catalog.getProduct(req, res);
    }),
  );
  router.get(
    '/admin/products',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.listAdminProducts(req, res);
    }),
  );
  router.get(
    '/admin/products/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.getAdminProduct(req, res);
    }),
  );
  router.post(
    '/admin/products',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.createProduct(req, res);
    }),
  );
  router.patch(
    '/admin/products/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.updateProduct(req, res);
    }),
  );
  router.delete(
    '/admin/products/:id',
    admin,
    asyncRoute(async (req, res) => {
      await deps.catalog.deleteProduct(req, res);
    }),
  );

  router.get(
    '/serviceability',
    asyncRoute(async (req, res) => {
      await deps.serviceability.check(req, res);
    }),
  );

  return router;
}
