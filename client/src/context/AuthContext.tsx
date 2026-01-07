import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AdminSession {
  isAdmin: boolean;
  email: string | null;
}

interface AuthContextType {
  isAdmin: boolean;
  email: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/admin/session', {
        credentials: 'include'
      });
      const data: AdminSession = await response.json();
      setIsAdmin(data.isAdmin);
      setEmail(data.isAdmin ? data.email : null);
    } catch (err) {
      setIsAdmin(false);
      setEmail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.message || 'Login failed') };
      }

      const data = await response.json();
      setIsAdmin(true);
      setEmail(data.email);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAdmin(false);
      setEmail(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, email, loading, signIn, signOut, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
