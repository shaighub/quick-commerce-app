import { z } from 'zod';
import { orderStatusSchema, paymentStatusSchema, type OrderStatus } from './enums.js';
import { indianPincodeSchema, uuidSchema } from './ids.js';
import { paginationQuerySchema } from './pagination.js';

/** A cart line is 1 to 10 units. The database CHECK matches this range. */
export const cartQuantitySchema = z
  .number()
  .int()
  .min(1, 'Quantity must be between 1 and 10')
  .max(10, 'Quantity must be between 1 and 10');

export const addCartItemSchema = z.object({
  productId: uuidSchema,
  quantity: cartQuantitySchema,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: cartQuantitySchema,
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const cartProductSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  unitLabel: z.string(),
  pricePaise: z.number().int().positive(),
  imageUrl: z.string().nullable(),
  stock: z.number().int().nonnegative(),
  isActive: z.boolean(),
});

export const cartLineSchema = z.object({
  id: uuidSchema,
  product: cartProductSchema,
  quantity: cartQuantitySchema,
  lineTotalPaise: z.number().int().nonnegative(),
  available: z.boolean(),
});

export type CartLine = z.infer<typeof cartLineSchema>;

/**
 * Totals are computed on the server. Unavailable lines stay in `items` but are
 * left out of the subtotal. Delivery is added only when something can be bought.
 */
export const cartSchema = z.object({
  items: z.array(cartLineSchema),
  itemCount: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().nonnegative(),
});

export type Cart = z.infer<typeof cartSchema>;

export interface PricedLine {
  unitPricePaise: number;
  quantity: number;
  available: boolean;
}

export function lineTotalPaise(unitPricePaise: number, quantity: number): number {
  return unitPricePaise * quantity;
}

export function lineIsAvailable(input: {
  isActive: boolean;
  deleted: boolean;
  stock: number;
  quantity: number;
}): boolean {
  return input.isActive && !input.deleted && input.stock >= input.quantity;
}

/** Inactive and soft-deleted lines are not purchased. Short stock is a 409. */
export function lineIsPurchasable(input: { isActive: boolean; deleted: boolean }): boolean {
  return input.isActive && !input.deleted;
}

export function summarizeCart(
  lines: readonly PricedLine[],
  deliveryFeePaise: number,
): {
  itemCount: number;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
} {
  let itemCount = 0;
  let subtotalPaise = 0;
  for (const line of lines) {
    itemCount += line.quantity;
    if (line.available) {
      subtotalPaise += lineTotalPaise(line.unitPricePaise, line.quantity);
    }
  }
  const fee = subtotalPaise > 0 ? deliveryFeePaise : 0;
  return {
    itemCount,
    subtotalPaise,
    deliveryFeePaise: fee,
    totalPaise: subtotalPaise + fee,
  };
}

/**
 * 10-digit Indian mobile, or the same number already in E.164.
 * The API stores +91. Spaces are not accepted; trim() only removes the ends.
 */
export const checkoutPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+91[6-9]\d{9}|[6-9]\d{9})$/,
    'Enter a 10-digit Indian mobile number starting with 6-9',
  );

export function toE164IndianMobile(value: string): string {
  return value.startsWith('+91') ? value : `+91${value}`;
}

export const checkoutAddressSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  phone: checkoutPhoneSchema,
  line1: z
    .string()
    .trim()
    .min(1, 'Address line 1 is required')
    .max(200, 'Address line 1 must be at most 200 characters'),
  line2: z.string().trim().max(200, 'Address line 2 must be at most 200 characters').optional(),
  city: z.string().trim().min(1, 'City is required').max(80, 'City must be at most 80 characters'),
  state: z
    .string()
    .trim()
    .min(1, 'State is required')
    .max(80, 'State must be at most 80 characters'),
  pincode: indianPincodeSchema,
});

