import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatInr } from '../catalog/money.js';
import { cartQueryKey, useCart } from '../commerce/use-cart.js';
import { useAuth } from '../auth/AuthProvider.js';
import { CartItemRow } from '../components/commerce/CartItemRow.js';

export function CartPage() {
  const cart = useCart();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: cartQueryKey });
  }

  const blocked = cart.data?.items.some((line) => !line.available) ?? false;

  useEffect(() => {
    document.title = 'Cart · Quick Commerce';
  }, []);

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Cart</h1>
      <div role="status" aria-live="polite" className="text-sm text-stone-800">
        {notice}
      </div>
      {cart.isLoading ? <p role="status">Loading cart</p> : null}
      {cart.isError ? (
        <p role="alert" className="text-red-800">
          The cart could not be loaded.
        </p>
      ) : null}
      {cart.data && cart.data.items.length === 0 ? (
        <p>
          Your cart is empty. <Link to="/">Continue shopping</Link>
        </p>
      ) : null}
      {cart.data && cart.data.items.length > 0 ? (
        <>
          {blocked ? (
            <p role="alert" className="rounded bg-amber-100 px-3 py-2 text-amber-950">
              Remove unavailable items, or lower a quantity that is above the stock, before
              checkout.
            </p>
          ) : null}
          <ul className="flex flex-col gap-4">
            {cart.data.items.map((line) => (
              <CartItemRow key={line.id} line={line} onChanged={refresh} onAnnounce={setNotice} />
            ))}
          </ul>
          <dl className="grid max-w-sm grid-cols-2 gap-2 text-sm">
            <dt>Subtotal</dt>
            <dd className="text-right">{formatInr(cart.data.subtotalPaise)}</dd>
            <dt>Delivery</dt>
            <dd className="text-right">{formatInr(cart.data.deliveryFeePaise)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{formatInr(cart.data.totalPaise)}</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            {blocked || cart.data.totalPaise === 0 ? (
              <button
                type="button"
                disabled
                className="rounded bg-stone-300 px-4 py-2 text-stone-800"
              >
                Checkout
              </button>
            ) : (
              <Link
                to="/checkout"
                className="rounded bg-stone-900 px-4 py-2 font-medium text-white no-underline"
              >
                Checkout
              </Link>
            )}
            <button
              type="button"
              className="rounded border border-stone-400 px-4 py-2"
              disabled={clearing}
              onClick={() => {
                setClearing(true);
                void api
                  .clearCart()
                  .then(refresh)
                  .then(() => {
                    setNotice('Cart cleared.');
                  })
                  .finally(() => {
                    setClearing(false);
                  });
              }}
            >
              Clear cart
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
