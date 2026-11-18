import { z } from 'zod';

/** Guest is not stored. A request with no valid access token is a guest. */
export const roleSchema = z.enum(['ADMIN', 'CUSTOMER']);
export type Role = z.infer<typeof roleSchema>;

export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentStatusSchema = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
