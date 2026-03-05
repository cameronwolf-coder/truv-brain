import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credential: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'truv_hub_auth';
const ALLOWED_DOMAIN = 'truv.com';

function decodeJwt(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser & { exp: number };
        if (parsed.exp && parsed.exp * 1000 > Date.now()) {
          setUser({ email: parsed.email, name: parsed.name, picture: parsed.picture });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((credential: string) => {
    const payload = decodeJwt(credential);
    const email = payload.email as string;

    if (!email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed.`);
    }

    const authUser: AuthUser & { exp: number } = {
      email,
      name: (payload.name as string) || email,
      picture: (payload.picture as string) || '',
      exp: payload.exp as number,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setUser({ email: authUser.email, name: authUser.name, picture: authUser.picture });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
