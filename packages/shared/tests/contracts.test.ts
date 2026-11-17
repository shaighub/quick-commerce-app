import { describe, expect, it } from 'vitest';
import {
  errorResponseSchema,
  healthResponseSchema,
  indianPincodeSchema,
  orderStatusSchema,
  paginationQuerySchema,
  passwordSchema,
  paymentStatusSchema,
  pricePaiseSchema,
  roleSchema,
  uuidSchema,
} from '../src/index.js';

describe('shared contracts', () => {
  it('accepts a password with a letter and a number', () => {
    expect(passwordSchema.safeParse('Adminpass1').success).toBe(true);
  });

  it('rejects a short password and one without a number', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('longpassword').success).toBe(false);
  });

  it('parses the health and error envelopes', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'up', version: '0.1.0' }).status).toBe(
      'ok',
    );
    expect(
      errorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Missing', requestId: 'req-1' },
      }).error.code,
    ).toBe('NOT_FOUND');
  });

  it('defaults pagination to 24 items and caps the page', () => {
    expect(paginationQuerySchema.parse({}).pageSize).toBe(24);
    expect(paginationQuerySchema.safeParse({ page: 21 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it('matches the database enums', () => {
    expect(roleSchema.options).toEqual(['ADMIN', 'CUSTOMER']);
    expect(orderStatusSchema.options).toContain('PENDING_PAYMENT');
    expect(paymentStatusSchema.options).toContain('REFUNDED');
  });

  it('validates ids, pincodes, and paise', () => {
    expect(uuidSchema.safeParse('00000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(indianPincodeSchema.safeParse('560001').success).toBe(true);
    expect(indianPincodeSchema.safeParse('012345').success).toBe(false);
    expect(pricePaiseSchema.safeParse(100).success).toBe(true);
    expect(pricePaiseSchema.safeParse(0).success).toBe(false);
  });
});
