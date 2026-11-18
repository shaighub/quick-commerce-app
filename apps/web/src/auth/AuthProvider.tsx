import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  accessTokenResponseSchema,
  type LoginInput,
  type PublicUser,
  type SignupInput,
} from '@qc/shared';
import { apiBaseUrl, createApiClient, type ApiClient } from '../api/client.js';

export type InitialAuth =
  { status: 'guest' } | { status: 'authenticated'; user: PublicUser; accessToken: string };

interface AuthContextValue {
  status: 'loading' | 'guest' | 'authenticated';
  user: PublicUser | null;
  api: ApiClient;
  login: (input: LoginInput) => ReturnType<ApiClient['login']>;
  signup: (input: SignupInput) => ReturnType<ApiClient['signup']>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function AuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth?: InitialAuth;
}) {
  const tokenRef = useRef<string | null>(
    initialAuth?.status === 'authenticated' ? initialAuth.accessToken : null,
  );
  const skipRefresh = useRef(initialAuth !== undefined);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>(
    initialAuth?.status ?? 'loading',
  );
  const [user, setUser] = useState<PublicUser | null>(
    initialAuth?.status === 'authenticated' ? initialAuth.user : null,
  );

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    // React StrictMode runs the load effect twice. A second refresh with the
    // cookie that the first call just rotated is reuse and revokes the family.
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }
    const pending = (async (): Promise<string | null> => {
      const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-request-id': crypto.randomUUID(),
        },
      });
      if (!response.ok) {
        tokenRef.current = null;
        return null;
      }
      const payload: unknown = await response.json().catch(() => null);
      const parsed = accessTokenResponseSchema.safeParse(payload);
      if (!parsed.success) {
        tokenRef.current = null;
        return null;
      }
      tokenRef.current = parsed.data.accessToken;
      return parsed.data.accessToken;
    })();
    refreshInFlight.current = pending;
    void pending.finally(() => {
      refreshInFlight.current = null;
    });
    return pending;
  }, []);

  const client = useMemo(
    () =>
      createApiClient({
        getAccessToken: () => tokenRef.current,
        refreshAccessToken,
      }),
    [refreshAccessToken],
  );

  useEffect(() => {
    if (skipRefresh.current) {
      return;
    }
    const gate = { active: true };
    const stillActive = (): boolean => gate.active;
    void (async () => {
      const token = await refreshAccessToken();
      if (!stillActive()) {
        return;
      }
      if (!token) {
        setUser(null);
        setStatus('guest');
        return;
      }
      try {
        const me = await client.me();
        if (!stillActive()) {
          return;
        }
        setUser(publicUser(me.user));
        setStatus('authenticated');
      } catch {
        if (!stillActive()) {
          return;
        }
        tokenRef.current = null;
        setUser(null);
        setStatus('guest');
      }
    })();
    return () => {
      gate.active = false;
    };
  }, [client, refreshAccessToken]);

  const applySession = useCallback((session: { user: PublicUser; accessToken: string }) => {
    tokenRef.current = session.accessToken;
    setUser(publicUser(session.user));
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await client.login(input);
      applySession(session);
      return session;
    },
    [applySession, client],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const session = await client.signup(input);
      applySession(session);
      return session;
    },
    [applySession, client],
  );

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setStatus('guest');
  }, []);

  const logout = useCallback(async () => {
    await client.logout();
    clearSession();
  }, [clearSession, client]);

  const logoutAll = useCallback(async () => {
    await client.logoutAll();
    clearSession();
  }, [clearSession, client]);

  const value = useMemo(
    () => ({ status, user, api: client, login, signup, logout, logoutAll }),
    [status, user, client, login, signup, logout, logoutAll],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
