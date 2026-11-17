import type {} from '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { routes } from '../src/routes.js';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<App router={router} />);
}

describe('storefront shell', () => {
  it('exposes a skip link and landmarks', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Home and product list' }),
    ).toBeInTheDocument();
  });

  it('renders every designed screen', () => {
    const cases: Array<[string, string]> = [
      ['/search', 'Home and product list'],
      ['/p/amul-butter', 'Product detail'],
      ['/signup', 'Sign up'],
      ['/login', 'Log in'],
      ['/cart', 'Cart'],
      ['/checkout', 'Checkout'],
      ['/orders/QC-20261117-000001/confirmation', 'Order confirmation'],
      ['/orders', 'My orders'],
      ['/orders/QC-20261117-000001', 'Order detail'],
      ['/admin', 'Admin dashboard'],
      ['/admin/categories', 'Categories'],
      ['/admin/products', 'Products'],
      ['/admin/products/new', 'New product'],
      ['/admin/products/abc/edit', 'Edit product'],
      ['/admin/orders', 'Admin orders'],
      ['/missing', 'Page not found'],
    ];

    for (const [path, heading] of cases) {
      renderAt(path);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      cleanup();
    }
  });
});
