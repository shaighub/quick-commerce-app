import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accessTokenResponseSchema,
  addCartItemSchema,
  adminCategoryListSchema,
  adminOrderDetailSchema,
  adminOrderListSchema,
  adminProductListResponseSchema,
  adminProductResponseSchema,
  authSessionSchema,
  cartSchema,
  categoryResponseSchema,
  checkoutSchema,
  createCategoryBodySchema,
  createProductBodySchema,
  createSubcategoryBodySchema,
  customerOrderListSchema,
  customerOrderResponseSchema,
  dashboardSchema,
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
  sweepRequestSchema,
  sweepResponseSchema,
  updateCartItemSchema,
  updateCategoryBodySchema,
  updateOrderStatusSchema,
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
      'Auth, catalog, cart, checkout, orders, serviceability, health, and the shared error contract. Schemas are generated from packages/shared.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth' },
    { name: 'Catalog' },
    { name: 'Cart' },
    { name: 'Orders' },
    { name: 'Serviceability' },
    { name: 'System' },
  ],
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
    '/v1/cart': {
      get: {
        operationId: 'getCart',
        summary: 'Current customer cart with server-side totals',
        tags: ['Cart'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Cart. Unavailable lines are flagged and excluded from the subtotal.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Cart' } } },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
      delete: {
        operationId: 'clearCart',
        summary: 'Remove every line from the cart',
        tags: ['Cart'],
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Cart cleared' },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/cart/items': {
      post: {
        operationId: 'addCartItem',
        summary: 'Add a product or merge it into an existing line',
        tags: ['Cart'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddCartItem' } } },
        },
        responses: {
          '200': {
            description: 'Updated cart',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Cart' } } },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('INSUFFICIENT_STOCK. details include available.'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/cart/items/{itemId}': {
      patch: {
        operationId: 'updateCartItem',
        summary: 'Set a line quantity from 1 to 10',
        tags: ['Cart'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'itemId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateCartItem' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated cart',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Cart' } } },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND when the line belongs to someone else'),
          '409': errorResponse('INSUFFICIENT_STOCK'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
      delete: {
        operationId: 'removeCartItem',
        summary: 'Remove one cart line',
        tags: ['Cart'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'itemId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Updated cart',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Cart' } } },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '404': errorResponse('NOT_FOUND'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/orders/checkout': {
      post: {
        operationId: 'checkout',
        summary: 'Place an order and run the mock payment',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CheckoutRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Order confirmed. The same key and body returns this order again.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CustomerOrderResponse' },
              },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '402': errorResponse('PAYMENT_FAILED. details[0].orderNumber is the failed attempt.'),
          '409': errorResponse(
            'INSUFFICIENT_STOCK or PRICE_CHANGED. PRICE_CHANGED details include the cart.',
          ),
          '422': errorResponse(
            'CART_EMPTY, NOT_SERVICEABLE, IDEMPOTENCY_KEY_REUSED, or VALIDATION',
          ),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/orders': {
      get: {
        operationId: 'listOrders',
        summary: 'The signed-in customer’s orders, newest first',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, maximum: 20 } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        responses: {
          '200': {
            description: 'Own orders only',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CustomerOrderList' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/orders/{orderNumber}': {
      get: {
        operationId: 'getOrder',
        summary: 'One order belonging to the signed-in customer',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'orderNumber', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Order with item snapshots, payment, and status history',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CustomerOrderResponse' },
              },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '404': errorResponse('NOT_FOUND for a missing order or another customer’s order'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/orders': {
      get: {
        operationId: 'listAdminOrders',
        summary: 'All orders, with status, search, and date filters',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'q', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'Admin order list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminOrderList' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/orders/{orderNumber}': {
      get: {
        operationId: 'getAdminOrder',
        summary: 'Any order, plus the statuses an admin may set next',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'orderNumber', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Order, customer, and allowedNextStatuses',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminOrderDetail' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/orders/{orderNumber}/status': {
      patch: {
        operationId: 'updateOrderStatus',
        summary: 'Move an order along an allowed admin transition',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'orderNumber', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateOrderStatus' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated order. Cancelling restocks and refunds the mock payment.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminOrderDetail' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '404': errorResponse('NOT_FOUND'),
          '409': errorResponse('INVALID_TRANSITION'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/admin/dashboard': {
      get: {
        operationId: 'adminDashboard',
        summary: 'Today’s orders, revenue, open orders, low stock, and recent orders',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'IST day totals. Revenue excludes failed, pending, and cancelled orders.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Dashboard' } } },
          },
          '401': errorResponse('UNAUTHORIZED'),
          '403': errorResponse('FORBIDDEN'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/internal/jobs/sweep': {
      post: {
        operationId: 'sweepPendingPayments',
        summary: 'Fail pending-payment orders older than the window and restock them',
        tags: ['System'],
        security: [{ jobsToken: [] }],
        parameters: [
          { in: 'header', name: 'X-Jobs-Token', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SweepRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'How many orders were swept and how many units were restocked',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SweepResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED without a valid X-Jobs-Token'),
          '422': errorResponse('VALIDATION'),
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
      jobsToken: { type: 'apiKey', in: 'header', name: 'X-Jobs-Token' },
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
      Cart: jsonSchema(cartSchema),
      AddCartItem: jsonSchema(addCartItemSchema),
      UpdateCartItem: jsonSchema(updateCartItemSchema),
      CheckoutRequest: jsonSchema(checkoutSchema),
      CustomerOrderResponse: jsonSchema(customerOrderResponseSchema),
      CustomerOrderList: jsonSchema(customerOrderListSchema),
      AdminOrderList: jsonSchema(adminOrderListSchema),
      AdminOrderDetail: jsonSchema(adminOrderDetailSchema),
      UpdateOrderStatus: jsonSchema(updateOrderStatusSchema),
      Dashboard: jsonSchema(dashboardSchema),
      SweepRequest: jsonSchema(sweepRequestSchema),
      SweepResponse: jsonSchema(sweepResponseSchema),
    },
  },
};

const header = '# Generated from packages/shared Zod schemas. Do not edit by hand.\n';
const text = `${header}${stringify(spec, { aliasDuplicateObjects: false })}`;
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
