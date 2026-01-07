import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initSupabase, getSupabase } from '@/lib/supabase';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    initSupabase()
      .then((client) => {
        setSupabase(client);
        setInitialized(true);
        
        client.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });

        return () => subscription.unsubscribe();
      })
      .catch((err) => {
        console.error('Failed to initialize Supabase:', err);
        setLoading(false);
        setInitialized(true);
      });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not initialized') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, initialized, signIn, signOut }}>
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
