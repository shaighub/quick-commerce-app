import type { PrismaClient } from '../generated/prisma/client.js';

export interface CartProductRow {
  id: string;
  name: string;
  slug: string;
  unitLabel: string;
  pricePaise: number;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface CartLineRow {
  id: string;
  quantity: number;
  product: CartProductRow;
}

export interface CartRepository {
  findLines(userId: string): Promise<CartLineRow[]>;
  findProduct(productId: string): Promise<CartProductRow | null>;
  findLine(userId: string, itemId: string): Promise<CartLineRow | null>;
  findLineByProduct(
    userId: string,
    productId: string,
  ): Promise<{ id: string; quantity: number } | null>;
  ensureCart(userId: string): Promise<string>;
  insertLine(cartId: string, productId: string, quantity: number): Promise<void>;
  setQuantity(itemId: string, quantity: number): Promise<void>;
  deleteLine(userId: string, itemId: string): Promise<boolean>;
  clear(userId: string): Promise<void>;
}

function toProduct(row: {
  id: string;
  name: string;
  slug: string;
  unitLabel: string;
  pricePaise: number;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  deletedAt: Date | null;
}): CartProductRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    unitLabel: row.unitLabel,
    pricePaise: row.pricePaise,
    imageUrl: row.imageUrl,
    stock: row.stock,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
  };
}

export function createCartRepository(prisma: PrismaClient): CartRepository {
  return {
    async findLines(userId: string): Promise<CartLineRow[]> {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!cart) {
        return [];
      }
      return cart.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: toProduct(item.product),
      }));
    },
    async findProduct(productId: string): Promise<CartProductRow | null> {
      const row = await prisma.product.findUnique({ where: { id: productId } });
      return row ? toProduct(row) : null;
    },
    async findLine(userId: string, itemId: string): Promise<CartLineRow | null> {
      const item = await prisma.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
        include: { product: true },
      });
      if (!item) {
        return null;
      }
      return { id: item.id, quantity: item.quantity, product: toProduct(item.product) };
    },
    async findLineByProduct(
      userId: string,
      productId: string,
    ): Promise<{ id: string; quantity: number } | null> {
      const item = await prisma.cartItem.findFirst({
        where: { productId, cart: { userId } },
        select: { id: true, quantity: true },
      });
      return item;
    },
    async ensureCart(userId: string): Promise<string> {
      const cart = await prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });
      return cart.id;
    },
    async insertLine(cartId: string, productId: string, quantity: number): Promise<void> {
      await prisma.cartItem.create({ data: { cartId, productId, quantity } });
    },
    async setQuantity(itemId: string, quantity: number): Promise<void> {
      await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    },
    async deleteLine(userId: string, itemId: string): Promise<boolean> {
      const result = await prisma.cartItem.deleteMany({
        where: { id: itemId, cart: { userId } },
      });
      return result.count === 1;
    },
    async clear(userId: string): Promise<void> {
      await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    },
  };
}
