import type { Request, Response } from 'express';
import {
  adminOrderListQuerySchema,
  checkoutSchema,
  ErrorCodes,
  idempotencyKeySchema,
  orderNumberSchema,
  paginationQuerySchema,
  updateOrderStatusSchema,
} from '@qc/shared';
import { AppError } from '../lib/errors.js';
import { queryRecord, routeParam } from '../lib/request-input.js';
import type { OrderService } from '../services/order.service.js';

export interface OrderController {
  checkout(req: Request, res: Response): Promise<void>;
  list(req: Request, res: Response): Promise<void>;
  get(req: Request, res: Response): Promise<void>;
  listAdmin(req: Request, res: Response): Promise<void>;
  getAdmin(req: Request, res: Response): Promise<void>;
  updateStatus(req: Request, res: Response): Promise<void>;
  dashboard(req: Request, res: Response): Promise<void>;
}

function userId(req: Request): string {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.auth.id;
}

export function createOrderController(orders: OrderService): OrderController {
  return {
    async checkout(req: Request, res: Response): Promise<void> {
      const idempotencyKey = idempotencyKeySchema.parse(req.get('idempotency-key') ?? '');
      const body = checkoutSchema.parse(req.body);
      const order = await orders.checkout(userId(req), idempotencyKey, body);
      res.status(201).json({ order });
    },
    async list(req: Request, res: Response): Promise<void> {
      const query = paginationQuerySchema.parse(queryRecord(req.query));
      const page = await orders.listOwn(userId(req), query);
      res.status(200).json(page);
    },
    async get(req: Request, res: Response): Promise<void> {
      const orderNumber = orderNumberSchema.parse(routeParam(req.params.orderNumber));
      const order = await orders.getOwn(userId(req), orderNumber);
      res.status(200).json({ order });
    },
    async listAdmin(req: Request, res: Response): Promise<void> {
      const query = adminOrderListQuerySchema.parse(queryRecord(req.query));
      const page = await orders.listAdmin(query);
      res.status(200).json(page);
    },
    async getAdmin(req: Request, res: Response): Promise<void> {
      const orderNumber = orderNumberSchema.parse(routeParam(req.params.orderNumber));
      const detail = await orders.getAdmin(orderNumber);
      res.status(200).json(detail);
    },
    async updateStatus(req: Request, res: Response): Promise<void> {
      const orderNumber = orderNumberSchema.parse(routeParam(req.params.orderNumber));
      const body = updateOrderStatusSchema.parse(req.body);
      const detail = await orders.updateStatus(orderNumber, body.status, userId(req), body.note);
      res.status(200).json(detail);
    },
    async dashboard(_req: Request, res: Response): Promise<void> {
      const summary = await orders.dashboard();
      res.status(200).json(summary);
    },
  };
}
