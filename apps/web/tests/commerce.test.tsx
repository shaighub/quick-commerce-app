import type {} from '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import type { InitialAuth } from '../src/auth/AuthProvider.js';
import { readPendingAdd } from '../src/commerce/pending-add.js';
import { routes } from '../src/routes.js';

const productId = '30000000-0000-4000-8000-000000000001';
const lineId = '40000000-0000-4000-8000-000000000001';
const orderNumber = 'QC-20261118-000123';

const customer: InitialAuth = {
  status: 'authenticated',
  accessToken: 'customer-token',
  user: {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Asha Rao',
    email: 'asha@example.com',
    role: 'CUSTOMER',
  },
};
const admin: InitialAuth = {
  status: 'authenticated',
  accessToken: 'admin-token',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Store Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};
const guest: InitialAuth = { status: 'guest' };

const line = {
  id: lineId,
  quantity: 1,
  lineTotalPaise: 5600,
  available: true,
  product: {
    id: productId,
    name: 'Amul Butter',
    slug: 'amul-butter',
    unitLabel: '500 g',
    pricePaise: 5600,
    imageUrl: null,
    stock: 25,
    isActive: true,
  },
};

function cartOf(items = [line], extra: Record<string, number> = {}) {
  const subtotalPaise = items.reduce(
    (sum, item) => (item.available ? sum + item.lineTotalPaise : sum),
    0,
  );
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalPaise,
    deliveryFeePaise: subtotalPaise > 0 ? 2500 : 0,
    totalPaise: subtotalPaise > 0 ? subtotalPaise + 2500 : 0,
    ...extra,
  };
}

const order = {
  orderNumber,
  status: 'CONFIRMED' as const,
  itemCount: 1,
  subtotalPaise: 5600,
  deliveryFeePaise: 2500,
  totalPaise: 8100,
  placedAt: '2026-11-18T04:00:00.000Z',
  address: {
    name: 'Asha Rao',
    phone: '+919876543210',
    line1: '12 Residency Road',
    line2: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
  items: [
    {
      id: '50000000-0000-4000-8000-000000000001',
      productId,
      productName: 'Amul Butter',
      sku: 'BUTTER-1',
      unitLabel: '500 g',
      unitPricePaise: 5600,
      quantity: 1,
      lineTotalPaise: 5600,
    },
  ],
  payment: {
    id: '60000000-0000-4000-8000-000000000001',
    provider: 'MOCK',
    status: 'SUCCEEDED' as const,
    amountPaise: 8100,
    currency: 'INR',
    providerRef: 'mock_pay_1',
    failureReason: null,
  },
  history: [
    {
      id: '70000000-0000-4000-8000-000000000001',
      fromStatus: null,
      toStatus: 'PENDING_PAYMENT' as const,
      note: 'Order placed',
      createdAt: '2026-11-18T04:00:00.000Z',
      changedById: null,
    },
    {
      id: '70000000-0000-4000-8000-000000000002',
      fromStatus: 'PENDING_PAYMENT' as const,
      toStatus: 'CONFIRMED' as const,
      note: 'Payment succeeded',
      createdAt: '2026-11-18T04:00:01.000Z',
      changedById: null,
    },
  ],
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function error(
  code: string,
  message: string,
  details?: unknown[],
  status = 409,
): Promise<Response> {
  return json({ error: { code, message, details, requestId: 'req-1' } }, status);
}

function renderAt(path: string, initialAuth: InitialAuth = customer) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<App router={router} initialAuth={initialAuth} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('cart screen', () => {
  it('updates quantity, removes a line, and blocks checkout for an unavailable item', async () => {
    let current = cartOf();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (init?.method === 'PATCH') {
          return error('INSUFFICIENT_STOCK', 'Only 1 left', [{ productId, available: 1 }]);
        }
        if (init?.method === 'DELETE' && url.includes('/cart/items')) {
          current = cartOf([]);
          return json(current);
        }
        if (url.includes('/cart')) {
          return json(current);
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    renderAt('/cart');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/₹81\.00|₹81/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Amul Butter' }));
    expect(await screen.findByText(/Only 1 left/)).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity for Amul Butter')).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/Your cart is empty/)).toBeInTheDocument();

    current = cartOf([{ ...line, available: false, product: { ...line.product, stock: 0 } }]);
    renderAt('/cart');
    expect(await screen.findByRole('button', { name: 'Checkout' })).toBeDisabled();
    const before = calls.filter((call) => call.startsWith('GET') && call.includes('/cart')).length;
    window.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => {
      expect(
        calls.filter((call) => call.startsWith('GET') && call.includes('/cart')).length,
      ).toBeGreaterThan(before);
    });
  });
});

describe('checkout and confirmation', () => {
  it('places an order and shows the order number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        if (url.includes('/auth/me')) {
          return json({ user: { ...customer.user, lastAddress: order.address } });
        }
        if (url.includes('/serviceability')) {
          return json({ pincode: '560001', serviceable: true, deliveryFeePaise: 2500 });
        }
        if (init?.method === 'POST' && url.includes('/orders/checkout')) {
          return json({ order }, 201);
        }
        if (url.includes('/orders/')) {
          return json({ order });
        }
        if (url.includes('/cart')) {
          return json(cartOf());
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    const router = renderAt('/checkout');
    expect(await screen.findByLabelText('Name')).toHaveValue('Asha Rao');
    expect(await screen.findByText(/We deliver to 560001/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order confirmation' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(orderNumber)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orders/${orderNumber}/confirmation`);
    cleanup();
  });

  it('asks the shopper to confirm a new total and shows a payment failure', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        if (url.includes('/auth/me')) {
          return json({ user: { ...customer.user, lastAddress: null } });
        }
        if (url.includes('/serviceability')) {
          return json({ pincode: '560001', serviceable: true, deliveryFeePaise: 2500 });
        }
        if (init?.method === 'POST' && url.includes('/orders/checkout')) {
          attempts += 1;
          if (attempts === 1) {
            return error(
              'PRICE_CHANGED',
              'The total changed. Confirm the new total to place the order.',
              [{ cart: cartOf(), totalPaise: 9100 }],
            );
          }
          if (attempts === 2) {
            return json({ order }, 201);
          }
          return error('PAYMENT_FAILED', 'Payment failed', [{ orderNumber }], 402);
        }
        if (url.includes('/orders/')) {
          return json({ order });
        }
        if (url.includes('/cart')) {
          return json(cartOf());
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    renderAt('/checkout');
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Address line 1'), {
      target: { value: '12 Residency Road' },
    });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Bengaluru' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'Karnataka' } });
    fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '560001' } });
    expect(await screen.findByText(/We deliver to 560001/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('button', { name: 'Confirm new total' })).toBeInTheDocument();
    expect(screen.getByText(/total changed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new total' }));
    expect(await screen.findByText(orderNumber)).toBeInTheDocument();
    cleanup();

    const failed = renderAt('/checkout');
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Address line 1'), {
      target: { value: '12 Residency Road' },
    });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Bengaluru' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'Karnataka' } });
    fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '560001' } });
    expect(await screen.findByText(/We deliver to 560001/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Simulate failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Payment failed/);
    expect(failed.state.location.pathname).toBe('/checkout');
  });
});

