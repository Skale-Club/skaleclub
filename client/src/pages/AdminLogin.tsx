import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { useQuery } from '@tanstack/react-query';
import type { CompanySettings } from '@shared/schema';

export default function AdminLogin() {
  const { isAdmin, loading, signIn, isSupabaseAuth } = useAdminAuth();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      setLocation('/admin');
    }
  }, [loading, isAdmin, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailSubmitting(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleSubmitting(true);

    try {
      // After OAuth callback, Supabase can sometimes land the user on "/" (Site URL fallback).
      // Keep a small hint so the app can send admins into the admin panel post-login.
      try {
        window.sessionStorage.setItem('adminPostLoginRedirect', JSON.stringify({ to: '/admin', ts: Date.now() }));
      } catch {
        // Ignore storage errors.
      }
      await signIn(undefined, undefined, 'google');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      try {
        window.sessionStorage.removeItem('adminPostLoginRedirect');
      } catch {
        // Ignore storage errors.
      }
      setGoogleSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 flex items-center justify-center mb-4 overflow-hidden">
            {companySettings?.logoIcon ? (
              <img
                src={companySettings.logoIcon}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Lock className={`w-6 h-6 text-primary ${companySettings?.logoIcon ? 'hidden' : ''}`} />
          </div>
          <CardTitle className="text-2xl">{companySettings?.companyName || 'Admin Login'}</CardTitle>
          <CardDescription>Sign in to manage your services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSupabaseAuth ? (
            <>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full"
                disabled={googleSubmitting}
                data-testid="button-login-google"
              >
                {googleSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <SiGoogle className="w-4 h-4 mr-2" />
                )}
                Sign in with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="text-xs uppercase tracking-wider text-slate-500">or</div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleSupabaseLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={emailSubmitting}
                  data-testid="button-login"
                >
                  {emailSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Use your Google account to sign in. Only authorized administrators can access this panel.
              </p>
              <Button
                onClick={() => signIn()}
                className="w-full"
                data-testid="button-login"
              >
                <SiGoogle className="w-4 h-4 mr-2" />
                Sign in with Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
