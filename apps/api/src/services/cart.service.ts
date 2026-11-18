import { type Cart, ErrorCodes, lineIsAvailable, lineTotalPaise, summarizeCart } from '@qc/shared';
import { AppError } from '../lib/errors.js';
import type {
  CartLineRow,
  CartProductRow,
  CartRepository,
} from '../repositories/cart.repository.js';

export interface CartService {
  get(userId: string): Promise<Cart>;
  addItem(userId: string, productId: string, quantity: number): Promise<Cart>;
  updateItem(userId: string, itemId: string, quantity: number): Promise<Cart>;
  removeItem(userId: string, itemId: string): Promise<Cart>;
  clear(userId: string): Promise<void>;
}

export interface CartPriceOverride {
  pricePaise: number;
  stock: number;
  isActive: boolean;
  deleted: boolean;
}

export function presentCart(
  lines: readonly CartLineRow[],
  deliveryFeePaise: number,
  overrides?: ReadonlyMap<string, CartPriceOverride>,
): Cart {
  const items = lines.map((line) => {
    const override = overrides?.get(line.product.id);
    const deleted = override ? override.deleted : line.product.deletedAt !== null;
    const isActive = override ? override.isActive : line.product.isActive;
    const stock = override ? override.stock : line.product.stock;
    const pricePaise = override ? override.pricePaise : line.product.pricePaise;
    const available = lineIsAvailable({ isActive, deleted, stock, quantity: line.quantity });
    return {
      id: line.id,
      quantity: line.quantity,
      lineTotalPaise: lineTotalPaise(pricePaise, line.quantity),
      available,
      product: {
        id: line.product.id,
        name: line.product.name,
        slug: line.product.slug,
        unitLabel: line.product.unitLabel,
        pricePaise,
        imageUrl: line.product.imageUrl,
        stock,
        isActive: isActive && !deleted,
      },
    };
  });
  const totals = summarizeCart(
    items.map((item) => ({
      unitPricePaise: item.product.pricePaise,
      quantity: item.quantity,
      available: item.available,
    })),
    deliveryFeePaise,
  );
  return { items, ...totals };
}

function insufficient(product: CartProductRow): AppError {
  return new AppError(409, ErrorCodes.INSUFFICIENT_STOCK, `Only ${product.stock} left`, [
    { productId: product.id, available: product.stock },
  ]);
}

function quantityTooHigh(): AppError {
  return new AppError(422, ErrorCodes.VALIDATION, 'Quantity must be between 1 and 10', [
    { path: 'quantity', message: 'Quantity must be between 1 and 10' },
  ]);
}

function productMissing(): AppError {
  return new AppError(404, ErrorCodes.NOT_FOUND, 'Product not found');
}

export function createCartService(deps: {
  carts: CartRepository;
  deliveryFeePaise: number;
}): CartService {
  async function view(userId: string): Promise<Cart> {
    const lines = await deps.carts.findLines(userId);
    return presentCart(lines, deps.deliveryFeePaise);
  }

  return {
    get: view,
    async addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
      const product = await deps.carts.findProduct(productId);
      if (!product || !product.isActive || product.deletedAt) {
        throw productMissing();
      }
      if (product.stock < quantity) {
        throw insufficient(product);
      }
      const existing = await deps.carts.findLineByProduct(userId, productId);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      if (nextQuantity > 10) {
        throw quantityTooHigh();
      }
      if (product.stock < nextQuantity) {
        throw insufficient(product);
      }
      const cartId = await deps.carts.ensureCart(userId);
      if (existing) {
        await deps.carts.setQuantity(existing.id, nextQuantity);
      } else {
        await deps.carts.insertLine(cartId, productId, quantity);
      }
      return view(userId);
    },
    async updateItem(userId: string, itemId: string, quantity: number): Promise<Cart> {
      const line = await deps.carts.findLine(userId, itemId);
      if (!line) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, 'Cart item not found');
      }
      if (line.product.stock < quantity) {
        throw insufficient(line.product);
      }
      await deps.carts.setQuantity(line.id, quantity);
      return view(userId);
    },
    async removeItem(userId: string, itemId: string): Promise<Cart> {
      const removed = await deps.carts.deleteLine(userId, itemId);
      if (!removed) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, 'Cart item not found');
      }
      return view(userId);
    },
    async clear(userId: string): Promise<void> {
      await deps.carts.clear(userId);
    },
  };
}
