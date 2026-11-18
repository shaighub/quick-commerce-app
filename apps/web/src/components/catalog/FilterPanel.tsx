import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ProductSort } from '@qc/shared';
import { rupeesToPaise } from '../../catalog/money.js';

export function FilterPanel({
  min,
  max,
  inStock,
  sort,
  onApply,
  onClear,
}: {
  min: string;
  max: string;
  inStock: boolean;
  sort: ProductSort;
  onApply: (next: { min: string; max: string; inStock: boolean; sort: ProductSort }) => void;
  onClear: () => void;
}) {
  const [minPrice, setMinPrice] = useState(min);
  const [maxPrice, setMaxPrice] = useState(max);
  const [stockOnly, setStockOnly] = useState(inStock);
  const [sortBy, setSortBy] = useState<ProductSort>(sort);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const minPaise = rupeesToPaise(minPrice);
    const maxPaise = rupeesToPaise(maxPrice);
    if (minPaise === null || maxPaise === null) {
      setError('Enter prices in rupees, with at most two decimal places.');
      return;
    }
    if (minPaise !== undefined && maxPaise !== undefined && minPaise > maxPaise) {
      setError('Minimum price cannot be above the maximum.');
      return;
    }
    setError(null);
    onApply({ min: minPrice.trim(), max: maxPrice.trim(), inStock: stockOnly, sort: sortBy });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded border border-stone-200 bg-white p-4"
    >
      <h2 className="text-lg font-semibold">Filters</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="min-price" className="text-sm font-medium">
          Minimum price (₹)
        </label>
        <input
          id="min-price"
          inputMode="decimal"
          value={minPrice}
          onChange={(event) => {
            setMinPrice(event.target.value);
          }}
          className="rounded border border-stone-400 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="max-price" className="text-sm font-medium">
          Maximum price (₹)
        </label>
        <input
          id="max-price"
          inputMode="decimal"
          value={maxPrice}
          onChange={(event) => {
            setMaxPrice(event.target.value);
          }}
          className="rounded border border-stone-400 px-3 py-2"
        />
      </div>
      <label className="flex items-center gap-2 text-sm" htmlFor="in-stock">
        <input
          id="in-stock"
          type="checkbox"
          checked={stockOnly}
          onChange={(event) => {
            setStockOnly(event.target.checked);
          }}
        />
        In stock only
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="sort" className="text-sm font-medium">
          Sort
        </label>
        <select
          id="sort"
          value={sortBy}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === 'relevance' ||
              value === 'price_asc' ||
              value === 'price_desc' ||
              value === 'newest'
            ) {
              setSortBy(value);
            }
          }}
          className="rounded border border-stone-400 bg-white px-3 py-2"
        >
          <option value="relevance">Relevance</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button type="submit" className="rounded bg-stone-900 px-3 py-2 text-sm text-white">
          Apply filters
        </button>
        <button
          type="button"
          className="text-sm underline-offset-4 hover:underline"
          onClick={onClear}
        >
          Clear all
        </button>
      </div>
    </form>
  );
}
