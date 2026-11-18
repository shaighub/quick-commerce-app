import { Router, type RequestHandler } from 'express';
import type { OrderController } from '../controllers/order.controller.js';
import { asyncRoute } from '../lib/async-route.js';

export function createOrderRouter(deps: {
  orders: OrderController;
  requireCustomer: RequestHandler;
  requireAdmin: RequestHandler;
}): Router {
  const router = Router();
  const customer = deps.requireCustomer;
  const admin = deps.requireAdmin;

  router.post(
    '/orders/checkout',
    customer,
    asyncRoute(async (req, res) => {
      await deps.orders.checkout(req, res);
    }),
  );
  router.get(
    '/orders',
    customer,
    asyncRoute(async (req, res) => {
      await deps.orders.list(req, res);
    }),
  );
  router.get(
    '/orders/:orderNumber',
    customer,
    asyncRoute(async (req, res) => {
      await deps.orders.get(req, res);
    }),
  );
  router.get(
    '/admin/orders',
    admin,
    asyncRoute(async (req, res) => {
      await deps.orders.listAdmin(req, res);
    }),
  );
  router.get(
    '/admin/orders/:orderNumber',
    admin,
    asyncRoute(async (req, res) => {
      await deps.orders.getAdmin(req, res);
    }),
  );
  router.patch(
    '/admin/orders/:orderNumber/status',
    admin,
    asyncRoute(async (req, res) => {
      await deps.orders.updateStatus(req, res);
    }),
  );
  router.get(
    '/admin/dashboard',
    admin,
    asyncRoute(async (req, res) => {
      await deps.orders.dashboard(req, res);
    }),
  );
  return router;
}
