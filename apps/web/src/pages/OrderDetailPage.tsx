import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { formatInr } from '../catalog/money.js';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../commerce/labels.js';

export function OrderDetailPage() {
  const { orderNumber = '' } = useParams();
  const { api } = useAuth();
  useEffect(() => {
    document.title = 'Order detail · Quick Commerce';
  }, []);
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => api.getOrder(orderNumber),
    retry: false,
  });

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Order detail</h1>
      {order.isLoading ? <p role="status">Loading order</p> : null}
      {order.isError ? (
        <p role="alert" className="text-red-800">
          This order could not be loaded. <Link to="/orders">Back to my orders</Link>
        </p>
      ) : null}
      {order.data ? (
        <>
          <p className="text-lg font-semibold">{order.data.orderNumber}</p>
          <p>Status: {ORDER_STATUS_LABEL[order.data.status]}</p>
          {order.data.payment ? (
            <p>Payment: {PAYMENT_STATUS_LABEL[order.data.payment.status]}</p>
          ) : null}
          <h2 className="text-xl font-semibold">Items</h2>
          <ul className="flex flex-col gap-1">
            {order.data.items.map((item) => (
              <li key={item.id}>
                {item.productName} · {formatInr(item.unitPricePaise)} × {item.quantity} ={' '}
                {formatInr(item.lineTotalPaise)}
              </li>
            ))}
          </ul>
          <p>Total {formatInr(order.data.totalPaise)}</p>
          <h2 className="text-xl font-semibold">Address</h2>
          <p>
            {order.data.address.name}, {order.data.address.line1}
            {order.data.address.line2 ? `, ${order.data.address.line2}` : ''},{' '}
            {order.data.address.city}, {order.data.address.state} {order.data.address.pincode}
          </p>
          <h2 className="text-xl font-semibold">Status history</h2>
          <ol className="flex flex-col gap-1">
            {order.data.history.map((entry) => (
              <li key={entry.id}>
                {ORDER_STATUS_LABEL[entry.toStatus]}
                {entry.note ? ` — ${entry.note}` : ''}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </article>
  );
}
