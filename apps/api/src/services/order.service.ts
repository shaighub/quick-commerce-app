import {
  type AdminOrderDetail,
  type AdminOrderList,
  type AdminOrderListQuery,
  adminNextStatuses,
  type Cart,
  type CheckoutInput,
  type CustomerOrder,
  customerOrderSchema,
  type CustomerOrderList,
  type Dashboard,
  ErrorCodes,
  isAdminTransition,
  lineIsPurchasable,
  type OrderStatus,
  type PaginationQuery,
  STOCK_LOW_AT,
  summarizeCart,
  toE164IndianMobile,
} from '@qc/shared';
import { refusalForUnserviceablePincode } from '@qc/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { checkoutRequestHash, istDateRange, istDayBounds } from '../domain/orders.js';
import { AppError } from '../lib/errors.js';
import type { AppLogger } from '../lib/logger.js';
import type { CartLineRow, CartRepository } from '../repositories/cart.repository.js';
import {
  isIdempotencyConflict,
  type IdempotencyHit,
  type InsertOrderInput,
  type LoadedOrder,
  type LockedProduct,
  type OrderRepository,
} from '../repositories/order.repository.js';
import { presentCart, type CartPriceOverride } from './cart.service.js';
import type { OrderNumberService } from './order-number.service.js';
import type { PaymentService } from './payment.service.js';

const SALE_STATUSES = [
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;
const REVENUE_STATUSES = ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
const OPEN_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] as const;

export interface OrderService {
  checkout(userId: string, idempotencyKey: string, input: CheckoutInput): Promise<CustomerOrder>;
  listOwn(userId: string, query: PaginationQuery): Promise<CustomerOrderList>;
  getOwn(userId: string, orderNumber: string): Promise<CustomerOrder>;
  listAdmin(query: AdminOrderListQuery): Promise<AdminOrderList>;
  getAdmin(orderNumber: string): Promise<AdminOrderDetail>;
  updateStatus(
    orderNumber: string,
    to: OrderStatus,
    adminId: string,
    note?: string,
  ): Promise<AdminOrderDetail>;
  dashboard(): Promise<Dashboard>;
  sweepPendingPayments(
    olderThanMinutes: number,
  ): Promise<{ swept: number; restockedItems: number }>;
}

function notFound(): AppError {
  return new AppError(404, ErrorCodes.NOT_FOUND, 'Order not found');
}

function paymentFailed(orderNumber: string): AppError {
  return new AppError(402, ErrorCodes.PAYMENT_FAILED, 'Payment failed', [{ orderNumber }]);
}

function reusedKey(): AppError {
  return new AppError(
    422,
    ErrorCodes.IDEMPOTENCY_KEY_REUSED,
    'This Idempotency-Key was already used for a different checkout',
  );
}

function emptyCart(): AppError {
  return new AppError(422, ErrorCodes.CART_EMPTY, 'Your cart has nothing to check out');
}

function present(order: LoadedOrder): CustomerOrder {
  const payment = order.payments[0];
  return customerOrderSchema.parse({
    orderNumber: order.orderNumber,
    status: order.status,
    itemCount: order.itemCount,
    subtotalPaise: order.subtotalPaise,
    deliveryFeePaise: order.deliveryFeePaise,
    totalPaise: order.totalPaise,
    placedAt: order.placedAt.toISOString(),
    address: {
      name: order.shipName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2,
      city: order.shipCity,
      state: order.shipState,
      pincode: order.shipPincode,
    },
    items: order.items,
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          providerRef: payment.providerRef,
          failureReason: payment.failureReason,
        }
      : null,
    history: order.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      changedById: entry.changedById,
    })),
  });
}

function detail(order: LoadedOrder): AdminOrderDetail {
  return {
    order: present(order),
    customer: order.customer,
    allowedNextStatuses: adminNextStatuses(order.status),
  };
}

