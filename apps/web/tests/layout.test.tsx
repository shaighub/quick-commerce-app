import type {} from '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import type { InitialAuth } from '../src/auth/AuthProvider.js';
import { routes } from '../src/routes.js';

const guest: InitialAuth = { status: 'guest' };
const customer: InitialAuth = {
  status: 'authenticated',
  accessToken: 'customer-token',
  user: {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Asha Rao',
    email: 'asha@example.com',
    role: 'CUSTOMER',
  },
};
const admin: InitialAuth = {
  status: 'authenticated',
  accessToken: 'admin-token',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Store Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

function renderAt(path: string, initialAuth: InitialAuth = guest) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<App router={router} initialAuth={initialAuth} />);
}

describe('storefront shell', () => {
  it('exposes a skip link and landmarks', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('heading', { level: 1, name: 'Shop' })).toBeInTheDocument();
  });

  it('renders every designed screen for a role that may open it', () => {
    const guestScreens: Array<[string, string]> = [
      ['/search', 'Shop'],
      ['/p/amul-butter', 'Product'],
      ['/signup', 'Sign up'],
      ['/login', 'Log in'],
      ['/missing', 'Page not found'],
    ];
    const customerScreens: Array<[string, string]> = [
      ['/cart', 'Cart'],
      ['/checkout', 'Checkout'],
      ['/orders/QC-20261117-000001/confirmation', 'Order confirmation'],
      ['/orders', 'My orders'],
      ['/orders/QC-20261117-000001', 'Order detail'],
    ];
    const adminScreens: Array<[string, string]> = [
      ['/admin', 'Admin dashboard'],
      ['/admin/categories', 'Categories'],
      ['/admin/products', 'Products'],
      ['/admin/products/new', 'New product'],
      ['/admin/products/abc/edit', 'Edit product'],
      ['/admin/orders', 'Admin orders'],
    ];

    for (const [path, heading] of guestScreens) {
      renderAt(path, guest);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      cleanup();
    }
    for (const [path, heading] of customerScreens) {
      renderAt(path, customer);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      cleanup();
    }
    for (const [path, heading] of adminScreens) {
      renderAt(path, admin);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      cleanup();
    }
  });

  it('shows log in for a guest and account actions for a customer, hiding admin', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    cleanup();

    renderAt('/', customer);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out everywhere' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    cleanup();

    renderAt('/', admin);
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });
});
