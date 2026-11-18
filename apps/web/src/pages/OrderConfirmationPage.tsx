import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { formatInr } from '../catalog/money.js';
import { ORDER_STATUS_LABEL } from '../commerce/labels.js';

export function OrderConfirmationPage() {
  const { orderNumber = '' } = useParams();
  const { api } = useAuth();
  useEffect(() => {
    document.title = 'Order confirmation · Quick Commerce';
  }, []);
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => api.getOrder(orderNumber),
    retry: false,
  });

  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Order confirmation</h1>
      {order.isLoading ? <p role="status">Loading order</p> : null}
      {order.isError ? (
        <p role="alert" className="text-red-800">
          This order could not be loaded.
        </p>
      ) : null}
      {order.data ? (
        <>
          <p className="text-lg">
            Order number <strong>{order.data.orderNumber}</strong>
          </p>
          <p>Status: {ORDER_STATUS_LABEL[order.data.status]}</p>
          <ul className="flex flex-col gap-1">
            {order.data.items.map((item) => (
              <li key={item.id}>
                {item.productName} × {item.quantity} · {formatInr(item.lineTotalPaise)}
              </li>
            ))}
          </ul>
          <p>Total {formatInr(order.data.totalPaise)}</p>
          <p>
            Deliver to {order.data.address.name}, {order.data.address.line1},{' '}
            {order.data.address.city} {order.data.address.pincode}
          </p>
          <p>
            <Link to={`/orders/${order.data.orderNumber}`}>View order details</Link>
          </p>
        </>
      ) : null}
    </article>
  );
}
