import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider.js';

export const cartQueryKey = ['cart'] as const;

/** Live cart. staleTime 0 so window focus refetches stock (FR-CART-05). */
export function useCart() {
  const auth = useAuth();
  return useQuery({
    queryKey: cartQueryKey,
    enabled: auth.user?.role === 'CUSTOMER',
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => auth.api.getCart(),
  });
}
