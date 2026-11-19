import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { formText } from '../../catalog/form.js';
import { formatInr } from '../../catalog/money.js';
import { CATALOG_STALE_TIME_MS } from '../../catalog/stale.js';
import { ConfirmDialog } from '../../components/catalog/ConfirmDialog.js';
import { Pagination } from '../../components/catalog/Pagination.js';

export function AdminProductsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const status = params.get('status') ?? '';
  const lowStock = params.get('lowStock') === 'true';
  const page = Number(params.get('page') ?? '1');
  const [draftQ, setDraftQ] = useState(q);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories', 'admin'],
    queryFn: () => api.listAdminCategories(true),
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const products = useQuery({
    queryKey: ['admin-products', q, categoryId, status, lowStock, page],
    queryFn: () =>
      api.listAdminProducts({
        q: q || undefined,
        categoryId: categoryId || undefined,
        status:
          status === 'active' || status === 'inactive' || status === 'deleted' ? status : undefined,
        lowStock: lowStock ? 'true' : undefined,
        page: Number.isInteger(page) && page > 0 ? page : 1,
      }),
    staleTime: CATALOG_STALE_TIME_MS,
  });

  function onFilter(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const query = formText(form, 'q').trim();
    const category = formText(form, 'categoryId');
    const nextStatus = formText(form, 'status');
    if (query !== '') {
      next.set('q', query);
    }
    if (category !== '') {
      next.set('categoryId', category);
    }
    if (nextStatus !== '') {
      next.set('status', nextStatus);
    }
    if (form.get('lowStock') === 'on') {
      next.set('lowStock', 'true');
    }
    setParams(next);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteId) {
      return;
    }
    setPending(true);
    try {
      await api.deleteProduct(deleteId);
      setDeleteId(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete the product');
      setDeleteId(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Products</h1>
        <Link
          to="/admin/products/new"
          className="rounded bg-stone-900 px-4 py-2 text-white no-underline"
        >
          New product
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={onFilter}
        className="grid gap-3 rounded border border-stone-200 bg-white p-4 md:grid-cols-2"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="product-q" className="text-sm font-medium">
            Search
          </label>
          <input
            id="product-q"
            name="q"
            value={draftQ}
            onChange={(event) => {
              setDraftQ(event.target.value);
            }}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="product-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="product-category"
            name="categoryId"
            defaultValue={categoryId}
            className="rounded border border-stone-400 bg-white px-3 py-2"
          >
            <option value="">Any category</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="product-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="product-status"
            name="status"
            defaultValue={status}
            className="rounded border border-stone-400 bg-white px-3 py-2"
          >
            <option value="">Active and inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
        <label htmlFor="product-low" className="flex items-center gap-2 text-sm">
          <input id="product-low" name="lowStock" type="checkbox" defaultChecked={lowStock} />
          Low stock (5 or fewer)
        </label>
        <button type="submit" className="w-fit rounded bg-stone-900 px-4 py-2 text-white">
          Apply
        </button>
      </form>
      {products.isLoading ? <p role="status">Loading products</p> : null}
      {products.isError ? (
        <p role="alert" className="text-red-800">
          Products could not be loaded.
        </p>
      ) : null}
      {products.data && products.data.items.length === 0 ? (
        <p role="status">No products match.</p>
      ) : null}
      {products.data && products.data.items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {products.data.items.map((product) => (
            <li key={product.id} className="rounded border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <p className="text-sm text-stone-700">
                {product.sku} · {formatInr(product.pricePaise)} · Stock {product.stock} ·{' '}
                {product.deletedAt ? 'Deleted' : product.isActive ? 'Active' : 'Inactive'}
              </p>
              <div className="mt-2 flex gap-3">
                <Link
                  className="underline-offset-4 hover:underline"
                  to={`/admin/products/${product.id}/edit`}
                  aria-label={`Edit ${product.name}`}
                >
                  Edit
                </Link>
                {product.deletedAt ? null : (
                  <button
                    type="button"
                    className="underline-offset-4 hover:underline"
                    aria-label={`Delete ${product.name}`}
                    onClick={() => {
                      setDeleteId(product.id);
                      setDeleteName(product.name);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {products.data ? (
        <Pagination
          page={products.data.page}
          pageSize={products.data.pageSize}
          total={products.data.total}
          onPage={(nextPage) => {
            const next = new URLSearchParams(params);
            next.set('page', String(nextPage));
            setParams(next);
          }}
        />
      ) : null}
      {deleteId ? (
        <ConfirmDialog
          title={`Delete ${deleteName}?`}
          message="The product leaves the storefront. Orders keep the price that was paid."
          confirmLabel="Delete"
          pending={pending}
          onCancel={() => {
            setDeleteId(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </div>
  );
}
