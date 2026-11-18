import { describe, expect, it } from 'vitest';
import {
  addCartItemSchema,
  adminNextStatuses,
  adminOrderListQuerySchema,
  checkoutSchema,
  isAdminTransition,
  isSystemTransition,
  lineIsAvailable,
  lineIsPurchasable,
  lineTotalPaise,
  summarizeCart,
  sweepRequestSchema,
  toE164IndianMobile,
  updateOrderStatusSchema,
} from '../src/commerce.js';

describe('cart pricing', () => {
  it('multiplies unit price by quantity in paise', () => {
    expect(lineTotalPaise(5600, 2)).toBe(11200);
  });

  it('leaves unavailable lines out of the subtotal and skips delivery on an empty purchase', () => {
    const totals = summarizeCart(
      [
        { unitPricePaise: 5600, quantity: 2, available: true },
        { unitPricePaise: 1000, quantity: 1, available: false },
      ],
      2500,
    );
    expect(totals).toEqual({
      itemCount: 3,
      subtotalPaise: 11200,
      deliveryFeePaise: 2500,
      totalPaise: 13700,
    });
    expect(summarizeCart([{ unitPricePaise: 1000, quantity: 1, available: false }], 2500)).toEqual({
      itemCount: 1,
      subtotalPaise: 0,
      deliveryFeePaise: 0,
      totalPaise: 0,
    });
  });

  it('treats a soft-deleted or short-stock line as unavailable', () => {
    expect(lineIsAvailable({ isActive: true, deleted: false, stock: 4, quantity: 2 })).toBe(true);
    expect(lineIsAvailable({ isActive: false, deleted: false, stock: 4, quantity: 1 })).toBe(false);
    expect(lineIsAvailable({ isActive: true, deleted: true, stock: 4, quantity: 1 })).toBe(false);
    expect(lineIsAvailable({ isActive: true, deleted: false, stock: 1, quantity: 2 })).toBe(false);
    expect(lineIsPurchasable({ isActive: true, deleted: false })).toBe(true);
    expect(lineIsPurchasable({ isActive: false, deleted: false })).toBe(false);
    expect(lineIsPurchasable({ isActive: true, deleted: true })).toBe(false);
    expect(toE164IndianMobile('9876543210')).toBe('+919876543210');
    expect(toE164IndianMobile('+919876543210')).toBe('+919876543210');
  });
});

describe('checkout schema', () => {
  const address = {
    name: 'Asha Rao',
    phone: '9876543210',
    line1: '12 Residency Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  it('accepts a 10-digit mobile and a prefilled +91 number', () => {
    const parsed = checkoutSchema.parse({
      address,
      payment: { method: 'MOCK', simulate: 'success' },
      expectedTotalPaise: 8100,
    });
    expect(parsed.address.phone).toBe('9876543210');
    const again = checkoutSchema.parse({
      address: { ...address, phone: '+919876543210' },
      payment: { method: 'MOCK', simulate: 'failure' },
      expectedTotalPaise: 0,
    });
    expect(again.address.phone).toBe('+919876543210');
  });

  it('rejects a bad pincode, a short mobile, and a quantity outside 1 to 10', () => {
    expect(
      checkoutSchema.safeParse({
        address: { ...address, pincode: '56001' },
        payment: { method: 'MOCK', simulate: 'success' },
        expectedTotalPaise: 1,
      }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        address: { ...address, phone: '12345' },
        payment: { method: 'MOCK', simulate: 'success' },
        expectedTotalPaise: 1,
      }).success,
    ).toBe(false);
    const productId = '30000000-0000-4000-8000-000000000001';
    expect(addCartItemSchema.safeParse({ productId, quantity: 0 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ productId, quantity: 11 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ productId, quantity: 2 }).success).toBe(true);
  });
});

describe('order transitions', () => {
  it('allows only the admin moves from the design', () => {
    expect(adminNextStatuses('CONFIRMED')).toEqual(['PACKED', 'CANCELLED']);
    expect(adminNextStatuses('PACKED')).toEqual(['OUT_FOR_DELIVERY', 'CANCELLED']);
    expect(adminNextStatuses('OUT_FOR_DELIVERY')).toEqual(['DELIVERED']);
    expect(adminNextStatuses('PENDING_PAYMENT')).toEqual([]);
    expect(adminNextStatuses('DELIVERED')).toEqual([]);
    expect(isAdminTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(isAdminTransition('PACKED', 'CANCELLED')).toBe(true);
    expect(isSystemTransition('PENDING_PAYMENT', 'CONFIRMED')).toBe(true);
    expect(isSystemTransition('CONFIRMED', 'PACKED')).toBe(false);
  });

  it('drops blank admin filters and keeps a real status and date', () => {
    expect(
      adminOrderListQuerySchema.parse({ status: '', q: '  ', from: '' }).status,
    ).toBeUndefined();
    const parsed = adminOrderListQuerySchema.parse({
      status: 'PACKED',
      q: 'asha',
      from: '2026-11-18',
      to: '2026-11-18',
    });
    expect(parsed.status).toBe('PACKED');
    expect(parsed.q).toBe('asha');
    expect(parsed.from).toBe('2026-11-18');
  });

  it('defaults the sweeper window to 15 minutes and caps the note', () => {
    expect(sweepRequestSchema.parse({}).olderThanMinutes).toBe(15);
    expect(
      updateOrderStatusSchema.safeParse({ status: 'PACKED', note: 'a'.repeat(501) }).success,
    ).toBe(false);
  });
});
