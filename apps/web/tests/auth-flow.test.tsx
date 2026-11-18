import type {} from '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import type { InitialAuth } from '../src/auth/AuthProvider.js';
import { useAuth } from '../src/auth/AuthProvider.js';
import { routes } from '../src/routes.js';

const user = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Asha Rao',
  email: 'asha@example.com',
  role: 'CUSTOMER' as const,
};

const guest: InitialAuth = { status: 'guest' };
const customer: InitialAuth = {
  status: 'authenticated',
  accessToken: 'customer-token',
  user,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function renderAt(path: string, initialAuth?: InitialAuth) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<App router={router} initialAuth={initialAuth} />);
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth screens and guards', () => {
  it('focuses the first invalid signup field and does not call the API', () => {
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/signup', guest);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('associates an invalid phone with its field', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    renderAt('/signup', guest);
    fill('Name', 'Asha Rao');
    fill('Email', 'asha@example.com');
    fill('Password', 'Password1');
    fill('Phone (optional)', '9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Phone (optional)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/E\.164/)).toBeInTheDocument();
  });

  it('signs up, keeps the access token out of storage, and returns to the next page', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ user, accessToken: 'memory-token' })),
    );
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/signup?next=%2Fcart', guest);
    fill('Name', 'Asha Rao');
    fill('Email', 'asha@example.com');
    fill('Password', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cart' })).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain('memory-token');
    expect(JSON.stringify(sessionStorage)).not.toContain('memory-token');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/v1/auth/signup');
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
  });

  it('shows a duplicate-email error and an account-lock message', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 'EMAIL_TAKEN',
              message: 'An account with this email already exists',
              requestId: 'req-1',
            },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Too many failed attempts. Try again later.',
              details: [{ retryAfter: 900 }],
              requestId: 'req-2',
            },
          },
          { status: 423 },
        ),
      );
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/signup', guest);
    fill('Name', 'Asha Rao');
    fill('Email', 'asha@example.com');
    fill('Password', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute('id', 'signup-error');
    });
    cleanup();

    renderAt('/login', guest);
    fill('Email', 'asha@example.com');
    fill('Password', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes');
  });

  it('sends a guest from the cart to log in and blocks a customer from admin', () => {
    renderAt('/cart?from=home', guest);
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Sign up' })
        .some((link) => link.getAttribute('href') === '/signup?next=%2Fcart%3Ffrom%3Dhome'),
    ).toBe(true);

    renderAt('/admin', customer);
    expect(screen.getByRole('heading', { level: 1, name: 'Not allowed' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('sends a signed-in visitor away from log in', () => {
    renderAt('/login?next=%2Forders', customer);
    expect(screen.getByRole('heading', { level: 1, name: 'My orders' })).toBeInTheDocument();
  });

  it('restores a session from the refresh cookie and clears it on logout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(Response.json({ accessToken: 'silent-token' }));
      }
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(Response.json({ user: { ...user, lastAddress: null } }));
      }
      if (url.endsWith('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/categories')) {
        return Promise.resolve(Response.json([]));
      }
      return Promise.resolve(Response.json({ items: [], page: 1, pageSize: 24, total: 0 }));
    });
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/');
    expect(screen.getByText('Checking session')).toBeInTheDocument();
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    const refreshCall = fetchImpl.mock.calls.find((call) =>
      requestUrl(call[0]).endsWith('/auth/refresh'),
    );
    const refreshHeaders = new Headers(refreshCall?.[1]?.headers);
    expect(refreshHeaders.get('x-requested-with')).toBe('XMLHttpRequest');

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    const logoutCall = fetchImpl.mock.calls.find((call) =>
      requestUrl(call[0]).endsWith('/auth/logout'),
    );
    const logoutHeaders = new Headers(logoutCall?.[1]?.headers);
    expect(logoutHeaders.get('x-requested-with')).toBe('XMLHttpRequest');
  });

  it('stays a guest when refresh fails or the profile cannot be loaded', async () => {
    const failed = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 401 })));
    vi.stubGlobal('fetch', failed);
    renderAt('/cart');
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    cleanup();

    const broken = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ nope: true })));
    vi.stubGlobal('fetch', broken);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('logs out of every device with the in-memory bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchImpl);
    renderAt('/', customer);
    fireEvent.click(screen.getByRole('button', { name: 'Log out everywhere' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    const logoutCall = fetchImpl.mock.calls.find((call) =>
      requestUrl(call[0]).endsWith('/auth/logout-all'),
    );
    const headers = new Headers(logoutCall?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer customer-token');
    expect(headers.get('x-requested-with')).toBe('XMLHttpRequest');
    expect(JSON.stringify(localStorage)).not.toContain('customer-token');
  });

  it('shows a header error when logout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          Response.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Could not log out', requestId: 'req' } },
            { status: 500 },
          ),
        ),
      ),
    );
    renderAt('/', customer);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('Could not log out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('maps a server validation error back onto the login fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'VALIDATION',
                message: 'Request validation failed',
                details: [{ path: 'email', message: 'Use a work email' }],
                requestId: 'req',
              },
            },
            { status: 422 },
          ),
        ),
      ),
    );
    renderAt('/login', guest);
    fill('Email', 'asha@example.com');
    fill('Password', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Use a work email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refreshes once when the load effect runs twice', async () => {
    let refreshCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url =
        input instanceof Request ? input.url : input instanceof URL ? input.toString() : input;
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(Response.json({ accessToken: 'silent-token' }));
      }
      return Promise.resolve(Response.json({ user: { ...user, lastAddress: null } }));
    });
    vi.stubGlobal('fetch', fetchImpl);
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <StrictMode>
        <App router={router} />
      </StrictMode>,
    );
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(refreshCalls).toBe(1);
  });

  it('throws when useAuth is outside the provider', () => {
    function Orphan() {
      useAuth();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Orphan />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
