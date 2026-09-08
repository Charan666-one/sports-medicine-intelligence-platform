import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, getAuthToken, setAuthToken, getRefreshToken, setRefreshToken, AuthUser } from '../lib/api.js';

/** Returned by login(): either the session started, or MFA needs a second step (see mfaChallenge). */
export type LoginResult = { mfaRequired: false } | { mfaRequired: true; mfaToken: string };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Completes an MFA-gated login: exchanges the mfaToken + a code for a real session. */
  mfaChallenge: (mfaToken: string, code: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; organizationName?: string }) => Promise<void>;
  logout: () => void;
  /** Re-fetches the current user — call after an action that changes it server-side but not via login/register (e.g. MFA enable/disable). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Best-effort revoke on the server — don't block clearing local state on it.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.auth.logout(refreshToken).catch(() => {
        /* token may already be expired/revoked — local logout still proceeds */
      });
    }
    setAuthToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Restore session from a stored token on load.
  useEffect(() => {
    let active = true;
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.auth
      .me()
      .then((res) => {
        if (active) setUser((res.data as any)?.user ?? null);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [logout]);

  // React to 401s dispatched by the API client.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('nexus:unauthorized', handler);
    return () => window.removeEventListener('nexus:unauthorized', handler);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.auth.login(email, password);
    const payload = res.data as any;
    if (payload?.mfaRequired) {
      return { mfaRequired: true, mfaToken: payload.mfaToken };
    }
    if (!payload?.token) throw new Error('Login failed');
    setAuthToken(payload.token);
    setRefreshToken(payload.refreshToken ?? null);
    setUser(payload.user);
    return { mfaRequired: false };
  }, []);

  const mfaChallenge = useCallback(async (mfaToken: string, code: string) => {
    const res = await api.auth.mfaChallenge(mfaToken, code);
    const payload = res.data as any;
    if (!payload?.token) throw new Error('MFA verification failed');
    setAuthToken(payload.token);
    setRefreshToken(payload.refreshToken ?? null);
    setUser(payload.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; organizationName?: string }) => {
      const res = await api.auth.register(input);
      const payload = res.data as any;
      if (!payload?.token) throw new Error('Registration failed');
      setAuthToken(payload.token);
      setRefreshToken(payload.refreshToken ?? null);
      setUser(payload.user);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const res = await api.auth.me();
    setUser((res.data as any)?.user ?? null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, mfaChallenge, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