export function createOrderService(deps: {
  prisma: PrismaClient;
  orders: OrderRepository;
  carts: CartRepository;
  numbers: OrderNumberService;
  payments: PaymentService;
  deliveryFeePaise: number;
  serviceablePincodes: readonly string[];
  now: () => Date;
  logger: AppLogger;
}): OrderService {
  async function loadOwn(userId: string, orderNumber: string): Promise<CustomerOrder> {
    const order = await deps.orders.findOwn(userId, orderNumber);
    if (!order) {
      throw notFound();
    }
    return present(order);
  }

  async function loadAdmin(orderNumber: string): Promise<AdminOrderDetail> {
    const order = await deps.orders.findByNumber(orderNumber);
    if (!order) {
      throw notFound();
    }
    return detail(order);
  }

  async function replay(hit: IdempotencyHit, userId: string, simulate: 'success' | 'failure') {
    if (hit.status === 'PAYMENT_FAILED') {
      throw paymentFailed(hit.orderNumber);
    }
    if (hit.status !== 'PENDING_PAYMENT') {
      return loadOwn(userId, hit.orderNumber);
    }
    return settle(hit.id, hit.orderNumber, userId, simulate);
  }

  async function settle(
    orderId: string,
    orderNumber: string,
    userId: string,
    simulate: 'success' | 'failure',
  ): Promise<CustomerOrder> {
    const current = await deps.orders.findByNumber(orderNumber);
    if (!current || current.userId !== userId) {
      throw notFound();
    }
    if (current.status === 'PAYMENT_FAILED') {
      throw paymentFailed(orderNumber);
    }
    if (current.status !== 'PENDING_PAYMENT') {
      return present(current);
    }

    const charge = await deps.payments.charge({
      orderNumber,
      amountPaise: current.totalPaise,
      currency: 'INR',
      simulate,
    });
    const reason = (charge.failureReason ?? 'Payment failed').slice(0, 200);
    const outcome = await deps.prisma.$transaction(async (tx) => {
      if (charge.status === 'SUCCEEDED') {
        const updated = await tx.payment.updateMany({
          where: { orderId, status: 'PENDING' },
          data: { status: 'SUCCEEDED', providerRef: charge.providerRef, failureReason: null },
        });
        if (updated.count !== 1) {
          return 'lost' as const;
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: 'PENDING_PAYMENT',
            toStatus: 'CONFIRMED',
            note: 'Payment succeeded',
          },
        });
        await tx.cartItem.deleteMany({ where: { cart: { userId } } });
        return 'confirmed' as const;
      }
      const updated = await tx.payment.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'FAILED', providerRef: charge.providerRef, failureReason: reason },
      });
      if (updated.count !== 1) {
        return 'lost' as const;
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_FAILED' } });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'PAYMENT_FAILED',
          note: reason,
        },
      });
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await deps.orders.restock(tx, item.productId, item.quantity);
      }
      return 'failed' as const;
    });

    if (outcome === 'failed') {
      throw paymentFailed(orderNumber);
    }
    const order = await loadOwn(userId, orderNumber);
    if (outcome === 'lost' && order.status === 'PAYMENT_FAILED') {
      throw paymentFailed(orderNumber);
    }
    deps.logger.info({ orderNumber, userId }, 'order confirmed');
    return order;
  }

  async function place(
    userId: string,
    idempotencyKey: string,
    input: CheckoutInput,
    hash: string,
    lines: CartLineRow[],
  ): Promise<CustomerOrder> {
    const created = await deps.prisma.$transaction(
      async (tx) => {
        const ids = [...new Set(lines.map((line) => line.product.id))].sort();
        const locked = await deps.orders.lockProducts(tx, ids);
        const byId = new Map<string, LockedProduct>(locked.map((row) => [row.id, row]));
        const overrides = new Map<string, CartPriceOverride>();
        for (const row of locked) {
          overrides.set(row.id, {
            pricePaise: row.pricePaise,
            stock: row.stock,
            isActive: row.isActive,
            deleted: row.deleted,
          });
        }

        const short: Array<{
          productId: string;
          name: string;
          available: number;
          requested: number;
        }> = [];
        const ready: Array<{ line: CartLineRow; product: LockedProduct }> = [];
        for (const line of lines) {
          const product = byId.get(line.product.id);
          const isActive = product ? product.isActive : line.product.isActive;
          const deleted = product ? product.deleted : line.product.deletedAt !== null;
          if (!lineIsPurchasable({ isActive, deleted })) {
            continue;
          }
          if (!product || product.stock < line.quantity) {
            short.push({
              productId: line.product.id,
              name: product?.name ?? line.product.name,
              available: product?.stock ?? 0,
              requested: line.quantity,
            });
            continue;
          }
          ready.push({ line, product });
        }

        if (short.length > 0) {
          const only = short.length === 1 ? short[0] : undefined;
          throw new AppError(
            409,
            ErrorCodes.INSUFFICIENT_STOCK,
            only ? `Only ${only.available} left` : 'Some items do not have enough stock',
            short,
          );
        }
        if (ready.length === 0) {
          throw emptyCart();
        }

        ready.sort((left, right) => (left.product.id < right.product.id ? -1 : 1));
        const totals = summarizeCart(
          ready.map((row) => ({
            unitPricePaise: row.product.pricePaise,
            quantity: row.line.quantity,
            available: true,
          })),
          deps.deliveryFeePaise,
        );
        if (totals.totalPaise !== input.expectedTotalPaise) {
          const cart: Cart = presentCart(lines, deps.deliveryFeePaise, overrides);
          throw new AppError(
            409,
            ErrorCodes.PRICE_CHANGED,
            'The total changed. Confirm the new total to place the order.',
            [{ cart, totalPaise: cart.totalPaise }],
          );
        }

        for (const row of ready) {
          const decremented = await deps.orders.decrementStock(
            tx,
            row.product.id,
            row.line.quantity,
          );
          if (!decremented) {
            throw new AppError(
              409,
              ErrorCodes.INSUFFICIENT_STOCK,
              'Some items do not have enough stock',
              [
                {
                  productId: row.product.id,
                  name: row.product.name,
                  available: row.product.stock,
                  requested: row.line.quantity,
                },
              ],
            );
          }
        }

        const orderNumber = await deps.numbers.next(tx);
        const snapshot: InsertOrderInput = {
          orderNumber,
          userId,
          idempotencyKey,
          requestHash: hash,
          itemCount: totals.itemCount,
          subtotalPaise: totals.subtotalPaise,
          deliveryFeePaise: totals.deliveryFeePaise,
          totalPaise: totals.totalPaise,
          shipName: input.address.name,
          shipPhone: input.address.phone,
          shipLine1: input.address.line1,
          shipLine2: input.address.line2 ?? null,
          shipCity: input.address.city,
          shipState: input.address.state,
          shipPincode: input.address.pincode,
          items: ready.map((row) => ({
            productId: row.product.id,
            productName: row.product.name,
            sku: row.product.sku,
            unitLabel: row.product.unitLabel,
            unitPricePaise: row.product.pricePaise,
            quantity: row.line.quantity,
            lineTotalPaise: row.product.pricePaise * row.line.quantity,
          })),
        };
        const id = await deps.orders.insertPending(tx, snapshot);
        return { id, orderNumber };
      },
      { timeout: 20_000 },
    );
    return settle(created.id, created.orderNumber, userId, input.payment.simulate);
  }

  return {
    async checkout(userId, idempotencyKey, input) {
      const { line2, ...address } = input.address;
      const normalized: CheckoutInput = {
        ...input,
        address: {
          ...address,
          phone: toE164IndianMobile(address.phone),
          ...(line2 && line2.length > 0 ? { line2 } : {}),
        },
      };
      const hash = checkoutRequestHash(normalized);
      const existing = await deps.orders.findIdempotency(userId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw reusedKey();
        }
        return replay(existing, userId, input.payment.simulate);
      }

      const refusal = refusalForUnserviceablePincode(
        input.address.pincode,
        deps.serviceablePincodes,
      );
      if (refusal) {
        throw new AppError(422, refusal.code, refusal.message);
      }

      const lines = await deps.carts.findLines(userId);
      const purchasable = lines.some((line) =>
        lineIsPurchasable({
          isActive: line.product.isActive,
          deleted: line.product.deletedAt !== null,
        }),
      );
      if (!purchasable) {
        throw emptyCart();
      }

      try {
        return await place(userId, idempotencyKey, normalized, hash, lines);
      } catch (error: unknown) {
        if (!isIdempotencyConflict(error)) {
          throw error;
        }
        const again = await deps.orders.findIdempotency(userId, idempotencyKey);
        if (!again || again.requestHash !== hash) {
          throw reusedKey();
        }
        return replay(again, userId, normalized.payment.simulate);
      }
    },

    async listOwn(userId, query) {
      const where = { userId };
      const [total, rows] = await Promise.all([
        deps.prisma.order.count({ where }),
        deps.prisma.order.findMany({
          where,
          orderBy: { placedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            orderNumber: true,
            placedAt: true,
            itemCount: true,
            totalPaise: true,
            status: true,
          },
        }),
      ]);
      return {
        items: rows.map((row) => ({
          orderNumber: row.orderNumber,
          placedAt: row.placedAt.toISOString(),
          itemCount: row.itemCount,
          totalPaise: row.totalPaise,
          status: row.status,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    getOwn: loadOwn,

    async listAdmin(query) {
      const range = istDateRange(query.from, query.to);
      const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(range.start || range.end
          ? {
              placedAt: {
                ...(range.start ? { gte: range.start } : {}),
                ...(range.end ? { lt: range.end } : {}),
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { orderNumber: { contains: query.q, mode: 'insensitive' as const } },
                { user: { name: { contains: query.q, mode: 'insensitive' as const } } },
                { user: { email: { contains: query.q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        deps.prisma.order.count({ where }),
        deps.prisma.order.findMany({
          where,
          orderBy: { placedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            user: { select: { id: true, name: true, email: true } },
            payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),
      ]);
      return {
        items: rows.map((row) => ({
          orderNumber: row.orderNumber,
          customer: row.user,
          placedAt: row.placedAt.toISOString(),
          totalPaise: row.totalPaise,
          paymentStatus: row.payments[0]?.status ?? null,
          status: row.status,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    getAdmin: loadAdmin,

    async updateStatus(orderNumber, to, adminId, note) {
      await deps.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { orderNumber },
          include: {
            items: true,
            payments: { orderBy: { createdAt: 'desc' } },
          },
        });
        if (!order) {
          throw notFound();
        }
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id}::uuid FOR UPDATE`;
        if (!isAdminTransition(order.status, to)) {
          throw new AppError(
            409,
            ErrorCodes.INVALID_TRANSITION,
            `Cannot move an order from ${order.status} to ${to}`,
          );
        }
        if (to === 'CANCELLED') {
          const payment = order.payments.find((row) => row.status === 'SUCCEEDED');
          if (!payment) {
            throw new AppError(
              409,
              ErrorCodes.INVALID_TRANSITION,
              'This order has no payment to refund',
            );
          }
          const providerRef = payment.providerRef?.trim() ?? '';
          if (providerRef === '') {
            throw new AppError(
              409,
              ErrorCodes.INVALID_TRANSITION,
              'This order has no payment to refund',
            );
          }
          const refund = await deps.payments.refund({
            providerRef,
            amountPaise: payment.amountPaise,
          });
          if (refund.status !== 'REFUNDED') {
            throw new AppError(
              409,
              ErrorCodes.INVALID_TRANSITION,
              'The payment could not be refunded',
            );
          }
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
          for (const item of order.items) {
            await deps.orders.restock(tx, item.productId, item.quantity);
          }
        }
        await tx.order.update({ where: { id: order.id }, data: { status: to } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: to,
            changedById: adminId,
            note: note && note.length > 0 ? note : null,
          },
        });
      });
      deps.logger.info({ orderNumber, to, adminId }, 'order status updated');
      return loadAdmin(orderNumber);
    },

    async dashboard() {
      const bounds = istDayBounds(deps.now());
      const placedToday = { gte: bounds.start, lt: bounds.end };
      const [ordersToday, revenue, pendingOrders, lowStock, recentOrders] = await Promise.all([
        deps.prisma.order.count({
          where: { placedAt: placedToday, status: { in: [...SALE_STATUSES] } },
        }),
        deps.prisma.order.aggregate({
          where: { placedAt: placedToday, status: { in: [...REVENUE_STATUSES] } },
          _sum: { totalPaise: true },
        }),
        deps.prisma.order.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
        deps.prisma.product.findMany({
          where: { deletedAt: null, stock: { lte: STOCK_LOW_AT } },
          orderBy: [{ stock: 'asc' }, { name: 'asc' }],
          take: 20,
          select: { id: true, name: true, sku: true, stock: true },
        }),
        deps.prisma.order.findMany({
          orderBy: { placedAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);
      return {
        ordersToday,
        revenueTodayPaise: revenue._sum.totalPaise ?? 0,
        pendingOrders,
        lowStock,
        recentOrders: recentOrders.map((row) => ({
          orderNumber: row.orderNumber,
          customer: row.user,
          placedAt: row.placedAt.toISOString(),
          totalPaise: row.totalPaise,
          status: row.status,
        })),
      };
    },

    async sweepPendingPayments(olderThanMinutes) {
      const cutoff = new Date(deps.now().getTime() - olderThanMinutes * 60_000);
      const candidates = await deps.prisma.order.findMany({
        where: { status: 'PENDING_PAYMENT', placedAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      let swept = 0;
      let restockedItems = 0;
      for (const candidate of candidates) {
        const result = await deps.prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: candidate.id, status: 'PENDING_PAYMENT', placedAt: { lt: cutoff } },
            data: { status: 'PAYMENT_FAILED' },
          });
          if (updated.count !== 1) {
            return { swept: false, units: 0 };
          }
          const items = await tx.orderItem.findMany({
            where: { orderId: candidate.id },
            select: { productId: true, quantity: true },
          });
          for (const item of items) {
            await deps.orders.restock(tx, item.productId, item.quantity);
          }
          await tx.payment.updateMany({
            where: { orderId: candidate.id, status: 'PENDING' },
            data: { status: 'FAILED', failureReason: 'Pending payment expired' },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: candidate.id,
              fromStatus: 'PENDING_PAYMENT',
              toStatus: 'PAYMENT_FAILED',
              note: 'Pending payment expired',
            },
          });
          const units = items.reduce((sum, item) => sum + item.quantity, 0);
          return { swept: true, units };
        });
        if (result.swept) {
          swept += 1;
          restockedItems += result.units;
        }
      }
      deps.logger.info(
        { swept, restockedItems, olderThanMinutes },
        'pending payment sweep finished',
      );
      return { swept, restockedItems };
    },
  };
}
