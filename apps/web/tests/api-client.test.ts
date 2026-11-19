import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/api/client.js';
import { createErrorReporter, setErrorReporter } from '../src/lib/error-reporting.js';

describe('api client', () => {
  it('parses a health response and sends a request id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ status: 'ok', db: 'up', version: '0.1.0' })),
    );
    const client = createApiClient({
      baseUrl: '/v1',
      fetchImpl,
      requestId: () => 'req-web',
    });
    await expect(client.getHealth()).resolves.toEqual({ status: 'ok', db: 'up', version: '0.1.0' });
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('x-request-id')).toBe('req-web');
  });

  it('uses the same-origin /v1 base when none is configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ status: 'ok', db: 'up', version: '0.1.0' })),
    );
    const client = createApiClient({ fetchImpl, requestId: () => 'req-default' });
    await client.getHealth();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/v1/health');
  });

  it('maps the error envelope', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 'NOT_FOUND', message: 'Missing', requestId: 'req-err' } },
          { status: 404 },
        ),
      ),
    );
    const client = createApiClient({ baseUrl: '/v1', fetchImpl, requestId: () => 'req-web' });
    await expect(client.getHealth()).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'req-err',
    } satisfies Partial<ApiError>);
  });

  it('retries an authenticated call once after refreshing the access token', async () => {
    let token = 'old-token';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 'TOKEN_EXPIRED', message: 'Access token expired', requestId: 'r1' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          user: {
            id: '00000000-0000-4000-8000-000000000010',
            name: 'Asha',
            email: 'asha@example.com',
            role: 'CUSTOMER',
            lastAddress: null,
          },
        }),
      );
    const client = createApiClient({
      baseUrl: '/v1',
      fetchImpl,
      requestId: () => 'req-web',
      getAccessToken: () => token,
      refreshAccessToken: () => {
        token = 'next-token';
        return Promise.resolve(token);
      },
    });
    await expect(client.me()).resolves.toMatchObject({ user: { name: 'Asha' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(fetchImpl.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('authorization')).toBe('Bearer next-token');
  });

  it('does not retry a second time when refresh cannot produce a token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 'TOKEN_INVALID', message: 'Authentication required', requestId: 'r1' } },
          { status: 401 },
        ),
      ),
    );
    const refresh = vi.fn<() => Promise<string | null>>(() => Promise.resolve(null));
    const client = createApiClient({
      baseUrl: '/v1',
      fetchImpl,
      requestId: () => 'req-web',
      getAccessToken: () => 'old-token',
      refreshAccessToken: refresh,
    });
    await expect(client.me()).rejects.toMatchObject({ status: 401, code: 'TOKEN_INVALID' });
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends the CSRF header on logout and returns null when refresh fails', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('nope', { status: 401 }));
    const client = createApiClient({ baseUrl: '/v1', fetchImpl, requestId: () => 'req-web' });
    await expect(client.logout()).resolves.toBeUndefined();
    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-requested-with')).toBe('XMLHttpRequest');
    await expect(client.refreshSession()).resolves.toBeNull();
  });

  it('reports a 500 with the response request id', async () => {
    const captured: Array<{ message: string; requestId: string }> = [];
    setErrorReporter({
      capture(error, requestId) {
        captured.push({
          message: error instanceof Error ? error.message : '',
          requestId,
        });
      },
    });
    try {
      const fetchImpl = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Something went wrong',
                requestId: 'req-500',
              },
            },
            { status: 500 },
          ),
        ),
      );
      const client = createApiClient({ baseUrl: '/v1', fetchImpl, requestId: () => 'req-web' });
      await expect(client.getHealth()).rejects.toMatchObject({ status: 500, requestId: 'req-500' });
      expect(captured).toEqual([{ message: 'Something went wrong', requestId: 'req-500' }]);
    } finally {
      setErrorReporter(createErrorReporter({ dsn: undefined }));
    }
  });

  it('uses a generic error when the body is not the error envelope', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('nope', { status: 502, statusText: 'Bad Gateway' })),
    );
    const client = createApiClient({ baseUrl: '/v1', fetchImpl, requestId: () => 'req-web' });
    await expect(client.getHealth()).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
      message: 'Bad Gateway',
      requestId: 'req-web',
    });
  });
});
