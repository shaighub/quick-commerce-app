import type {} from '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import type { InitialAuth } from '../src/auth/AuthProvider.js';
import { CATALOG_STALE_TIME_MS } from '../src/catalog/stale.js';
import { formatInr, rupeesToPaise } from '../src/catalog/money.js';
import { routes } from '../src/routes.js';

const categoryId = '10000000-0000-4000-8000-000000000001';
const subId = '20000000-0000-4000-8000-000000000001';
const productId = '30000000-0000-4000-8000-000000000001';

const publicCategory = {
  id: categoryId,
  name: 'Dairy & Bread',
  slug: 'dairy-bread',
  imageUrl: 'https://images.example.com/dairy.jpg',
  subcategories: [{ id: subId, name: 'Milk', slug: 'milk' }],
};

const adminCategory = {
  ...publicCategory,
  description: 'Everyday dairy',
  sortOrder: 1,
  isActive: true,
  subcategoryCount: 1,
  productCount: 1,
  subcategories: [
    {
      id: subId,
      categoryId,
      name: 'Milk',
      slug: 'milk',
      description: null,
      sortOrder: 1,
      isActive: true,
    },
  ],
};

const card = {
  id: productId,
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '500 g',
  pricePaise: 5600,
  imageUrl: 'https://images.example.com/butter.jpg',
  stockStatus: 'IN_STOCK',
  category: { id: categoryId, name: 'Dairy & Bread', slug: 'dairy-bread' },
  subcategory: { id: subId, name: 'Milk', slug: 'milk' },
};

const detail = { ...card, sku: 'BUTTER-1', description: 'Salted butter', stock: 25 };

const adminProduct = {
  id: productId,
  name: 'Amul Butter',
  slug: 'amul-butter',
  sku: 'BUTTER-1',
  description: 'Salted butter',
  unitLabel: '500 g',
  pricePaise: 5600,
  stock: 25,
  imageUrl: 'https://images.example.com/butter.jpg',
  isActive: true,
  deletedAt: null,
  subcategoryId: subId,
  category: card.category,
  subcategory: card.subcategory,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
};

const guest: InitialAuth = { status: 'guest' };
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

function renderAt(path: string, initialAuth: InitialAuth = guest) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<App router={router} initialAuth={initialAuth} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('money', () => {
  it('formats paise as rupees and parses shopper input', () => {
    expect(formatInr(5600)).toContain('56');
    expect(rupeesToPaise('')).toBeUndefined();
    expect(rupeesToPaise('28')).toBe(2800);
    expect(rupeesToPaise('28.5')).toBe(2850);
    expect(rupeesToPaise('28.555')).toBeNull();
    expect(CATALOG_STALE_TIME_MS).toBe(60_000);
  });
});

describe('storefront catalog', () => {
  it('shows categories, a product, and sends a guest to log in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/serviceability')) {
          return json({ pincode: '560001', serviceable: true, deliveryFeePaise: 2500 });
        }
        if (url.includes('/categories')) {
          return json([publicCategory]);
        }
        if (url.includes('/products/amul-butter')) {
          return json({ product: detail });
        }
        if (url.includes('/products')) {
          return json({
            items: [
              card,
              {
                ...card,
                id: '30000000-0000-4000-8000-000000000002',
                name: 'Salted Peanuts',
                slug: 'peanuts',
                stockStatus: 'OUT_OF_STOCK',
              },
            ],
            page: 1,
            pageSize: 24,
            total: 30,
          });
        }
        return json({ error: { code: 'NOT_FOUND', message: 'Missing', requestId: 'r' } }, 404);
      }),
    );
    const router = renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Amul Butter' })).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dairy & Bread' }));
    expect(router.state.location.pathname).toBe('/search');
    expect(router.state.location.search).toContain('category=dairy-bread');
    expect(await screen.findByRole('link', { name: 'Add to cart' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Add to cart' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.search).toContain('next=');
  });

  it('keeps filters in the URL, clears them, and pages results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('q=missing')) {
          return json({ items: [], page: 1, pageSize: 24, total: 0 });
        }
        if (url.includes('/categories')) {
          return json([publicCategory]);
        }
        return json({ items: [card], page: 1, pageSize: 24, total: 30 });
      }),
    );
    const router = renderAt('/search');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Minimum price (₹)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Maximum price (₹)'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum price cannot be above the maximum.',
    );
    fireEvent.change(screen.getByLabelText('Maximum price (₹)'), { target: { value: '80' } });
    fireEvent.click(screen.getByLabelText('In stock only'));
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'price_asc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(router.state.location.search).toContain('min=10');
    expect(router.state.location.search).toContain('max=80');
    expect(router.state.location.search).toContain('inStock=true');
    expect(router.state.location.search).toContain('sort=price_asc');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(router.state.location.pathname).toBe('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(router.state.location.search).toContain('page=2');
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No results for "missing".')).toBeInTheDocument();
  });

  it('checks a pincode and shows a missing product', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('pincode=560001')) {
          return json({ pincode: '560001', serviceable: true, deliveryFeePaise: 2500 });
        }
        if (url.includes('pincode=110001')) {
          return json({ pincode: '110001', serviceable: false, deliveryFeePaise: 2500 });
        }
        if (url.includes('/products/missing')) {
          return json(
            { error: { code: 'NOT_FOUND', message: 'Product not found', requestId: 'r' } },
            404,
          );
        }
        if (url.includes('/categories')) {
          return json([]);
        }
        return json({ items: [], page: 1, pageSize: 24, total: 0 });
      }),
    );
    renderAt('/');
    fireEvent.change(screen.getByLabelText('Delivery pincode'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Delivery pincode'), { target: { value: '560001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/We deliver to 560001/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Delivery pincode'), { target: { value: '110001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/do not deliver to 110001/)).toBeInTheDocument();

    renderAt('/p/missing');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product not found' }),
    ).toBeInTheDocument();
  });

  it('shows the product detail breadcrumb and sends a customer toward the cart', async () => {
    const emptyCart = {
      items: [],
      itemCount: 0,
      subtotalPaise: 0,
      deliveryFeePaise: 0,
      totalPaise: 0,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        const url = requestUrl(input);
        if (url.includes('/products/amul-butter')) {
          return json({ product: detail });
        }
        if (url.includes('/products')) {
          return json({ items: [card], page: 1, pageSize: 4, total: 1 });
        }
        if (url.includes('/cart')) {
          return json(
            init?.method === 'POST'
              ? {
                  ...emptyCart,
                  itemCount: 1,
                  items: [
                    {
                      id: '40000000-0000-4000-8000-000000000001',
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
                    },
                  ],
                  subtotalPaise: 5600,
                  deliveryFeePaise: 2500,
                  totalPaise: 8100,
                }
              : emptyCart,
          );
        }
        return json([]);
      }),
    );
    const router = renderAt('/p/amul-butter', customer);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Dairy & Bread',
    );
    expect(screen.getByText('500 g')).toBeInTheDocument();
    expect(screen.getByText('Salted butter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cart' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cart');
  });
});