describe('order history and admin orders', () => {
  it('lists the customer’s orders and the order detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes(`/orders/${orderNumber}`)) {
          return json({ order });
        }
        if (url.includes('/orders')) {
          return json({
            items: [
              {
                orderNumber,
                placedAt: order.placedAt,
                itemCount: 1,
                totalPaise: 8100,
                status: 'CONFIRMED',
              },
            ],
            page: 1,
            pageSize: 24,
            total: 1,
          });
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    const router = renderAt('/orders');
    expect(await screen.findByRole('link', { name: orderNumber })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: orderNumber }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order detail' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Payment succeeded/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orders/${orderNumber}`);
  });

  it('lets an admin filter orders and update a status', async () => {
    const detail = {
      order,
      customer: { id: customer.user.id, name: 'Asha Rao', email: 'asha@example.com' },
      allowedNextStatuses: ['PACKED', 'CANCELLED'],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        if (init?.method === 'PATCH') {
          return json({
            ...detail,
            order: { ...order, status: 'PACKED' },
            allowedNextStatuses: ['OUT_FOR_DELIVERY', 'CANCELLED'],
          });
        }
        if (url.includes(`/admin/orders/${orderNumber}`)) {
          return json(detail);
        }
        if (url.includes('/admin/orders')) {
          return json({
            items: [
              {
                orderNumber,
                customer: detail.customer,
                placedAt: order.placedAt,
                totalPaise: 8100,
                paymentStatus: 'SUCCEEDED',
                status: 'CONFIRMED',
              },
            ],
            page: 1,
            pageSize: 24,
            total: 1,
          });
        }
        if (url.includes('/admin/dashboard')) {
          return json({
            ordersToday: 2,
            revenueTodayPaise: 8100,
            pendingOrders: 1,
            lowStock: [{ id: productId, name: 'Amul Butter', sku: 'BUTTER-1', stock: 2 }],
            recentOrders: [
              {
                orderNumber,
                customer: detail.customer,
                placedAt: order.placedAt,
                totalPaise: 8100,
                status: 'CONFIRMED',
              },
            ],
          });
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    renderAt('/admin', admin);
    expect(await screen.findByText('Orders today')).toBeInTheDocument();
    expect(screen.getByText('Amul Butter (BUTTER-1) · 2 left')).toBeInTheDocument();
    const router = renderAt('/admin/orders', admin);
    expect(await screen.findByRole('link', { name: orderNumber })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(router.state.location.search).toContain('q=Asha');
    fireEvent.click(screen.getByRole('link', { name: orderNumber }));
    expect(await screen.findByRole('button', { name: 'Mark Packed' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Packed' }));
    expect(await screen.findByText('Status updated.')).toBeInTheDocument();
  });

  it('adds the pending item after a guest logs in', async () => {
    const posted: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        if (url.includes('/products/amul-butter')) {
          return json({
            product: {
              id: productId,
              name: 'Amul Butter',
              slug: 'amul-butter',
              unitLabel: '500 g',
              pricePaise: 5600,
              imageUrl: null,
              stockStatus: 'IN_STOCK',
              stock: 25,
              sku: 'BUTTER-1',
              description: null,
              category: {
                id: '10000000-0000-4000-8000-000000000001',
                name: 'Dairy',
                slug: 'dairy',
              },
              subcategory: {
                id: '20000000-0000-4000-8000-000000000001',
                name: 'Milk',
                slug: 'milk',
              },
            },
          });
        }
        if (url.includes('/products')) {
          return json({ items: [], page: 1, pageSize: 4, total: 0 });
        }
        if (init?.method === 'POST' && url.includes('/cart/items')) {
          posted.push(url);
          return json(cartOf());
        }
        if (url.includes('/cart')) {
          return json(cartOf());
        }
        return error('NOT_FOUND', 'Missing', undefined, 404);
      }),
    );
    const router = renderAt('/p/amul-butter', guest);
    fireEvent.click(await screen.findByRole('link', { name: 'Add to cart' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(readPendingAdd()?.productId).toBe(productId);
    renderAt('/', customer);
    await waitFor(() => {
      expect(posted.length).toBe(1);
    });
    expect(await screen.findByRole('link', { name: 'Cart (1)' })).toBeInTheDocument();
  });
});
