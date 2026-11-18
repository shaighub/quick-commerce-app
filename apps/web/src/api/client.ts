import {
  accessTokenResponseSchema,
  adminCategoryListSchema,
  adminOrderDetailSchema,
  adminOrderListSchema,
  adminProductListResponseSchema,
  adminProductResponseSchema,
  authSessionSchema,
  cartSchema,
  categoryResponseSchema,
  customerOrderListSchema,
  customerOrderResponseSchema,
  dashboardSchema,
  errorResponseSchema,
  healthResponseSchema,
  meResponseSchema,
  productDetailResponseSchema,
  productListResponseSchema,
  publicCategoryListSchema,
  serviceabilityResponseSchema,
  subcategoryResponseSchema,
  type AdminCategory,
  type AdminOrderDetail,
  type AdminOrderList,
  type AdminProduct,
  type AdminProductListResponse,
  type AdminSubcategory,
  type AuthSession,
  type Cart,
  type CheckoutInput,
  type CustomerOrder,
  type CustomerOrderList,
  type Dashboard,
  type HealthResponse,
  type LoginInput,
  type MeResponse,
  type ProductDetail,
  type ProductListResponse,
  type PublicCategory,
  type ServiceabilityResponse,
  type SignupInput,
} from '@qc/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: unknown[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    details?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
  getAccessToken?: () => string | null;
  /** Called once after a 401 on an authenticated request. Return null to stop. */
  refreshAccessToken?: () => Promise<string | null>;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  authenticate?: boolean;
  csrf?: boolean;
  retry?: boolean;
  headers?: Record<string, string>;
}

export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '/v1';
}

function withQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === '' ? path : `${path}?${text}`;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? apiBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? (() => crypto.randomUUID());

  async function request<T>(
    path: string,
    init: RequestOptions,
    parse: (value: unknown) => T,
  ): Promise<T> {
    const id = requestId();
    const headers = new Headers();
    headers.set('accept', 'application/json');
    headers.set('x-request-id', id);
    if (init.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (init.csrf) {
      headers.set('x-requested-with', 'XMLHttpRequest');
    }
    if (init.headers) {
      for (const [name, value] of Object.entries(init.headers)) {
        headers.set(name, value);
      }
    }
    if (init.authenticate) {
      const token = options.getAccessToken?.() ?? null;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'include',
    });

    if (
      response.status === 401 &&
      init.authenticate === true &&
      init.retry !== true &&
      options.refreshAccessToken
    ) {
      const nextToken = await options.refreshAccessToken();
      if (nextToken) {
        return request(path, { ...init, retry: true }, parse);
      }
    }

    if (response.status === 204) {
      return parse(undefined);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.requestId,
          parsed.data.error.details,
        );
      }
      throw new ApiError(
        response.status,
        'INTERNAL_ERROR',
        response.statusText || 'Request failed',
        id,
      );
    }
    return parse(payload);
  }

  return {
    getHealth(): Promise<HealthResponse> {
      return request('/health', {}, (value) => healthResponseSchema.parse(value));
    },
    signup(input: SignupInput): Promise<AuthSession> {
      return request('/auth/signup', { method: 'POST', body: input }, (value) =>
        authSessionSchema.parse(value),
      );
    },
    login(input: LoginInput): Promise<AuthSession> {
      return request('/auth/login', { method: 'POST', body: input }, (value) =>
        authSessionSchema.parse(value),
      );
    },
    /**
     * Cookie refresh. Does not send the bearer token and does not retry, so the
     * auth provider can call it from the 401 handler without looping.
     */
    refreshSession(): Promise<string | null> {
      return request(
        '/auth/refresh',
        { method: 'POST', csrf: true },
        (value) => accessTokenResponseSchema.parse(value).accessToken,
      ).catch(() => null);
    },
    logout(): Promise<void> {
      return request('/auth/logout', { method: 'POST', csrf: true }, () => undefined);
    },
    logoutAll(): Promise<void> {
      return request(
        '/auth/logout-all',
        { method: 'POST', csrf: true, authenticate: true },
        () => undefined,
      );
    },
    me(): Promise<MeResponse> {
      return request('/auth/me', { authenticate: true }, (value) => meResponseSchema.parse(value));
    },
    listCategories(): Promise<PublicCategory[]> {
      return request('/categories', {}, (value) => publicCategoryListSchema.parse(value));
    },
    listProducts(
      query: Record<string, string | number | boolean | undefined>,
    ): Promise<ProductListResponse> {
      return request(withQuery('/products', query), {}, (value) =>
        productListResponseSchema.parse(value),
      );
    },
    getProduct(slug: string): Promise<ProductDetail> {
      return request(
        `/products/${encodeURIComponent(slug)}`,
        {},
        (value) => productDetailResponseSchema.parse(value).product,
      );
    },
    checkServiceability(pincode: string): Promise<ServiceabilityResponse> {
      return request(withQuery('/serviceability', { pincode }), {}, (value) =>
        serviceabilityResponseSchema.parse(value),
      );
    },
    listAdminCategories(includeInactive: boolean): Promise<AdminCategory[]> {
      return request(
        withQuery('/admin/categories', { includeInactive: includeInactive ? 'true' : 'false' }),
        { authenticate: true },
        (value) => adminCategoryListSchema.parse(value),
      );
    },
    createCategory(body: unknown): Promise<AdminCategory> {
      return request(
        '/admin/categories',
        { method: 'POST', body, authenticate: true },
        (value) => categoryResponseSchema.parse(value).category,
      );
    },
    updateCategory(id: string, body: unknown): Promise<AdminCategory> {
      return request(
        `/admin/categories/${id}`,
        { method: 'PATCH', body, authenticate: true },
        (value) => categoryResponseSchema.parse(value).category,
      );
    },
    deleteCategory(id: string): Promise<void> {
      return request(
        `/admin/categories/${id}`,
        { method: 'DELETE', authenticate: true },
        () => undefined,
      );
    },
    createSubcategory(categoryId: string, body: unknown): Promise<AdminSubcategory> {
      return request(
        `/admin/categories/${categoryId}/subcategories`,
        { method: 'POST', body, authenticate: true },
        (value) => subcategoryResponseSchema.parse(value).subcategory,
      );
    },
    updateSubcategory(id: string, body: unknown): Promise<AdminSubcategory> {
      return request(
        `/admin/subcategories/${id}`,
        { method: 'PATCH', body, authenticate: true },
        (value) => subcategoryResponseSchema.parse(value).subcategory,
      );
    },
    deleteSubcategory(id: string): Promise<void> {
      return request(
        `/admin/subcategories/${id}`,
        { method: 'DELETE', authenticate: true },
        () => undefined,
      );
    },
    listAdminProducts(
      query: Record<string, string | number | boolean | undefined>,
    ): Promise<AdminProductListResponse> {
      return request(withQuery('/admin/products', query), { authenticate: true }, (value) =>
        adminProductListResponseSchema.parse(value),
      );
    },
    getAdminProduct(id: string): Promise<AdminProduct> {
      return request(
        `/admin/products/${id}`,
        { authenticate: true },
        (value) => adminProductResponseSchema.parse(value).product,
      );
    },
    createProduct(body: unknown): Promise<AdminProduct> {
      return request(
        '/admin/products',
        { method: 'POST', body, authenticate: true },
        (value) => adminProductResponseSchema.parse(value).product,
      );
    },
    updateProduct(id: string, body: unknown): Promise<AdminProduct> {
      return request(
        `/admin/products/${id}`,
        { method: 'PATCH', body, authenticate: true },
        (value) => adminProductResponseSchema.parse(value).product,
      );
    },
    deleteProduct(id: string): Promise<void> {
      return request(
        `/admin/products/${id}`,
        { method: 'DELETE', authenticate: true },
        () => undefined,
      );
    },
    getCart(): Promise<Cart> {
      return request('/cart', { authenticate: true }, (value) => cartSchema.parse(value));
    },
    addCartItem(body: { productId: string; quantity: number }): Promise<Cart> {
      return request('/cart/items', { method: 'POST', body, authenticate: true }, (value) =>
        cartSchema.parse(value),
      );
    },
    updateCartItem(itemId: string, quantity: number): Promise<Cart> {
      return request(
        `/cart/items/${itemId}`,
        { method: 'PATCH', body: { quantity }, authenticate: true },
        (value) => cartSchema.parse(value),
      );
    },
    removeCartItem(itemId: string): Promise<Cart> {
      return request(`/cart/items/${itemId}`, { method: 'DELETE', authenticate: true }, (value) =>
        cartSchema.parse(value),
      );
    },
    clearCart(): Promise<void> {
      return request('/cart', { method: 'DELETE', authenticate: true }, () => undefined);
    },
    checkout(body: CheckoutInput, idempotencyKey: string): Promise<CustomerOrder> {
      return request(
        '/orders/checkout',
        {
          method: 'POST',
          body,
          authenticate: true,
          headers: { 'idempotency-key': idempotencyKey },
        },
        (value) => customerOrderResponseSchema.parse(value).order,
      );
    },
    listOrders(page = 1): Promise<CustomerOrderList> {
      return request(withQuery('/orders', { page }), { authenticate: true }, (value) =>
        customerOrderListSchema.parse(value),
      );
    },
    getOrder(orderNumber: string): Promise<CustomerOrder> {
      return request(
        `/orders/${encodeURIComponent(orderNumber)}`,
        { authenticate: true },
        (value) => customerOrderResponseSchema.parse(value).order,
      );
    },
    listAdminOrders(
      query: Record<string, string | number | boolean | undefined>,
    ): Promise<AdminOrderList> {
      return request(withQuery('/admin/orders', query), { authenticate: true }, (value) =>
        adminOrderListSchema.parse(value),
      );
    },
    getAdminOrder(orderNumber: string): Promise<AdminOrderDetail> {
      return request(
        `/admin/orders/${encodeURIComponent(orderNumber)}`,
        { authenticate: true },
        (value) => adminOrderDetailSchema.parse(value),
      );
    },
    updateOrderStatus(
      orderNumber: string,
      body: { status: string; note?: string },
    ): Promise<AdminOrderDetail> {
      return request(
        `/admin/orders/${encodeURIComponent(orderNumber)}/status`,
        { method: 'PATCH', body, authenticate: true },
        (value) => adminOrderDetailSchema.parse(value),
      );
    },
    dashboard(): Promise<Dashboard> {
      return request('/admin/dashboard', { authenticate: true }, (value) =>
        dashboardSchema.parse(value),
      );
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
