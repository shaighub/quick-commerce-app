import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@qc/shared';
import { useAuth } from './AuthProvider.js';

const customerRoles: Role[] = ['CUSTOMER', 'ADMIN'];
const adminRoles: Role[] = ['ADMIN'];

function RequireRoles({ roles }: { roles: readonly Role[] }) {
  const auth = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (auth.user && !roles.includes(auth.user.role)) {
      document.title = 'Not allowed · Quick Commerce';
    }
  }, [auth.user, roles]);

  if (auth.status === 'loading') {
    return (
      <p role="status" className="text-stone-700">
        Checking your session…
      </p>
    );
  }
  if (!auth.user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!roles.includes(auth.user.role)) {
    return (
      <article>
        <h1 className="text-3xl font-semibold">Not allowed</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-700">
          Your account cannot open this page.
        </p>
      </article>
    );
  }
  return <Outlet />;
}

/** Cart, checkout, and orders. Guests go to log in. Signed-in admins may view them. */
export function RequireCustomer() {
  return <RequireRoles roles={customerRoles} />;
}

export function RequireAdmin() {
  return <RequireRoles roles={adminRoles} />;
}
