import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type RouterProviderProps } from 'react-router-dom';
import { AuthProvider, type InitialAuth } from './auth/AuthProvider.js';

export function App({
  router,
  initialAuth,
}: {
  router: RouterProviderProps['router'];
  initialAuth?: InitialAuth;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialAuth={initialAuth}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
