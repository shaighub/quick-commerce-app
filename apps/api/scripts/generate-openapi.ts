import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accessTokenResponseSchema,
  adminCategoryListSchema,
  adminProductListResponseSchema,
  adminProductResponseSchema,
  authSessionSchema,
  categoryResponseSchema,
  createCategoryBodySchema,
  createProductBodySchema,
  createSubcategoryBodySchema,
  errorResponseSchema,
  healthResponseSchema,
  loginSchema,
  meResponseSchema,
  productDetailResponseSchema,
  productListResponseSchema,
  publicCategoryListSchema,
  serviceabilityResponseSchema,
  signupSchema,
  subcategoryResponseSchema,
  updateCategoryBodySchema,
  updateProductBodySchema,
  updateSubcategoryBodySchema,
} from '@qc/shared';
import { stringify } from 'yaml';
import { z } from 'zod';

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const document = z.toJSONSchema(schema) as Record<string, unknown>;
  delete document.$schema;
  return document;
}

const errorContent = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
};

function errorResponse(description: string) {
  return { description, content: errorContent };
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Quick Commerce API',
    version: '0.1.0',
    description:
      'Auth, catalog, serviceability, health, and the shared error contract. Schemas are generated from packages/shared. Later milestones add cart and orders.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Auth' }, { name: 'Catalog' }, { name: 'Serviceability' }, { name: 'System' }],
  paths: {
    '/v1/auth/signup': {
      post: {
        operationId: 'signup',
        summary: 'Create a customer account and sign in',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Customer created. Sets the qc_rt refresh cookie.',
            headers: {
              'Set-Cookie': {
                description:
                  'qc_rt refresh token. HttpOnly, Secure, SameSite=Strict, Path=/v1/auth.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSession' } },
            },
          },
          '400': errorResponse('Request body is not valid JSON'),
          '409': errorResponse('EMAIL_TAKEN'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/login': {
      post: {
        operationId: 'login',
        summary: 'Log in with email and password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Signed in. Sets the qc_rt refresh cookie.',
            headers: {
              'Set-Cookie': {
                description:
                  'qc_rt refresh token. HttpOnly, Secure, SameSite=Strict, Path=/v1/auth.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSession' } },
            },
          },
          '400': errorResponse('Request body is not valid JSON'),
          '401': errorResponse('INVALID_CREDENTIALS'),
          '422': errorResponse('VALIDATION'),
          '423': errorResponse('ACCOUNT_LOCKED. details[0].retryAfter is seconds.'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/refresh': {
      post: {
        operationId: 'refresh',
        summary: 'Rotate the refresh cookie and issue a new access token',
        tags: ['Auth'],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
          { in: 'cookie', name: 'qc_rt', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Access token issued and qc_rt rotated.',
            headers: {
              'Set-Cookie': {
                description: 'Replacement qc_rt cookie.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AccessTokenResponse' } },
            },
          },
          '401': errorResponse('TOKEN_INVALID'),
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        operationId: 'logout',
        summary: 'Revoke the current refresh token and clear the cookie',
        tags: ['Auth'],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
          { in: 'cookie', name: 'qc_rt', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '204': { description: 'Refresh token revoked and cookie cleared.' },
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/logout-all': {
      post: {
        operationId: 'logoutAll',
        summary: 'Revoke every session for the current user',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': {
            description:
              'users.token_version incremented, every refresh token revoked, cookie cleared.',
          },
          '401': errorResponse('UNAUTHORIZED or TOKEN_INVALID'),
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/me': {
      get: {
        operationId: 'me',
        summary: 'Current user and the latest delivery address',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile. lastAddress is null until the user has placed an order.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED, TOKEN_INVALID, or TOKEN_EXPIRED'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/categories': {
      get: {
        operationId: 'listCategories',
        summary: 'Active categories and their active subcategories',
        tags: ['Catalog'],
        responses: {
          '200': {
            description: 'Active rows in sort order. Cached for 60 seconds.',
            headers: {
              'Cache-Control': { schema: { type: 'string' } },
              ETag: { schema: { type: 'string' } },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PublicCategoryList' } },
            },
          },
          '304': { description: 'Not modified' },
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/categories': {
      get: {
        operationId: 'listAdminCategories',
        summary: 'Admin category list',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'includeInactive',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
        ],
        responses: {
          '200': {
            description: 'Non-deleted categories with counts',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminCategoryList' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
      post: {
        operationId: 'createCategory',
        summary: 'Create a category',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateCategory' } },
          },
        },
        responses: {
          '201': {
            description: 'Category created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CategoryResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '409': errorResponse('NAME_TAKEN'),
          '422': errorResponse('VALIDATION or IMAGE_HOST_NOT_ALLOWED'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/categories/{id}': {
      patch: {
        operationId: 'updateCategory',
        summary: 'Update a category',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateCategory' } },
          },
        },
        responses: {
          '200': {
            description: 'Category updated. The slug assigned at create does not change.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CategoryResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('NAME_TAKEN'),
          '422': errorResponse('VALIDATION or IMAGE_HOST_NOT_ALLOWED'),
        },
      },
      delete: {
        operationId: 'deleteCategory',
        summary: 'Soft-delete an empty category',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Soft-deleted' },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('CATEGORY_NOT_EMPTY'),
        },
      },
    },
    '/v1/admin/categories/{id}/subcategories': {
      post: {
        operationId: 'createSubcategory',
        summary: 'Add a subcategory',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateSubcategory' } },
          },
        },
        responses: {
          '201': {
            description: 'Subcategory created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SubcategoryResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('NAME_TAKEN'),
          '422': errorResponse('VALIDATION'),
        },
      },
    },
    '/v1/admin/subcategories/{id}': {
      patch: {
        operationId: 'updateSubcategory',
        summary: 'Update or move a subcategory',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateSubcategory' } },
          },
        },
        responses: {
          '200': {
            description: 'Subcategory updated. Products stay on this subcategory.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SubcategoryResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('NAME_TAKEN'),
          '422': errorResponse('VALIDATION'),
        },
      },
      delete: {
        operationId: 'deleteSubcategory',
        summary: 'Soft-delete an empty subcategory',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Soft-deleted' },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('SUBCATEGORY_NOT_EMPTY'),
        },
      },
    },
    '/v1/products': {
      get: {
        operationId: 'listProducts',
        summary: 'Search and list active products',
        tags: ['Catalog'],
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'categoryId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'subcategoryId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'minPrice', schema: { type: 'integer' }, description: 'Paise' },
          { in: 'query', name: 'maxPrice', schema: { type: 'integer' }, description: 'Paise' },
          { in: 'query', name: 'inStock', schema: { type: 'string', enum: ['true', 'false'] } },
          {
            in: 'query',
            name: 'sort',
            schema: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc', 'newest'] },
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
          },
          {
            in: 'query',
            name: 'pageSize',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 24 },
          },
        ],
        responses: {
          '200': {
            description: 'Page of product cards. total is capped at 1000.',
            headers: {
              'Cache-Control': { schema: { type: 'string' } },
              ETag: { schema: { type: 'string' } },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } },
            },
          },
          '304': { description: 'Not modified' },
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/products/{slug}': {
      get: {
        operationId: 'getProduct',
        summary: 'Active product detail',
        tags: ['Catalog'],
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Product, category, subcategory, and stock status',
            headers: {
              'Cache-Control': { schema: { type: 'string' } },
              ETag: { schema: { type: 'string' } },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductDetailResponse' },
              },
            },
          },
          '304': { description: 'Not modified' },
          '404': errorResponse('NOT_FOUND'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/products': {
      get: {
        operationId: 'listAdminProducts',
        summary: 'Admin product list',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'categoryId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'subcategoryId', schema: { type: 'string', format: 'uuid' } },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['active', 'inactive', 'deleted'] },
          },
          { in: 'query', name: 'lowStock', schema: { type: 'string', enum: ['true', 'false'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, maximum: 20 } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        responses: {
          '200': {
            description: 'Products, including inactive or deleted when filtered',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminProductListResponse' },
              },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '422': errorResponse('VALIDATION'),
        },
      },
      post: {
        operationId: 'createProduct',
        summary: 'Create a product',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateProduct' } },
          },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminProductResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('Subcategory not found'),
          '409': errorResponse('SKU_TAKEN or SLUG_TAKEN'),
          '422': errorResponse('VALIDATION or IMAGE_HOST_NOT_ALLOWED'),
        },
      },
    },
    '/v1/admin/products/{id}': {
      get: {
        operationId: 'getAdminProduct',
        summary: 'Admin product detail',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Product, including inactive or deleted',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminProductResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
        },
      },
      patch: {
        operationId: 'updateProduct',
        summary: 'Update a product',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateProduct' } },
          },
        },
        responses: {
          '200': {
            description: 'Product updated. Existing order lines keep their price snapshot.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminProductResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('SKU_TAKEN or SLUG_TAKEN'),
          '422': errorResponse('VALIDATION or IMAGE_HOST_NOT_ALLOWED'),
        },
      },
      delete: {
        operationId: 'deleteProduct',
        summary: 'Soft-delete a product',
        tags: ['Catalog'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': {
            description:
              'Soft-deleted. Hidden from the storefront. Order history keeps its snapshot.',
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
        },
      },
    },
    '/v1/serviceability': {
      get: {
        operationId: 'checkServiceability',
        summary: 'Whether a pincode is in SERVICEABLE_PINCODES',
        tags: ['Serviceability'],
        parameters: [
          {
            in: 'query',
            name: 'pincode',
            required: true,
            schema: { type: 'string', pattern: '^[1-9][0-9]{5}$' },
          },
        ],
        responses: {
          '200': {
            description: 'serviceable is false for a valid pincode outside the allowlist',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ServiceabilityResponse' },
              },
            },
          },
          '422': errorResponse('VALIDATION for a pincode that is not 6 digits'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Database is reachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '503': {
            description: 'Database is not reachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      SignupRequest: jsonSchema(signupSchema),
      LoginRequest: jsonSchema(loginSchema),
      AuthSession: jsonSchema(authSessionSchema),
      AccessTokenResponse: jsonSchema(accessTokenResponseSchema),
      MeResponse: jsonSchema(meResponseSchema),
      HealthResponse: jsonSchema(healthResponseSchema),
      ErrorResponse: jsonSchema(errorResponseSchema),
      PublicCategoryList: jsonSchema(publicCategoryListSchema),
      AdminCategoryList: jsonSchema(adminCategoryListSchema),
      CategoryResponse: jsonSchema(categoryResponseSchema),
      CreateCategory: jsonSchema(createCategoryBodySchema(['images.example.com'])),
      UpdateCategory: jsonSchema(updateCategoryBodySchema(['images.example.com'])),
      CreateSubcategory: jsonSchema(createSubcategoryBodySchema()),
      UpdateSubcategory: jsonSchema(updateSubcategoryBodySchema()),
      SubcategoryResponse: jsonSchema(subcategoryResponseSchema),
      ProductListResponse: jsonSchema(productListResponseSchema),
      ProductDetailResponse: jsonSchema(productDetailResponseSchema),
      AdminProductListResponse: jsonSchema(adminProductListResponseSchema),
      AdminProductResponse: jsonSchema(adminProductResponseSchema),
      CreateProduct: jsonSchema(createProductBodySchema(['images.example.com'])),
      UpdateProduct: jsonSchema(updateProductBodySchema(['images.example.com'])),
      ServiceabilityResponse: jsonSchema(serviceabilityResponseSchema),
    },
  },
};

const header = '# Generated from packages/shared Zod schemas. Do not edit by hand.\n';
const text = `${header}${stringify(spec)}`;
const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi/openapi.yaml');
const check = process.argv.includes('--check');

if (check) {
  const current = readFileSync(specPath, 'utf8');
  if (current !== text) {
    process.stderr.write('openapi.yaml is out of date. Run npm run openapi:generate -w @qc/api\n');
    process.exit(1);
  }
} else {
  writeFileSync(specPath, text);
}
