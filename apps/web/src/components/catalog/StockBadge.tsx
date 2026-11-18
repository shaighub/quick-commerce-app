import type { StockStatus } from '@qc/shared';

const label: Record<StockStatus, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

export function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span className="inline-block rounded bg-stone-200 px-2 py-1 text-sm font-medium text-stone-900">
      {label[status]}
    </span>
  );
}
