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

export default function AdminSignup() {
  const googleLogoUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Google_Favicon_2025.svg';
  const { isAdmin, loading, signIn, signUp, isSupabaseAuth, turnstileSiteKey } = useAdminAuth();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRequired = isSupabaseAuth && !!turnstileSiteKey;
  const captchaReady = !captchaRequired || !!captchaToken;
  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  useEffect(() => {
    if (!loading && isAdmin) {
      setLocation('/admin');
    }
  }, [loading, isAdmin, setLocation]);

  if (loading) {
    return <AppLoader />;
  }

  const handleGoogleSignup = async () => {
    setError('');
    setSuccess('');
    setGoogleSubmitting(true);

    try {
      try {
        window.sessionStorage.setItem('adminPostLoginRedirect', JSON.stringify({ to: '/admin', ts: Date.now() }));
      } catch {
        // Ignore storage errors.
      }
      await signIn(undefined, undefined, 'google');
    } catch (err: any) {
      setError(err.message || 'Google sign up failed');
      try {
        window.sessionStorage.removeItem('adminPostLoginRedirect');
      } catch {
        // Ignore storage errors.
      }
      setGoogleSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (captchaRequired && !captchaToken) {
      setError('Please complete the verification before creating your account.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(email, password, captchaToken ? { captchaToken } : undefined);
      if (result.needsEmailConfirmation) {
        setSuccess('Account created. Check your email to confirm your account before signing in.');
      } else {
        setLocation('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      logoUrl={companySettings?.logoMain}
      companyName={companySettings?.companyName || 'Skale Club'}
      onBack={() => setLocation('/')}
    >
      <AuthHeading
        eyebrow="Get started"
        title="Create your account"
        description="Set up your access to the admin dashboard."
      />

      <div className="space-y-5">
        {isSupabaseAuth ? (
          <>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <Button
              type="button"
              onClick={handleGoogleSignup}
              className={AUTH_SECONDARY_BUTTON}
              disabled={googleSubmitting}
              data-testid="button-signup-google"
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

            <form onSubmit={handleEmailSignup} className="space-y-5">
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
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={AUTH_INPUT}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className={AUTH_LABEL}>Confirm Password</Label>
                <div className="group relative">
                  <Lock className={AUTH_INPUT_ICON} />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                disabled={submitting || !captchaReady}
                data-testid="button-signup"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account
                {!submitting && (
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
            </form>

            <p className="pt-2 text-center text-sm text-fog-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setLocation('/admin/login')}
                className="font-semibold text-cta-soft transition-colors hover:text-fog-50"
              >
                Sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-fog-400">
              Sign up is not available in this authentication mode. Please sign in with Google.
            </p>
            <Button
              onClick={() => signIn()}
              className={AUTH_SECONDARY_BUTTON}
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
