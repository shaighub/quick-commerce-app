import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';

export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);

  async function onLogout(everywhere: boolean): Promise<void> {
    try {
      if (everywhere) {
        await auth.logoutAll();
      } else {
        await auth.logout();
      }
      setActionError(null);
      void navigate('/');
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Could not log out');
    }
  }

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
            <ul className="flex flex-wrap items-center gap-4 text-sm">
              <li>
                <Link className="underline-offset-4 hover:underline" to="/">
                  Home
                </Link>
              </li>
              <li>
                <Link className="underline-offset-4 hover:underline" to="/cart">
                  Cart
                </Link>
              </li>
              <li>
                <Link className="underline-offset-4 hover:underline" to="/orders">
                  Orders
                </Link>
              </li>
              {auth.status === 'loading' ? (
                <li>
                  <span role="status">Checking session</span>
                </li>
              ) : null}
              {auth.status === 'guest' ? (
                <>
                  <li>
                    <Link className="underline-offset-4 hover:underline" to="/login">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link className="underline-offset-4 hover:underline" to="/signup">
                      Sign up
                    </Link>
                  </li>
                </>
              ) : null}
              {auth.status === 'authenticated' && auth.user ? (
                <>
                  {auth.user.role === 'ADMIN' ? (
                    <>
                      <li>
                        <Link className="underline-offset-4 hover:underline" to="/admin">
                          Admin
                        </Link>
                      </li>
                      <li>
                        <Link className="underline-offset-4 hover:underline" to="/admin/categories">
                          Categories
                        </Link>
                      </li>
                      <li>
                        <Link className="underline-offset-4 hover:underline" to="/admin/products">
                          Products
                        </Link>
                      </li>
                    </>
                  ) : null}
                  <li>
                    <span>
                      Account: <span className="font-medium">{auth.user.name}</span>
                    </span>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      onClick={() => {
                        void onLogout(false);
                      }}
                    >
                      Log out
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      onClick={() => {
                        void onLogout(true);
                      }}
                    >
                      Log out everywhere
                    </button>
                  </li>
                </>
              ) : null}
            </ul>
          </nav>
        </div>
        {actionError ? (
          <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
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
