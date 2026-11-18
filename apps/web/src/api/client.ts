import { errorResponseSchema, healthResponseSchema, type HealthResponse } from '@qc/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;

  constructor(status: number, code: string, message: string, requestId: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/v1';
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? (() => crypto.randomUUID());

  async function request<T>(path: string, parse: (value: unknown) => T): Promise<T> {
    const id = requestId();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: {
        accept: 'application/json',
        'x-request-id': id,
      },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.requestId,
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
      return request('/health', (value) => healthResponseSchema.parse(value));
    },
  };
}
