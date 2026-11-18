import {
  accessTokenResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  healthResponseSchema,
  meResponseSchema,
  type AuthSession,
  type HealthResponse,
  type LoginInput,
  type MeResponse,
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
}

export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '/v1';
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
