import { describe, expect, it } from 'vitest';
import {
  checkoutRequestHash,
  formatOrderNumber,
  istDayBounds,
  istDayKey,
  pendingPaymentExpired,
  settlementStatus,
} from '../src/domain/orders.js';
import { secretsEqual } from '../src/lib/secret-equal.js';
import { createMockGateway } from '../src/payments/mock-gateway.js';
import type { CheckoutInput } from '@qc/shared';

const checkout: CheckoutInput = {
  address: {
    name: 'Asha Rao',
    phone: '+919876543210',
    line1: '12 Residency Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
  payment: { method: 'MOCK', simulate: 'success' },
  expectedTotalPaise: 8100,
};

describe('order numbers and sweep selection', () => {
  it('formats QC-YYYYMMDD-NNNNNN from the IST day', () => {
    expect(formatOrderNumber('20261117', 123)).toBe('QC-20261117-000123');
    expect(istDayKey(new Date('2026-11-17T20:30:00.000Z'))).toBe('20261118');
    expect(istDayKey(new Date('2026-11-17T18:29:00.000Z'))).toBe('20261117');
    const bounds = istDayBounds(new Date('2026-11-18T12:00:00.000Z'));
    expect(bounds.start.toISOString()).toBe('2026-11-17T18:30:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-11-18T18:30:00.000Z');
  });

  it('selects only pending orders strictly older than the window', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    expect(pendingPaymentExpired(new Date('2026-11-18T11:39:00.000Z'), now, 15)).toBe(true);
    expect(pendingPaymentExpired(new Date('2026-11-18T11:50:00.000Z'), now, 15)).toBe(false);
    expect(pendingPaymentExpired(new Date('2026-11-18T11:45:00.000Z'), now, 15)).toBe(false);
  });

  it('hashes the canonical body and changes when the body changes', () => {
    const again = checkoutRequestHash(checkout);
    expect(checkoutRequestHash(checkout)).toBe(again);
    expect(again).toHaveLength(64);
    const moved = checkoutRequestHash({
      ...checkout,
      address: { ...checkout.address, pincode: '560002' },
    });
    expect(moved).not.toBe(again);
  });

  it('maps a charge to the order status', () => {
    expect(settlementStatus('SUCCEEDED')).toBe('CONFIRMED');
    expect(settlementStatus('FAILED')).toBe('PAYMENT_FAILED');
  });
});

describe('mock gateway and job token compare', () => {
  it('simulates success, failure, and refund', async () => {
    const gateway = createMockGateway();
    const paid = await gateway.charge({
      orderNumber: 'QC-20261118-000001',
      amountPaise: 100,
      currency: 'INR',
      simulate: 'success',
    });
    expect(paid.status).toBe('SUCCEEDED');
    expect(paid.providerRef.startsWith('mock_pay_')).toBe(true);
    const failed = await gateway.charge({
      orderNumber: 'QC-20261118-000002',
      amountPaise: 100,
      currency: 'INR',
      simulate: 'failure',
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe('Simulated payment failure');
    expect((await gateway.refund({ providerRef: paid.providerRef, amountPaise: 100 })).status).toBe(
      'REFUNDED',
    );
  });

  it('compares secrets without leaking length', () => {
    expect(secretsEqual('test-jobs-token-value', 'test-jobs-token-value')).toBe(true);
    expect(secretsEqual('test-jobs-token-value', 'wrong')).toBe(false);
    expect(secretsEqual('', 'test-jobs-token-value')).toBe(false);
  });
});
