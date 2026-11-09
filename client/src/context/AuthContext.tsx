import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

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
  signOut: () => Promise<void>;
  checkSession: () => Promise<AdminSession | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The Express session cookie is the only login state. Signing in (phone code or
 * Google) happens on AdminLogin, which exchanges a Firebase ID token for that
 * cookie at POST /api/auth/identity and then calls checkSession().
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      return data;
    } catch (err) {
      setIsAdmin(false);
      setEmail(null);
      setFirstName(null);
      setLastName(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const sess = await checkSession();

      // Clear any transient post-login redirect hint once the admin session is established.
      if (sess?.isAdmin) {
        try {
          window.sessionStorage.removeItem('adminPostLoginRedirect');
        } catch {
          // Ignore storage errors.
        }
      }
    })();
  }, [checkSession]);

  const signOut = async () => {
    // Destroy the Express session first, then drop Firebase's in-memory sign-in.
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      try {
        const { signOutGoogleIdentity } = await import('@/lib/googleIdentity');
        await signOutGoogleIdentity();
      } catch {
        // Firebase may never have loaded; nothing to sign out of.
      }
      setIsAdmin(false);
      setEmail(null);
      setFirstName(null);
      setLastName(null);
      window.location.href = '/admin/login';
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, email, firstName, lastName, loading, signOut, checkSession }}>
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
