import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { createProductBodySchema } from '@qc/shared';
import { ApiError } from '../../api/client.js';
import { fieldErrors } from '../../auth/messages.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { imageHosts } from '../../catalog/image.js';
import { paiseToRupeeInput, rupeesToPaise } from '../../catalog/money.js';
import { CATALOG_STALE_TIME_MS } from '../../catalog/stale.js';

export function ProductFormPage() {
  const { id } = useParams();
  const creating = id === undefined;
  const { api } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['categories', 'admin'],
    queryFn: () => api.listAdminCategories(true),
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const existing = useQuery({
    queryKey: ['admin-product', id],
    enabled: id !== undefined,
    queryFn: () => api.getAdminProduct(id ?? ''),
    staleTime: CATALOG_STALE_TIME_MS,
  });

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [slug, setSlug] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [stock, setStock] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(creating);

  useEffect(() => {
    document.title = `${creating ? 'New product' : 'Edit product'} · Quick Commerce`;
  }, [creating]);

  useEffect(() => {
    if (!existing.data || ready) {
      return;
    }
    setName(existing.data.name);
    setSku(existing.data.sku);
    setSlug(existing.data.slug);
    setSubcategoryId(existing.data.subcategoryId);
    setPrice(paiseToRupeeInput(existing.data.pricePaise));
    setUnitLabel(existing.data.unitLabel);
    setStock(String(existing.data.stock));
    setImageUrl(existing.data.imageUrl ?? '');
    setDescription(existing.data.description ?? '');
    setIsActive(existing.data.isActive);
    setReady(true);
  }, [existing.data, ready]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const pricePaise = rupeesToPaise(price);
    const stockValue = stock.trim() === '' ? Number.NaN : Number(stock);
    const parsed = createProductBodySchema(imageHosts()).safeParse({
      name,
      sku,
      subcategoryId,
      pricePaise: pricePaise ?? -1,
      unitLabel,
      stock: stockValue,
      imageUrl: imageUrl.trim() === '' ? null : imageUrl,
      description: description.trim() === '' ? null : description,
      isActive,
      ...(slug.trim() === '' ? {} : { slug: slug.trim() }),
    });
    if (!parsed.success || pricePaise === null || pricePaise === undefined) {
      const next = parsed.success ? {} : fieldErrors(parsed.error.issues);
      if (pricePaise === null || pricePaise === undefined) {
        next.pricePaise = 'Enter a price in rupees';
      }
      setErrors(next);
      setFormError(null);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      if (creating) {
        await api.createProduct(parsed.data);
      } else if (id) {
        await api.updateProduct(id, parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      void navigate('/admin/products');
    } catch (error: unknown) {
      setPending(false);
      setFormError(error instanceof ApiError ? error.message : 'Could not save the product');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{creating ? 'New product' : 'Edit product'}</h1>
      {!creating && existing.isLoading ? <p role="status">Loading product</p> : null}
      {!creating && existing.isError ? (
        <p role="alert" className="text-red-800">
          That product could not be loaded.
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-red-800">
          {formError}
        </p>
      ) : null}
      {creating || ready ? (
        <form onSubmit={(event) => void onSubmit(event)} className="flex max-w-xl flex-col gap-3">
          <label htmlFor="product-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="product-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            aria-invalid={errors.name ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.name ? <p className="text-sm text-red-800">{errors.name}</p> : null}
          <label htmlFor="product-sku" className="text-sm font-medium">
            SKU
          </label>
          <input
            id="product-sku"
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
            }}
            aria-invalid={errors.sku ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.sku ? <p className="text-sm text-red-800">{errors.sku}</p> : null}
          <label htmlFor="product-slug" className="text-sm font-medium">
            Address
          </label>
          <input
            id="product-slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
            }}
            aria-invalid={errors.slug ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          <p className="text-sm text-stone-700">Leave blank to build it from the name.</p>
          {errors.slug ? <p className="text-sm text-red-800">{errors.slug}</p> : null}
          <label htmlFor="product-subcategory" className="text-sm font-medium">
            Subcategory
          </label>
          <select
            id="product-subcategory"
            value={subcategoryId}
            onChange={(event) => {
              setSubcategoryId(event.target.value);
            }}
            aria-invalid={errors.subcategoryId ? true : undefined}
            className="rounded border border-stone-400 bg-white px-3 py-2"
          >
            <option value="">Choose a subcategory</option>
            {categories.data?.map((category) => (
              <optgroup key={category.id} label={category.name}>
                {category.subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.subcategoryId ? (
            <p className="text-sm text-red-800">{errors.subcategoryId}</p>
          ) : null}
          <label htmlFor="product-price" className="text-sm font-medium">
            Price (₹)
          </label>
          <input
            id="product-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
            }}
            aria-invalid={errors.pricePaise ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.pricePaise ? <p className="text-sm text-red-800">{errors.pricePaise}</p> : null}
          <label htmlFor="product-unit" className="text-sm font-medium">
            Unit
          </label>
          <input
            id="product-unit"
            value={unitLabel}
            onChange={(event) => {
              setUnitLabel(event.target.value);
            }}
            aria-invalid={errors.unitLabel ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.unitLabel ? <p className="text-sm text-red-800">{errors.unitLabel}</p> : null}
          <label htmlFor="product-stock" className="text-sm font-medium">
            Stock
          </label>
          <input
            id="product-stock"
            inputMode="numeric"
            value={stock}
            onChange={(event) => {
              setStock(event.target.value);
            }}
            aria-invalid={errors.stock ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.stock ? <p className="text-sm text-red-800">{errors.stock}</p> : null}
          <label htmlFor="product-image" className="text-sm font-medium">
            Image URL
          </label>
          <input
            id="product-image"
            value={imageUrl}
            onChange={(event) => {
              setImageUrl(event.target.value);
            }}
            aria-invalid={errors.imageUrl ? true : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
          {errors.imageUrl ? <p className="text-sm text-red-800">{errors.imageUrl}</p> : null}
          <label htmlFor="product-description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="product-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="rounded border border-stone-400 px-3 py-2"
          />
          <label htmlFor="product-active" className="flex items-center gap-2 text-sm">
            <input
              id="product-active"
              type="checkbox"
              checked={isActive}
              onChange={(event) => {
                setIsActive(event.target.checked);
              }}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded bg-stone-900 px-4 py-2 text-white"
          >
            {creating ? 'Create product' : 'Save product'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
