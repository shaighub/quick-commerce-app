import { createHash } from 'node:crypto';
import type { CheckoutInput, OrderStatus } from '@qc/shared';

/** Asia/Kolkata calendar day as YYYYMMDD. The order-number counter is keyed on this day. */
export function istDayKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not format the IST day');
  }
  return `${year}${month}${day}`;
}

/** Inclusive IST start and exclusive end for a calendar day, as UTC instants. */
export function istDayBounds(now: Date): { start: Date; end: Date } {
  const key = istDayKey(now);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  const startUtc = Date.UTC(year, month - 1, day, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000;
  return { start: new Date(startUtc), end: new Date(startUtc + 24 * 60 * 60 * 1000) };
}

/** Inclusive IST bounds for a YYYY-MM-DD query. `to` is the exclusive end of that day. */
export function istDateRange(
  from: string | undefined,
  to: string | undefined,
): {
  start: Date | undefined;
  end: Date | undefined;
} {
  const start = from ? istDayBounds(istMidnight(from)).start : undefined;
  const end = to ? istDayBounds(istMidnight(to)).end : undefined;
  return { start, end };
}

function istMidnight(day: string): Date {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, date, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
}

export function formatOrderNumber(dayKey: string, sequence: number): string {
  return `QC-${dayKey}-${String(sequence).padStart(6, '0')}`;
}

/** SHA-256 of the canonical checkout body. Key order is fixed so retries hash the same. */
export function checkoutRequestHash(input: CheckoutInput): string {
  const canonical = {
    address: {
      name: input.address.name,
      phone: input.address.phone,
      line1: input.address.line1,
      line2: input.address.line2 ?? null,
      city: input.address.city,
      state: input.address.state,
      pincode: input.address.pincode,
    },
    expectedTotalPaise: input.expectedTotalPaise,
    payment: {
      method: input.payment.method,
      simulate: input.payment.simulate,
    },
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** True when a pending-payment order was placed strictly more than `olderThanMinutes` ago. */
export function pendingPaymentExpired(
  placedAt: Date,
  now: Date,
  olderThanMinutes: number,
): boolean {
  return placedAt.getTime() < now.getTime() - olderThanMinutes * 60_000;
}

export function settlementStatus(chargeStatus: 'SUCCEEDED' | 'FAILED'): OrderStatus {
  return chargeStatus === 'SUCCEEDED' ? 'CONFIRMED' : 'PAYMENT_FAILED';
}
