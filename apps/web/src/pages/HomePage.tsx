import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { rupeesToPaise, formatInr } from '../catalog/money.js';
import { filtersToSearch, readFilters } from '../catalog/params.js';
import { CATALOG_STALE_TIME_MS } from '../catalog/stale.js';
import { AddToCart } from '../components/catalog/AddToCart.js';
import { CategoryRail } from '../components/catalog/CategoryRail.js';
import { FilterPanel } from '../components/catalog/FilterPanel.js';
import { Pagination } from '../components/catalog/Pagination.js';
import { PincodeBanner } from '../components/catalog/PincodeBanner.js';
import { ProductImage } from '../components/catalog/ProductImage.js';
import { StockBadge } from '../components/catalog/StockBadge.js';

function catalogPath(search: string): string {
  return search === '' ? '/' : `/search?${search}`;
}

export function HomePage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const filters = readFilters(params);
  const [draftQuery, setDraftQuery] = useState(filters.q);
  useEffect(() => {
    setDraftQuery(filters.q);
  }, [filters.q]);
  const categories = useQuery({
    queryKey: ['categories', 'public'],
    queryFn: () => api.listCategories(),
    staleTime: CATALOG_STALE_TIME_MS,
  });

  const category = categories.data?.find((item) => item.slug === filters.category);
  const subcategory = category?.subcategories.find((item) => item.slug === filters.sub);
  const minPaise = rupeesToPaise(filters.min);
  const maxPaise = rupeesToPaise(filters.max);
  const priceError = minPaise === null || maxPaise === null;
  const unknownCategory = filters.category !== '' && categories.data !== undefined && !category;
  const unknownSubcategory =
    filters.sub !== '' && category !== undefined && subcategory === undefined;

  const products = useQuery({
    queryKey: ['products', filters],
    enabled: categories.isSuccess && !priceError && !unknownCategory && !unknownSubcategory,
    staleTime: CATALOG_STALE_TIME_MS,
    queryFn: () =>
      api.listProducts({
        q: filters.q || undefined,
        categoryId: category?.id,
        subcategoryId: subcategory?.id,
        minPrice: minPaise ?? undefined,
        maxPrice: maxPaise ?? undefined,
        inStock: filters.inStock ? 'true' : undefined,
        sort: filters.sort,
        page: filters.page,
      }),
  });

  const ordered = useMemo(() => categories.data ?? [], [categories.data]);

  function go(next: Partial<typeof filters>, resetPage = true): void {
    const search = filtersToSearch({
      ...filters,
      ...next,
      page: resetPage ? 1 : (next.page ?? filters.page),
    });
    void navigate(catalogPath(search));
  }

  function onSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    go({ q: draftQuery.trim() });
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">Shop</h1>
      <PincodeBanner />
      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        role="search"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="search" className="text-sm font-medium">
            Search products
          </label>
          <input
            id="search"
            name="q"
            value={draftQuery}
            onChange={(event) => {
              setDraftQuery(event.target.value);
            }}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </div>
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-white">
          Search
        </button>
      </form>
      <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-6">
          {categories.isLoading ? <p role="status">Loading categories</p> : null}
          {categories.isError ? (
            <p role="alert" className="text-red-800">
              Categories could not be loaded.
            </p>
          ) : null}
          {categories.data ? (
            <CategoryRail
              categories={ordered}
              categorySlug={filters.category}
              subcategorySlug={filters.sub}
              onCategory={(slug) => {
                go({ category: slug, sub: '' });
              }}
              onSubcategory={(categorySlug, subcategorySlug) => {
                go({ category: categorySlug, sub: subcategorySlug });
              }}
            />
          ) : null}
          <FilterPanel
            key={`${filters.min}|${filters.max}|${filters.inStock}|${filters.sort}`}
            min={filters.min}
            max={filters.max}
            inStock={filters.inStock}
            sort={filters.sort}
            onApply={(next) => {
              go(next);
            }}
            onClear={() => {
              void navigate('/');
            }}
          />
        </div>
        <section aria-label="Products">
          {unknownCategory || unknownSubcategory ? (
            <p role="status">That category is not available.</p>
          ) : null}
          {priceError ? (
            <p role="alert" className="text-red-800">
              Those prices are not valid rupee amounts.
            </p>
          ) : null}
          {products.isLoading ? <p role="status">Loading products</p> : null}
          {products.isError ? (
            <p role="alert" className="text-red-800">
              Products could not be loaded.
            </p>
          ) : null}
          {products.data && products.data.items.length === 0 ? (
            <p role="status">
              {filters.q !== ''
                ? `No results for "${filters.q}".`
                : 'No products match these filters.'}
            </p>
          ) : null}
          {products.data && products.data.items.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-stone-700">{products.data.total} products</p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {products.data.items.map((product) => (
                  <li key={product.id} className="rounded border border-stone-200 bg-white">
                    <Link to={`/p/${product.slug}`}>
                      <ProductImage name={product.name} imageUrl={product.imageUrl} />
                    </Link>
                    <div className="flex flex-col gap-2 p-4">
                      <h2 className="text-lg font-semibold">
                        <Link
                          className="underline-offset-4 hover:underline"
                          to={`/p/${product.slug}`}
                        >
                          {product.name}
                        </Link>
                      </h2>
                      <p className="text-sm text-stone-700">{product.unitLabel}</p>
                      <p>{formatInr(product.pricePaise)}</p>
                      <StockBadge status={product.stockStatus} />
                      <AddToCart available={product.stockStatus !== 'OUT_OF_STOCK'} />
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                page={products.data.page}
                pageSize={products.data.pageSize}
                total={products.data.total}
                onPage={(page) => {
                  go({ page }, false);
                }}
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
