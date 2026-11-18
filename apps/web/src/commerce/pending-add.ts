const PENDING_ADD_KEY = 'qc-pending-add';

export interface PendingAdd {
  productId: string;
  quantity: number;
}

export function rememberPendingAdd(productId: string, quantity = 1): void {
  sessionStorage.setItem(PENDING_ADD_KEY, JSON.stringify({ productId, quantity }));
}

export function readPendingAdd(): PendingAdd | null {
  const raw = sessionStorage.getItem(PENDING_ADD_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('productId' in parsed)) {
      return null;
    }
    const productId = parsed.productId;
    const quantity = 'quantity' in parsed ? parsed.quantity : 1;
    if (typeof productId !== 'string' || typeof quantity !== 'number') {
      return null;
    }
    return { productId, quantity };
  } catch {
    return null;
  }
}

export function clearPendingAdd(): void {
  sessionStorage.removeItem(PENDING_ADD_KEY);
}
