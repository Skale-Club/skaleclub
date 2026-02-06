import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { initSupabase } from '@/lib/supabase';

interface AdminSession {
  isAdmin: boolean;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AuthContextType {
  isAdmin: boolean;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  loading: boolean;
  isSupabaseAuth: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  signOut: () => void;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Detect if we're on Replit (Replit sets REPL_ID which is exposed via the server)
// We detect it by trying to fetch the supabase-config endpoint:
// if it returns valid config, we're in Supabase mode; otherwise Replit mode
let _isSupabaseAuth: boolean | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', {
        credentials: 'include'
      });
      const data: AdminSession = await response.json();
      setIsAdmin(data.isAdmin);
      setEmail(data.email);
      setFirstName(data.firstName);
      setLastName(data.lastName);
    } catch (err) {
      setIsAdmin(false);
      setEmail(null);
      setFirstName(null);
      setLastName(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Detect auth mode
    (async () => {
      if (_isSupabaseAuth === null) {
        try {
          const res = await fetch('/api/supabase-config');
          const config = await res.json();
          _isSupabaseAuth = !!(config.url && config.anonKey);
        } catch {
          _isSupabaseAuth = false;
        }
      }
      setIsSupabaseAuth(_isSupabaseAuth);
      await checkSession();
    })();
  }, [checkSession]);

  const signIn = async (emailArg?: string, passwordArg?: string) => {
    if (isSupabaseAuth && emailArg && passwordArg) {
      // Supabase Auth: sign in with email/password
      const supabase = await initSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailArg,
        password: passwordArg,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session?.access_token) {
        // Send the token to our server to create a server session
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accessToken: data.session.access_token }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Login failed');
        }

        await checkSession();
      }
    } else {
      // Replit Auth: redirect to OIDC login
      window.location.href = '/api/login';
    }
  };

  const signOut = async () => {
    if (isSupabaseAuth) {
      try {
        const supabase = await initSupabase();
        await supabase.auth.signOut();
      } catch {
        // Ignore supabase signout errors
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAdmin(false);
      setEmail(null);
      setFirstName(null);
      setLastName(null);
      window.location.href = '/admin/login';
    } else {
      window.location.href = '/api/logout';
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, email, firstName, lastName, loading, isSupabaseAuth, signIn, signOut, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AuthProvider');
  }
  return context;
}
