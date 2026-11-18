import type { OrderStatus, PaymentStatus } from '@qc/shared';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient | Prisma.TransactionClient;

export interface LockedProduct {
  id: string;
  name: string;
  sku: string;
  unitLabel: string;
  pricePaise: number;
  stock: number;
  isActive: boolean;
  deleted: boolean;
}

export interface IdempotencyHit {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  requestHash: string;
  totalPaise: number;
}

export interface LoadedOrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitLabel: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface LoadedPayment {
  id: string;
  provider: string;
  status: PaymentStatus;
  amountPaise: number;
  currency: string;
  providerRef: string | null;
  failureReason: string | null;
}

export interface LoadedHistory {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: Date;
  changedById: string | null;
}

export interface LoadedOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  itemCount: number;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  placedAt: Date;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  customer: { id: string; name: string; email: string };
  items: LoadedOrderItem[];
  payments: LoadedPayment[];
  history: LoadedHistory[];
}

export interface InsertOrderInput {
  orderNumber: string;
  userId: string;
  idempotencyKey: string;
  requestHash: string;
  itemCount: number;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    unitLabel: string;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
  }>;
}

const orderInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  history: { orderBy: { createdAt: 'asc' as const } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function trimChar(value: string): string {
  return value.trim();
}

function toLoaded(row: OrderRow): LoadedOrder {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    userId: row.userId,
    status: row.status,
    itemCount: row.itemCount,
    subtotalPaise: row.subtotalPaise,
    deliveryFeePaise: row.deliveryFeePaise,
    totalPaise: row.totalPaise,
    placedAt: row.placedAt,
    shipName: row.shipName,
    shipPhone: trimChar(row.shipPhone),
    shipLine1: row.shipLine1,
    shipLine2: row.shipLine2,
    shipCity: row.shipCity,
    shipState: row.shipState,
    shipPincode: trimChar(row.shipPincode),
    customer: row.user,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitLabel: item.unitLabel,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      lineTotalPaise: item.lineTotalPaise,
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: trimChar(payment.currency),
      providerRef: payment.providerRef,
      failureReason: payment.failureReason,
    })),
    history: row.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      createdAt: entry.createdAt,
      changedById: entry.changedById,
    })),
  };
}

export interface OrderRepository {
  findIdempotency(userId: string, idempotencyKey: string): Promise<IdempotencyHit | null>;
  findByNumber(orderNumber: string): Promise<LoadedOrder | null>;
  findOwn(userId: string, orderNumber: string): Promise<LoadedOrder | null>;
  lockProducts(tx: Db, ids: readonly string[]): Promise<LockedProduct[]>;
  decrementStock(tx: Db, productId: string, quantity: number): Promise<boolean>;
  restock(tx: Db, productId: string, quantity: number): Promise<void>;
  insertPending(tx: Db, input: InsertOrderInput): Promise<string>;
}

export function createOrderRepository(prisma: PrismaClient): OrderRepository {
  return {
    async findIdempotency(userId: string, idempotencyKey: string): Promise<IdempotencyHit | null> {
      const row = await prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          requestHash: true,
          totalPaise: true,
        },
      });
      if (!row) {
        return null;
      }
      return { ...row, requestHash: trimChar(row.requestHash) };
    },
    async findByNumber(orderNumber: string): Promise<LoadedOrder | null> {
      const row = await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
      return row ? toLoaded(row) : null;
    },
    async findOwn(userId: string, orderNumber: string): Promise<LoadedOrder | null> {
      const row = await prisma.order.findFirst({
        where: { orderNumber, userId },
        include: orderInclude,
      });
      return row ? toLoaded(row) : null;
    },
    async lockProducts(tx: Db, ids: readonly string[]): Promise<LockedProduct[]> {
      if (ids.length === 0) {
        return [];
      }
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          unitLabel: string;
          pricePaise: number;
          stock: number;
          isActive: boolean;
          deleted: boolean;
        }>
      >`
        SELECT id,
               name,
               sku,
               unit_label AS "unitLabel",
               price_paise AS "pricePaise",
               stock,
               is_active AS "isActive",
               (deleted_at IS NOT NULL) AS deleted
        FROM products
        WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY id
        FOR UPDATE
      `;
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        unitLabel: row.unitLabel,
        pricePaise: row.pricePaise,
        stock: row.stock,
        isActive: row.isActive,
        deleted: row.deleted,
      }));
    },
    async decrementStock(tx: Db, productId: string, quantity: number): Promise<boolean> {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE products
        SET stock = stock - ${quantity},
            updated_at = now()
        WHERE id = ${productId}::uuid
          AND stock >= ${quantity}
          AND deleted_at IS NULL
          AND is_active = true
        RETURNING id
      `;
      return rows.length === 1;
    },
    async restock(tx: Db, productId: string, quantity: number): Promise<void> {
      await tx.$queryRaw`
        UPDATE products
        SET stock = stock + ${quantity},
            updated_at = now()
        WHERE id = ${productId}::uuid
      `;
    },
    async insertPending(tx: Db, input: InsertOrderInput): Promise<string> {
      const row = await tx.order.create({
        data: {
          orderNumber: input.orderNumber,
          userId: input.userId,
          status: 'PENDING_PAYMENT',
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          itemCount: input.itemCount,
          subtotalPaise: input.subtotalPaise,
          deliveryFeePaise: input.deliveryFeePaise,
          totalPaise: input.totalPaise,
          shipName: input.shipName,
          shipPhone: input.shipPhone,
          shipLine1: input.shipLine1,
          shipLine2: input.shipLine2,
          shipCity: input.shipCity,
          shipState: input.shipState,
          shipPincode: input.shipPincode,
          items: { create: input.items },
          payments: {
            create: {
              provider: 'MOCK',
              status: 'PENDING',
              amountPaise: input.totalPaise,
              currency: 'INR',
            },
          },
          history: {
            create: {
              fromStatus: null,
              toStatus: 'PENDING_PAYMENT',
              note: 'Order placed',
            },
          },
        },
        select: { id: true },
      });
      return row.id;
    },
  };
}

export function isIdempotencyConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  // Prisma 7's driver adapter puts the index name on the message, not meta.target.
  return error.message.includes('orders_user_idem_key');
}
