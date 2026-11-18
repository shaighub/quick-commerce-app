import type { Prisma } from '../generated/prisma/client.js';

export interface OrderNumberService {
  next(tx: Prisma.TransactionClient): Promise<string>;
}

/**
 * Upserts today's IST counter inside the checkout transaction (ADR-006).
 * The row lock makes concurrent checkouts receive consecutive numbers.
 */
export function createOrderNumberService(): OrderNumberService {
  return {
    async next(tx: Prisma.TransactionClient): Promise<string> {
      const rows = await tx.$queryRaw<Array<{ order_number: string }>>`
        WITH issued AS (
          INSERT INTO order_number_counters (day, last_value, updated_at)
          VALUES ((now() AT TIME ZONE 'Asia/Kolkata')::date, 1, now())
          ON CONFLICT (day) DO UPDATE
            SET last_value = order_number_counters.last_value + 1,
                updated_at = now()
          RETURNING day, last_value
        )
        SELECT 'QC-' || to_char(day, 'YYYYMMDD') || '-' || lpad(last_value::text, 6, '0') AS order_number
        FROM issued
      `;
      const orderNumber = rows[0]?.order_number;
      if (!orderNumber) {
        throw new Error('Order number counter did not return a value');
      }
      return orderNumber;
    },
  };
}
