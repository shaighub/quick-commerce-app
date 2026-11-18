import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { formatInr } from '../../catalog/money.js';
import { ORDER_STATUS_LABEL } from '../../commerce/labels.js';

export function AdminOrderPage() {
  const { orderNumber = '' } = useParams();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    document.title = 'Admin order · Quick Commerce';
  }, []);
  const order = useQuery({
    queryKey: ['admin-order', orderNumber],
    queryFn: () => api.getAdminOrder(orderNumber),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (status: string) =>
      api.updateOrderStatus(orderNumber, {
        status,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      }),
    onSuccess: async () => {
      setMessage('Status updated.');
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-order', orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof ApiError ? error.message : 'The status could not be updated.');
    },
  });

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Admin order</h1>
      <p>
        <Link to="/admin/orders">Back to orders</Link>
      </p>
      {order.isLoading ? <p role="status">Loading order</p> : null}
      {order.isError ? (
        <p role="alert" className="text-red-800">
          This order could not be loaded.
        </p>
      ) : null}
      {order.data ? (
        <>
          <p className="text-lg font-semibold">{order.data.order.orderNumber}</p>
          <p>
            {order.data.customer.name} · {order.data.customer.email}
          </p>
          <p>Status: {ORDER_STATUS_LABEL[order.data.order.status]}</p>
          <p>Total {formatInr(order.data.order.totalPaise)}</p>
          <ul>
            {order.data.order.items.map((item) => (
              <li key={item.id}>
                {item.productName} × {item.quantity} · {formatInr(item.lineTotalPaise)}
              </li>
            ))}
          </ul>
          <h2 className="text-xl font-semibold">Update status</h2>
          {order.data.allowedNextStatuses.length === 0 ? <p>No further status changes.</p> : null}
          <label className="flex max-w-md flex-col gap-1 text-sm" htmlFor="status-note">
            Note
            <textarea
              id="status-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              className="rounded border border-stone-400 px-3 py-2"
              maxLength={500}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {order.data.allowedNextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:bg-stone-700"
                disabled={update.isPending}
                onClick={() => {
                  update.mutate(status);
                }}
              >
                Mark {ORDER_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
