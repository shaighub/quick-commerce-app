import type { ProductSort } from '@qc/shared';

export type SearchMode = 'browse' | 'fulltext' | 'trigram';

export interface CatalogRef {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogProduct {
  id: string;
  subcategoryId: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  unitLabel: string;
  pricePaise: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: CatalogRef;
  subcategory: CatalogRef;
}

export interface ProductQuery {
  q?: string;
  mode: SearchMode;
  categoryId?: string;
  subcategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort: ProductSort;
  page: number;
  pageSize: number;
  audience: 'public' | 'admin';
  status?: 'active' | 'inactive' | 'deleted';
  lowStock?: boolean;
}

export interface CategoryWrite {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryPatch {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SubcategoryWrite {
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SubcategoryPatch {
  categoryId?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProductWrite {
  subcategoryId: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  unitLabel: string;
  pricePaise: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ProductPatch {
  subcategoryId?: string;
  name?: string;
  slug?: string;
  sku?: string;
  description?: string | null;
  unitLabel?: string;
  pricePaise?: number;
  stock?: number;
  imageUrl?: string | null;
  isActive?: boolean;
}
