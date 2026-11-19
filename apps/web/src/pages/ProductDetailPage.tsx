import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { formatInr } from '../catalog/money.js';
import { CATALOG_STALE_TIME_MS } from '../catalog/stale.js';
import { AddToCart } from '../components/catalog/AddToCart.js';
import { Breadcrumb } from '../components/catalog/Breadcrumb.js';
import { ProductImage } from '../components/catalog/ProductImage.js';
import { StockBadge } from '../components/catalog/StockBadge.js';

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { api } = useAuth();
  const product = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.getProduct(slug),
    staleTime: CATALOG_STALE_TIME_MS,
    retry: false,
  });
  useEffect(() => {
    document.title = product.data
      ? `${product.data.name} · Quick Commerce`
      : 'Product · Quick Commerce';
  }, [product.data]);

  const related = useQuery({
    queryKey: ['products', 'related', product.data?.subcategory.id],
    enabled: product.data !== undefined,
    staleTime: CATALOG_STALE_TIME_MS,
    queryFn: () =>
      api.listProducts({
        subcategoryId: product.data?.subcategory.id,
        pageSize: 4,
      }),
  });

  if (product.isLoading) {
    return (
      <>
        <h1 className="text-3xl font-semibold">Product</h1>
        <p role="status">Loading product</p>
      </>
    );
  }

  if (product.isError) {
    const missing = product.error instanceof ApiError && product.error.status === 404;
    return (
      <>
        <h1 className="text-3xl font-semibold">{missing ? 'Product not found' : 'Product'}</h1>
        <p role="alert" className="mt-4 text-red-800">
          {missing ? 'That product is not available.' : 'The product could not be loaded.'}
        </p>
        <p className="mt-4">
          <Link className="underline-offset-4 hover:underline" to="/">
            Back to the shop
          </Link>
        </p>
      </>
    );
  }

  if (!product.data) {
    return null;
  }

  const item = product.data;
  return (
    <article className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: item.category.name, to: `/search?category=${item.category.slug}` },
          {
            label: item.subcategory.name,
            to: `/search?category=${item.category.slug}&sub=${item.subcategory.slug}`,
          },
          { label: item.name },
        ]}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <ProductImage name={item.name} imageUrl={item.imageUrl} />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">{item.name}</h1>
          <p>{item.unitLabel}</p>
          <p className="text-xl">{formatInr(item.pricePaise)}</p>
          <StockBadge status={item.stockStatus} />
          {item.description ? (
            <p className="max-w-prose text-stone-800">{item.description}</p>
          ) : null}
          <AddToCart productId={item.id} available={item.stockStatus !== 'OUT_OF_STOCK'} />
        </div>
      </div>
      {related.data && related.data.items.some((other) => other.id !== item.id) ? (
        <section aria-label="More in this subcategory">
          <h2 className="text-xl font-semibold">More in {item.subcategory.name}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {related.data.items
              .filter((other) => other.id !== item.id)
              .map((other) => (
                <li key={other.id}>
                  <Link className="underline-offset-4 hover:underline" to={`/p/${other.slug}`}>
                    {other.name}
                  </Link>
                  <span className="ml-2 text-sm text-stone-700">{formatInr(other.pricePaise)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
