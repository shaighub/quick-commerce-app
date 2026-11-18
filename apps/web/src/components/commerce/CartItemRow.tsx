import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client.js';
import { formatInr } from '../../catalog/money.js';
import { useAuth } from '../../auth/AuthProvider.js';
import type { CartLine } from '@qc/shared';

export function CartItemRow({
  line,
  onChanged,
  onAnnounce,
}: {
  line: CartLine;
  onChanged: () => Promise<void>;
  onAnnounce: (message: string) => void;
}) {
  const { api } = useAuth();
  const rowRef = useRef<HTMLLIElement>(null);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setQuantity(String(line.quantity));
  }, [line.quantity]);

  async function commit(next: number): Promise<void> {
    if (next === line.quantity || next < 1 || next > 10) {
      setQuantity(String(line.quantity));
      return;
    }
    const previous = line.quantity;
    setQuantity(String(next));
    setPending(true);
    try {
      await api.updateCartItem(line.id, next);
      await onChanged();
      onAnnounce(`${line.product.name} quantity is now ${next}.`);
    } catch (error: unknown) {
      setQuantity(String(previous));
      const message = error instanceof ApiError ? error.message : 'Could not update the quantity';
      onAnnounce(`${line.product.name}: ${message}`);
      rowRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function remove(): Promise<void> {
    setPending(true);
    try {
      await api.removeCartItem(line.id);
      await onChanged();
      onAnnounce(`${line.product.name} removed from the cart.`);
    } catch (error: unknown) {
      onAnnounce(error instanceof ApiError ? error.message : 'Could not remove the item');
    } finally {
      setPending(false);
    }
  }

  const parsed = Number(quantity);

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className="flex flex-col gap-3 rounded border border-stone-200 bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{line.product.name}</h2>
        <p>{formatInr(line.lineTotalPaise)}</p>
      </div>
      <p className="text-sm text-stone-700">
        {line.product.unitLabel} · {formatInr(line.product.pricePaise)} each
        {line.available ? '' : ' · Unavailable'}
      </p>
      {!line.available ? (
        <p className="text-sm text-red-800">
          {line.product.stock < line.quantity
            ? `Only ${line.product.stock} left. Lower the quantity or remove this item.`
            : 'This product is no longer available. Remove it to check out.'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`qty-${line.id}`} className="text-sm font-medium">
            Quantity for {line.product.name}
          </label>
          <input
            id={`qty-${line.id}`}
            inputMode="numeric"
            className="w-20 rounded border border-stone-400 px-3 py-2"
            value={quantity}
            disabled={pending}
            onChange={(event) => {
              setQuantity(event.target.value);
            }}
            onBlur={() => {
              if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 10) {
                void commit(parsed);
              } else {
                setQuantity(String(line.quantity));
                onAnnounce('Quantity must be between 1 and 10.');
              }
            }}
          />
        </div>
        <button
          type="button"
          className="rounded border border-stone-400 px-3 py-2"
          disabled={pending || line.quantity <= 1}
          aria-label={`Decrease quantity of ${line.product.name}`}
          onClick={() => {
            void commit(line.quantity - 1);
          }}
        >
          Decrease
        </button>
        <button
          type="button"
          className="rounded border border-stone-400 px-3 py-2"
          disabled={pending || line.quantity >= 10}
          aria-label={`Increase quantity of ${line.product.name}`}
          onClick={() => {
            void commit(line.quantity + 1);
          }}
        >
          Increase
        </button>
        <button
          type="button"
          className="rounded border border-stone-400 px-3 py-2"
          disabled={pending}
          onClick={() => {
            void remove();
          }}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
