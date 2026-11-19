import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { cartQueryKey } from '../../commerce/use-cart.js';
import { rememberPendingAdd } from '../../commerce/pending-add.js';

export function AddToCart({ productId, available }: { productId: string; available: boolean }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!available) {
    return (
      <button type="button" disabled className="rounded bg-stone-300 px-4 py-2 text-stone-800">
        Out of stock
      </button>
    );
  }
  if (auth.status !== 'authenticated' || auth.user?.role !== 'CUSTOMER') {
    const next = `${location.pathname}${location.search}`;
    return (
      <Link
        to={`/login?next=${encodeURIComponent(next)}`}
        className="inline-block rounded bg-stone-900 px-4 py-2 text-white no-underline"
        onClick={() => {
          rememberPendingAdd(productId);
        }}
      >
        Add to cart
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded bg-stone-900 px-4 py-2 text-white disabled:bg-stone-700"
        onClick={() => {
          setPending(true);
          setMessage(null);
          void auth.api
            .addCartItem({ productId, quantity: 1 })
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: cartQueryKey });
              void navigate('/cart');
            })
            .catch((error: unknown) => {
              setPending(false);
              setMessage(error instanceof ApiError ? error.message : 'Could not add this item');
            });
        }}
      >
        {pending ? 'Adding…' : 'Add to cart'}
      </button>
      {message ? (
        <p role="alert" className="text-sm text-red-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
