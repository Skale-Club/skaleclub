import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
  signIn: () => void;
  signOut: () => void;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
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
  };

  useEffect(() => {
    checkSession();
  }, []);

  const signIn = () => {
    window.location.href = '/api/login';
  };

  const signOut = () => {
    window.location.href = '/api/logout';
  };

  return (
    <AuthContext.Provider value={{ isAdmin, email, firstName, lastName, loading, signIn, signOut, checkSession }}>
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
