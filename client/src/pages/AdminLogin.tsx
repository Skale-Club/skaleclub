import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Lock, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { CompanySettings } from '@shared/schema';

export default function AdminLogin() {
  const googleLogoUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Google_Favicon_2025.svg';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
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
    <main className="min-h-screen bg-slate-100 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => setLocation('/')}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-800 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>

        <Card className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="px-5 pb-4 pt-7 text-center md:px-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden">
              {companySettings?.logoIcon ? (
                <img
                  src={companySettings.logoIcon}
                  alt="Logo"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Lock className={`h-6 w-6 text-primary ${companySettings?.logoIcon ? 'hidden' : ''}`} />
            </div>
            <CardTitle className="text-2xl leading-none tracking-tight text-slate-900">
              {companySettings?.companyName || 'Admin Login'}
            </CardTitle>
            <CardDescription className="pt-2 text-base text-slate-600">
              Sign in to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-7 md:px-6">
            {isSupabaseAuth ? (
              <>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="h-12 w-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  disabled={googleSubmitting}
                  data-testid="button-login-google"
                >
                  {googleSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <img src={googleLogoUrl} alt="" aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  Continue with Google
                </Button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="text-xs uppercase tracking-wider text-slate-500">or continue with</div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form onSubmit={handleSupabaseLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xl font-semibold text-slate-900">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 border-slate-200 bg-slate-100/80 pl-10 text-base placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xl font-semibold text-slate-900">Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="*****"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 border-slate-200 bg-slate-100/80 pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={emailSubmitting}
                    data-testid="button-login"
                  >
                    {emailSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
                <p className="text-center text-base text-slate-600">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setLocation('/admin/signup')}
                    className="font-medium text-[#2459A8]"
                  >
                    Sign up
                  </button>
                </p>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Use your Google account to sign in. Only authorized administrators can access this panel.
                </p>
                <Button
                  onClick={() => signIn()}
                  className="h-12 w-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  data-testid="button-login"
                >
                  <img src={googleLogoUrl} alt="" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
