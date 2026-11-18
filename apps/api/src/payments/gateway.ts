/**
 * In-process payment port (ADR-008). A real gateway adds an adapter, not a table.
 */
export interface ChargeInput {
  orderNumber: string;
  amountPaise: number;
  currency: 'INR';
  simulate?: 'success' | 'failure';
}

export interface ChargeResult {
  status: 'SUCCEEDED' | 'FAILED';
  providerRef: string;
  failureReason?: string;
}

export interface RefundInput {
  providerRef: string;
  amountPaise: number;
}

export interface RefundResult {
  status: 'REFUNDED' | 'FAILED';
}

export interface PaymentGateway {
  readonly provider: 'MOCK' | 'RAZORPAY';
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
