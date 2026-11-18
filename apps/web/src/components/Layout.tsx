import { Link, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'Orders' },
  { to: '/login', label: 'Log in' },
  { to: '/admin', label: 'Admin' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <p className="text-lg font-semibold">Quick Commerce</p>
          <nav aria-label="Primary">
            <ul className="flex flex-wrap gap-4 text-sm">
              {links.map((link) => (
                <li key={link.to}>
                  <Link className="underline-offset-4 hover:underline" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 px-4 py-6 text-sm text-stone-700">
        <p>One store. Delivery only in the served area.</p>
      </footer>
    </div>
  );
}
