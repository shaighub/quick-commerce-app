import { randomBytes } from 'node:crypto';
import type { ChargeInput, PaymentGateway, RefundInput } from './gateway.js';

const FAILURE_REASON = 'Simulated payment failure';

export function createMockGateway(): PaymentGateway {
  return {
    provider: 'MOCK',
    charge(input: ChargeInput) {
      const providerRef = `mock_pay_${randomBytes(6).toString('hex')}`;
      if (input.simulate === 'failure') {
        return Promise.resolve({
          status: 'FAILED' as const,
          providerRef,
          failureReason: FAILURE_REASON,
        });
      }
      return Promise.resolve({ status: 'SUCCEEDED' as const, providerRef });
    },
    refund(_input: RefundInput) {
      return Promise.resolve({ status: 'REFUNDED' as const });
    },
  };
}
