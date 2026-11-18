import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/api/client.js';

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
