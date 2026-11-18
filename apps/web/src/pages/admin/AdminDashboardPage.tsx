import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.js';
import { formatInr } from '../../catalog/money.js';
import { ORDER_STATUS_LABEL } from '../../commerce/labels.js';

export function AdminDashboardPage() {
  const { api } = useAuth();
  useEffect(() => {
    document.title = 'Admin dashboard · Quick Commerce';
  }, []);
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.dashboard(),
  });

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Admin dashboard</h1>
      {dashboard.isLoading ? <p role="status">Loading dashboard</p> : null}
      {dashboard.isError ? (
        <p role="alert" className="text-red-800">
          The dashboard could not be loaded.
        </p>
      ) : null}
      {dashboard.data ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-stone-200 bg-white p-4">
              <dt className="text-sm text-stone-700">Orders today</dt>
              <dd className="text-2xl font-semibold">{dashboard.data.ordersToday}</dd>
            </div>
            <div className="rounded border border-stone-200 bg-white p-4">
              <dt className="text-sm text-stone-700">Revenue today</dt>
              <dd className="text-2xl font-semibold">
                {formatInr(dashboard.data.revenueTodayPaise)}
              </dd>
            </div>
            <div className="rounded border border-stone-200 bg-white p-4">
              <dt className="text-sm text-stone-700">Open orders</dt>
              <dd className="text-2xl font-semibold">{dashboard.data.pendingOrders}</dd>
            </div>
          </dl>
          <section>
            <h2 className="text-xl font-semibold">Low stock</h2>
            {dashboard.data.lowStock.length === 0 ? <p>No low-stock products.</p> : null}
            <ul className="mt-2 flex flex-col gap-1">
              {dashboard.data.lowStock.map((item) => (
                <li key={item.id}>
                  {item.name} ({item.sku}) · {item.stock} left
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Recent orders</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {dashboard.data.recentOrders.map((item) => (
                <li key={item.orderNumber}>
                  <Link
                    className="underline-offset-4 hover:underline"
                    to={`/admin/orders/${item.orderNumber}`}
                  >
                    {item.orderNumber}
                  </Link>{' '}
                  · {item.customer.name} · {formatInr(item.totalPaise)} ·{' '}
                  {ORDER_STATUS_LABEL[item.status]}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </article>
  );
}
