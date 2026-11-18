import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.js';

export function AddToCart({ available }: { available: boolean }) {
  const auth = useAuth();
  const location = useLocation();
  if (!available) {
    return (
      <button type="button" disabled className="rounded bg-stone-300 px-4 py-2 text-stone-700">
        Out of stock
      </button>
    );
  }
  if (auth.status !== 'authenticated') {
    const next = `${location.pathname}${location.search}`;
    return (
      <Link
        to={`/login?next=${encodeURIComponent(next)}`}
        className="inline-block rounded bg-stone-900 px-4 py-2 text-white"
      >
        Add to cart
      </Link>
    );
  }
  return (
    <Link to="/cart" className="inline-block rounded bg-stone-900 px-4 py-2 text-white">
      Add to cart
    </Link>
  );
}