export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const checkoutSchema = z.object({
  address: checkoutAddressSchema,
  payment: z.object({
    method: z.literal('MOCK'),
    simulate: z.enum(['success', 'failure']),
  }),
  expectedTotalPaise: z.number().int().nonnegative(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{8,64}$/,
    'Idempotency-Key must be 8 to 64 letters, digits, underscores, or hyphens',
  );

/** QC-YYYYMMDD-NNNNNN. 18 characters, matching orders.order_number. */
export const orderNumberSchema = z
  .string()
  .regex(/^QC-\d{8}-\d{6}$/, 'Order number must look like QC-YYYYMMDD-NNNNNN');

export const orderItemSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  productName: z.string(),
  sku: z.string(),
  unitLabel: z.string(),
  unitPricePaise: z.number().int().positive(),
  quantity: cartQuantitySchema,
  lineTotalPaise: z.number().int().positive(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderPaymentSchema = z.object({
  id: uuidSchema,
  provider: z.string(),
  status: paymentStatusSchema,
  amountPaise: z.number().int().positive(),
  currency: z.string(),
  providerRef: z.string().nullable(),
  failureReason: z.string().nullable(),
});

export const orderHistorySchema = z.object({
  id: uuidSchema,
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
  changedById: uuidSchema.nullable(),
});

export const customerOrderSchema = z.object({
  orderNumber: orderNumberSchema,
  status: orderStatusSchema,
  itemCount: z.number().int().positive(),
  subtotalPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().positive(),
  placedAt: z.string(),
  address: z.object({
    name: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  }),
  items: z.array(orderItemSchema),
  payment: orderPaymentSchema.nullable(),
  history: z.array(orderHistorySchema),
});

export type CustomerOrder = z.infer<typeof customerOrderSchema>;

export const customerOrderResponseSchema = z.object({
  order: customerOrderSchema,
});

export const customerOrderListItemSchema = z.object({
  orderNumber: orderNumberSchema,
  placedAt: z.string(),
  itemCount: z.number().int().positive(),
  totalPaise: z.number().int().positive(),
  status: orderStatusSchema,
});

export const customerOrderListSchema = z.object({
  items: z.array(customerOrderListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int().nonnegative(),
});

export type CustomerOrderList = z.infer<typeof customerOrderListSchema>;

const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.preprocess(blankToUndefined, orderStatusSchema.optional()),
  q: z.preprocess(
    blankToUndefined,
    z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
  ),
  from: z.preprocess(blankToUndefined, daySchema.optional()),
  to: z.preprocess(blankToUndefined, daySchema.optional()),
});

export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const orderCustomerSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string(),
});

export const adminOrderListItemSchema = z.object({
  orderNumber: orderNumberSchema,
  customer: orderCustomerSchema,
  placedAt: z.string(),
  totalPaise: z.number().int().positive(),
  paymentStatus: paymentStatusSchema.nullable(),
  status: orderStatusSchema,
});

export const adminOrderListSchema = z.object({
  items: z.array(adminOrderListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int().nonnegative(),
});

export type AdminOrderList = z.infer<typeof adminOrderListSchema>;

export const adminOrderDetailSchema = z.object({
  order: customerOrderSchema,
  customer: orderCustomerSchema,
  allowedNextStatuses: z.array(orderStatusSchema),
});

export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: z.string().trim().max(500, 'Note must be at most 500 characters').optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const sweepRequestSchema = z.object({
  olderThanMinutes: z.number().int().min(1).max(1440).default(15),
});

export type SweepRequest = z.infer<typeof sweepRequestSchema>;

export const sweepResponseSchema = z.object({
  swept: z.number().int().nonnegative(),
  restockedItems: z.number().int().nonnegative(),
});

export type SweepResponse = z.infer<typeof sweepResponseSchema>;

export const lowStockProductSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  sku: z.string(),
  stock: z.number().int().nonnegative(),
});

export const dashboardRecentOrderSchema = z.object({
  orderNumber: orderNumberSchema,
  customer: orderCustomerSchema,
  placedAt: z.string(),
  totalPaise: z.number().int().nonnegative(),
  status: orderStatusSchema,
});

export const dashboardSchema = z.object({
  ordersToday: z.number().int().nonnegative(),
  revenueTodayPaise: z.number().int().nonnegative(),
  pendingOrders: z.number().int().nonnegative(),
  lowStock: z.array(lowStockProductSchema),
  recentOrders: z.array(dashboardRecentOrderSchema),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

export const priceChangedDetailSchema = z.object({
  cart: cartSchema,
  totalPaise: z.number().int().nonnegative(),
});

export const paymentFailedDetailSchema = z.object({
  orderNumber: orderNumberSchema,
});

export const insufficientStockDetailSchema = z.object({
  productId: uuidSchema,
  name: z.string().optional(),
  available: z.number().int().nonnegative(),
  requested: z.number().int().positive().optional(),
});

const ADMIN_NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAYMENT_FAILED: [],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function adminNextStatuses(from: OrderStatus): OrderStatus[] {
  return [...ADMIN_NEXT[from]];
}

export function isAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_NEXT[from].includes(to);
}

export function isSystemTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === 'PENDING_PAYMENT' && (to === 'CONFIRMED' || to === 'PAYMENT_FAILED');
}
