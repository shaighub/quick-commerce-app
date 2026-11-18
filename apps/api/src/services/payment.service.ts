import type {
  ChargeInput,
  ChargeResult,
  PaymentGateway,
  RefundInput,
  RefundResult,
} from '../payments/gateway.js';

export interface PaymentService {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export function createPaymentService(gateway: PaymentGateway): PaymentService {
  return {
    charge(input: ChargeInput): Promise<ChargeResult> {
      return gateway.charge(input);
    },
    refund(input: RefundInput): Promise<RefundResult> {
      return gateway.refund(input);
    },
  };
}
