import { Router, type RequestHandler } from 'express';
import type { CartController } from '../controllers/cart.controller.js';
import { asyncRoute } from '../lib/async-route.js';

export function createCartRouter(deps: {
  cart: CartController;
  requireCustomer: RequestHandler;
}): Router {
  const router = Router();
  const customer = deps.requireCustomer;
  router.get(
    '/cart',
    customer,
    asyncRoute(async (req, res) => {
      await deps.cart.get(req, res);
    }),
  );
  router.post(
    '/cart/items',
    customer,
    asyncRoute(async (req, res) => {
      await deps.cart.addItem(req, res);
    }),
  );
  router.patch(
    '/cart/items/:itemId',
    customer,
    asyncRoute(async (req, res) => {
      await deps.cart.updateItem(req, res);
    }),
  );
  router.delete(
    '/cart/items/:itemId',
    customer,
    asyncRoute(async (req, res) => {
      await deps.cart.removeItem(req, res);
    }),
  );
  router.delete(
    '/cart',
    customer,
    asyncRoute(async (req, res) => {
      await deps.cart.clear(req, res);
    }),
  );
  return router;
}
