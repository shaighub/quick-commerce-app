import type { ProductQuery } from '../domain/catalog.js';
import type { ProductRepository } from '../repositories/product.repository.js';

export interface SearchService {
  search(query: Omit<ProductQuery, 'mode'>): Promise<{ total: number; ids: string[] }>;
}

/**
 * Full-text first. Trigram runs only when full-text finds nothing (ADR-007, R08).
 * Without q, relevance falls back to newest inside the repository browse order.
 */
export function createSearchService(products: Pick<ProductRepository, 'query'>): SearchService {
  return {
    async search(query: Omit<ProductQuery, 'mode'>): Promise<{ total: number; ids: string[] }> {
      if (!query.q) {
        return products.query({ ...query, mode: 'browse' });
      }
      const fulltext = await products.query({ ...query, mode: 'fulltext' });
      if (fulltext.total > 0) {
        return fulltext;
      }
      return products.query({ ...query, mode: 'trigram' });
    },
  };
}
