import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, getAuthToken, setAuthToken, AuthUser } from '../lib/api.js';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; organizationName?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setAuthToken(null);
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    const payload = res.data as any;
    if (!payload?.token) throw new Error('Login failed');
    setAuthToken(payload.token);
    setUser(payload.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; organizationName?: string }) => {
      const res = await api.auth.register(input);
      const payload = res.data as any;
      if (!payload?.token) throw new Error('Registration failed');
      setAuthToken(payload.token);
      setUser(payload.user);
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
