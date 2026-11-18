import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { orderStatusSchema } from '@qc/shared';
import { useAuth } from '../../auth/AuthProvider.js';
import { formatInr } from '../../catalog/money.js';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../../commerce/labels.js';

const statuses = orderStatusSchema.options;

export function AdminOrdersPage() {
  const { api } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = params.get('page') ?? '1';
  const [draftQ, setDraftQ] = useState(q);
  const orders = useQuery({
    queryKey: ['admin-orders', status, q, from, to, page],
    queryFn: () =>
      api.listAdminOrders({
        status: status || undefined,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      }),
  });

  useEffect(() => {
    document.title = 'Admin orders · Quick Commerce';
  }, []);

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['status', 'q', 'from', 'to']) {
      const raw = data.get(key);
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value !== '') {
        next.set(key, value);
      }
    }
    setParams(next);
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Admin orders</h1>
      <form className="flex flex-wrap items-end gap-3" onSubmit={apply}>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded border border-stone-400 px-3 py-2"
          >
            <option value="">Any</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Search
          <input
            name="q"
            value={draftQ}
            onChange={(event) => {
              setDraftQ(event.target.value);
            }}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          From
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 font-medium text-white">
          Apply
        </button>
      </form>
      {orders.isLoading ? <p role="status">Loading orders</p> : null}
      {orders.isError ? (
        <p role="alert" className="text-red-800">
          Orders could not be loaded.
        </p>
      ) : null}
      {orders.data && orders.data.items.length === 0 ? <p>No orders match these filters.</p> : null}
      {orders.data && orders.data.items.length > 0 ? (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-stone-300 py-2">Order</th>
              <th className="border-b border-stone-300 py-2">Customer</th>
              <th className="border-b border-stone-300 py-2">Total</th>
              <th className="border-b border-stone-300 py-2">Payment</th>
              <th className="border-b border-stone-300 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.data.items.map((item) => (
              <tr key={item.orderNumber}>
                <td className="border-b border-stone-200 py-2">
                  <Link
                    className="underline-offset-4 hover:underline"
                    to={`/admin/orders/${item.orderNumber}`}
                  >
                    {item.orderNumber}
                  </Link>
                </td>
                <td className="border-b border-stone-200 py-2">{item.customer.name}</td>
                <td className="border-b border-stone-200 py-2">{formatInr(item.totalPaise)}</td>
                <td className="border-b border-stone-200 py-2">
                  {item.paymentStatus ? PAYMENT_STATUS_LABEL[item.paymentStatus] : '—'}
                </td>
                <td className="border-b border-stone-200 py-2">
                  {ORDER_STATUS_LABEL[item.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}
