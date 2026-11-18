import type { ProductSort } from '@qc/shared';

export interface StorefrontFilters {
  q: string;
  category: string;
  sub: string;
  min: string;
  max: string;
  inStock: boolean;
  sort: ProductSort;
  page: number;
}

const sorts: readonly ProductSort[] = ['relevance', 'price_asc', 'price_desc', 'newest'];

function isSort(value: string | null): value is ProductSort {
  return sorts.some((sort) => sort === value);
}

export function readFilters(params: URLSearchParams): StorefrontFilters {
  const page = Number(params.get('page') ?? '1');
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    sub: params.get('sub') ?? '',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    inStock: params.get('inStock') === 'true',
    sort: isSort(sort) ? sort : 'relevance',
    page: Number.isInteger(page) && page >= 1 && page <= 20 ? page : 1,
  };
}

export function filtersToSearch(filters: StorefrontFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') {
    params.set('q', filters.q);
  }
  if (filters.category !== '') {
    params.set('category', filters.category);
  }
  if (filters.sub !== '') {
    params.set('sub', filters.sub);
  }
  if (filters.min !== '') {
    params.set('min', filters.min);
  }
  if (filters.max !== '') {
    params.set('max', filters.max);
  }
  if (filters.inStock) {
    params.set('inStock', 'true');
  }
  if (filters.sort !== 'relevance') {
    params.set('sort', filters.sort);
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  return params.toString();
}