describe('admin catalog', () => {
  it('validates a category, creates it, and confirms deletion', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (init?.method === 'POST' && url.includes('/admin/categories')) {
        return json({ category: adminCategory }, 201);
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/admin/categories')) {
        return json([adminCategory]);
      }
      return json([]);
    });
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/admin/categories', admin);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Dairy & Bread' }),
    ).toBeInTheDocument();
    const name = document.getElementById('category-name');
    if (!(name instanceof HTMLInputElement)) {
      throw new Error('category name field is missing');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    fireEvent.change(name, { target: { value: 'Snacks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true);
    });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    const firstDelete = deleteButtons[0];
    if (!firstDelete) {
      throw new Error('delete button is missing');
    }
    fireEvent.click(firstDelete);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const again = screen.getAllByRole('button', { name: 'Delete' })[0];
    if (!again) {
      throw new Error('delete button is missing');
    }
    fireEvent.click(again);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(true);
    });
  });

  it('edits a category, adds a subcategory, and closes the dialog with Escape', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (init?.method === 'PATCH' || init?.method === 'POST') {
        return json({ category: adminCategory, subcategory: adminCategory.subcategories[0] });
      }
      if (url.includes('/admin/categories')) {
        return json([adminCategory]);
      }
      return json([]);
    });
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/admin/categories', admin);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Dairy & Bread' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editName = document.getElementById(`edit-name-${categoryId}`);
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('edit name is missing');
    }
    fireEvent.change(editName, { target: { value: 'Dairy Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(true);
    });
    const parent = document.getElementById('sub-parent');
    const subName = document.getElementById('sub-name');
    if (!(parent instanceof HTMLSelectElement) || !(subName instanceof HTMLInputElement)) {
      throw new Error('subcategory form is missing');
    }
    fireEvent.change(parent, { target: { value: categoryId } });
    fireEvent.change(subName, { target: { value: 'Curd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add subcategory' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save subcategory' }));
    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.filter((call) => call[1]?.method === 'PATCH').length,
      ).toBeGreaterThan(1);
    });
    const deleteButton = screen.getAllByRole('button', { name: 'Delete' })[0];
    if (!deleteButton) {
      throw new Error('delete button is missing');
    }
    fireEvent.click(deleteButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves a product and deletes one from the list', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (init?.method === 'POST') {
        return json({ product: adminProduct }, 201);
      }
      if (init?.method === 'PATCH') {
        return json({ product: adminProduct });
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes(`/admin/products/${productId}`)) {
        return json({ product: adminProduct });
      }
      if (url.includes('/admin/categories')) {
        return json([adminCategory]);
      }
      return json({ items: [adminProduct], page: 1, pageSize: 24, total: 30 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const router = renderAt('/admin/products/new', admin);
    await screen.findByRole('option', { name: 'Milk' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Paneer' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'PANEER-1' } });
    fireEvent.change(screen.getByLabelText('Subcategory'), { target: { value: subId } });
    fireEvent.change(screen.getByLabelText('Price (₹)'), { target: { value: '56.50' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: '200 g' } });
    fireEvent.change(screen.getByLabelText('Stock'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/products');
    });

    cleanup();
    renderAt(`/admin/products/${productId}/edit`, admin);
    expect(await screen.findByLabelText('Price (₹)')).toHaveValue('56');
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(true);
    });

    cleanup();
    renderAt('/admin/products?status=active', admin);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(true);
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });

  it('validates the product form before saving', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes('/admin/categories')) {
        return json([adminCategory]);
      }
      if (url.includes('/admin/products/')) {
        return json({ product: adminProduct });
      }
      return json({ items: [adminProduct], page: 1, pageSize: 24, total: 1 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/admin/products/new', admin);
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);

    cleanup();
    renderAt('/admin/products', admin);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Amul Butter' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Stock 25/)).toBeInTheDocument();
  });
});
