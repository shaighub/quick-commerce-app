import type { Request, Response } from 'express';
import { addCartItemSchema, idParamSchema, updateCartItemSchema, ErrorCodes } from '@qc/shared';
import { AppError } from '../lib/errors.js';
import { routeParam } from '../lib/request-input.js';
import type { CartService } from '../services/cart.service.js';

export interface CartController {
  get(req: Request, res: Response): Promise<void>;
  addItem(req: Request, res: Response): Promise<void>;
  updateItem(req: Request, res: Response): Promise<void>;
  removeItem(req: Request, res: Response): Promise<void>;
  clear(req: Request, res: Response): Promise<void>;
}

function userId(req: Request): string {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.auth.id;
}

export function createCartController(carts: CartService): CartController {
  return {
    async get(req: Request, res: Response): Promise<void> {
      const cart = await carts.get(userId(req));
      res.status(200).json(cart);
    },
    async addItem(req: Request, res: Response): Promise<void> {
      const body = addCartItemSchema.parse(req.body);
      const cart = await carts.addItem(userId(req), body.productId, body.quantity);
      res.status(200).json(cart);
    },
    async updateItem(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.itemId) });
      const body = updateCartItemSchema.parse(req.body);
      const cart = await carts.updateItem(userId(req), id, body.quantity);
      res.status(200).json(cart);
    },
    async removeItem(req: Request, res: Response): Promise<void> {
      const { id } = idParamSchema.parse({ id: routeParam(req.params.itemId) });
      const cart = await carts.removeItem(userId(req), id);
      res.status(200).json(cart);
    },
    async clear(req: Request, res: Response): Promise<void> {
      await carts.clear(userId(req));
      res.status(204).send();
    },
  };
}
