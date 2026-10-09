import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { AuthHeading, AuthLayout, AUTH_INPUT, AUTH_INPUT_ICON, AUTH_LABEL, AUTH_SECONDARY_BUTTON } from '@/components/admin/AuthLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { AppLoader } from '@/components/ui/spinner';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { CompanySettings } from '@shared/schema';

const POST_LOGIN_KEY = 'adminLoginNext';

// Only same-app admin paths — never an arbitrary URL.
function safeAdminPath(value: string | null | undefined): string | null {
  if (!value || !/^\/admin\/[A-Za-z0-9/_-]*$/.test(value)) return null;
  return /^\/admin\/(login|signup)\b/.test(value) ? null : value;
}

// ?next= survives the email form; sessionStorage carries it across the Google OAuth round trip.
function readPostLoginPath(): string {
  const fromQuery = safeAdminPath(new URLSearchParams(window.location.search).get('next'));
  try {
    if (fromQuery) window.sessionStorage.setItem(POST_LOGIN_KEY, fromQuery);
    return fromQuery ?? safeAdminPath(window.sessionStorage.getItem(POST_LOGIN_KEY)) ?? '/admin';
  } catch {
    return fromQuery ?? '/admin';
  }
}

export default function AdminLogin() {
  const googleLogoUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Google_Favicon_2025.svg';
  const { isAdmin, loading, signIn, isSupabaseAuth, turnstileSiteKey } = useAdminAuth();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [, setLocation] = useLocation();
  const [postLoginPath] = useState(readPostLoginPath);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRequired = isSupabaseAuth && !!turnstileSiteKey;
  const captchaReady = !captchaRequired || !!captchaToken;
  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  useEffect(() => {
    if (!loading && isAdmin) {
      try {
        window.sessionStorage.removeItem(POST_LOGIN_KEY);
      } catch {
        // Ignore storage errors.
      }
      setLocation(postLoginPath);
    }
  }, [loading, isAdmin, setLocation, postLoginPath]);

  if (loading) {
    return <AppLoader />;
  }

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      setError('Please complete the verification before signing in.');
      return;
    }
    setError('');
    setEmailSubmitting(true);

    try {
      await signIn(email, password, undefined, captchaToken ? { captchaToken } : undefined);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setCaptchaToken('');
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
    <AuthLayout
      logoUrl={companySettings?.logoMain}
      companyName={companySettings?.companyName || 'Skale Club'}
      onBack={() => setLocation('/')}
    >
      <AuthHeading
        eyebrow="Admin access"
        title="Welcome back"
        description="Sign in to access the admin dashboard."
      />

      <div className="space-y-5">
        {isSupabaseAuth ? (
          <>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="button"
              onClick={handleGoogleLogin}
              className={AUTH_SECONDARY_BUTTON}
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
              <div className="h-px flex-1 bg-white/10" />
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-fog-400">or</div>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSupabaseLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className={AUTH_LABEL}>Email</Label>
                <div className="group relative">
                  <Mail className={AUTH_INPUT_ICON} />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={AUTH_INPUT}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className={AUTH_LABEL}>Password</Label>
                <div className="group relative">
                  <Lock className={AUTH_INPUT_ICON} />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={AUTH_INPUT}
                    required
                  />
                </div>
              </div>
              {captchaRequired && (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                  onError={handleCaptchaExpire}
                />
              )}
              <Button
                type="submit"
                className="group !mt-8 h-12 w-full rounded-full bg-cta text-base font-bold text-white hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-0 disabled:opacity-60"
                disabled={emailSubmitting || !captchaReady}
                data-testid="button-login"
              >
                {emailSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
                {!emailSubmitting && (
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
            </form>

            <p className="pt-2 text-center text-sm text-fog-400">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setLocation('/admin/signup')}
                className="font-semibold text-cta-soft transition-colors hover:text-fog-50"
              >
                Sign up
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-fog-400">
              Use your Google account to sign in. Only authorized administrators can access this panel.
            </p>
            <Button
              onClick={() => signIn()}
              className={AUTH_SECONDARY_BUTTON}
              data-testid="button-login"
            >
              <img src={googleLogoUrl} alt="" aria-hidden="true" className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
