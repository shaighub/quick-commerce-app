import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { formatInr } from '../catalog/money.js';
import { ORDER_STATUS_LABEL } from '../commerce/labels.js';

export function MyOrdersPage() {
  const { api } = useAuth();
  const [params] = useSearchParams();
  const page = Number(params.get('page') ?? '1') || 1;
  useEffect(() => {
    document.title = 'My orders · Quick Commerce';
  }, []);
  const orders = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api.listOrders(page),
  });

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">My orders</h1>
      {orders.isLoading ? <p role="status">Loading orders</p> : null}
      {orders.isError ? (
        <p role="alert" className="text-red-800">
          Orders could not be loaded.
        </p>
      ) : null}
      {orders.data && orders.data.items.length === 0 ? (
        <p>You have not placed an order yet.</p>
      ) : null}
      {orders.data && orders.data.items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {orders.data.items.map((item) => (
            <li key={item.orderNumber} className="rounded border border-stone-200 bg-white p-4">
              <Link
                className="font-semibold underline-offset-4 hover:underline"
                to={`/orders/${item.orderNumber}`}
              >
                {item.orderNumber}
              </Link>
              <p className="text-sm text-stone-700">
                {ORDER_STATUS_LABEL[item.status]} · {item.itemCount} items ·{' '}
                {formatInr(item.totalPaise)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
