import type { PrismaClient } from '../generated/prisma/client.js';
import { createCatalogCache, type CatalogCache } from '../lib/catalog-cache.js';
import {
  createCatalogController,
  type CatalogController,
} from '../controllers/catalog.controller.js';
import {
  createServiceabilityController,
  type ServiceabilityController,
} from '../controllers/serviceability.controller.js';
import { createCategoryRepository } from '../repositories/category.repository.js';
import { createProductRepository } from '../repositories/product.repository.js';
import { createCatalogService, type CatalogService } from '../services/catalog.service.js';
import { createSearchService } from '../services/search.service.js';
import { createServiceabilityService } from '../services/serviceability.service.js';

export interface CatalogModule {
  catalog: CatalogService;
  cache: CatalogCache;
  controller: CatalogController;
  serviceability: ServiceabilityController;
}

export function createCatalogModule(deps: {
  prisma: PrismaClient;
  imageHosts: readonly string[];
  serviceablePincodes: readonly string[];
  deliveryFeePaise: number;
  cache?: CatalogCache;
  now?: () => Date;
}): CatalogModule {
  const cache = deps.cache ?? createCatalogCache();
  const categories = createCategoryRepository(deps.prisma);
  const products = createProductRepository(deps.prisma);
  const search = createSearchService(products);
  const catalog = createCatalogService({
    categories,
    products,
    search,
    cache,
    ...(deps.now ? { now: deps.now } : {}),
  });
  return {
    catalog,
    cache,
    controller: createCatalogController({
      catalog,
      cache,
      imageHosts: deps.imageHosts,
    }),
    serviceability: createServiceabilityController({
      serviceability: createServiceabilityService({
        pincodes: deps.serviceablePincodes,
        deliveryFeePaise: deps.deliveryFeePaise,
      }),
    }),
  };
}
