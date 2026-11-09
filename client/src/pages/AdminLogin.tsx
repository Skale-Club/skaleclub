import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { AuthHeading, AuthLayout, AUTH_SECONDARY_BUTTON } from '@/components/admin/AuthLayout';
import { PhoneCodeFlow, type PhoneCodeResult } from '@/components/admin/PhoneCodeFlow';
import { Loader2 } from '@/components/ui/loader';
import { AppLoader } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import type { CompanySettings } from '@shared/schema';
import { usePageSeo } from '@/hooks/use-seo';
import {
  isPopupDismissed,
  loadAuthConfig,
  googlePhoneError,
  signInErrorMessage,
  signInGoogleAlternative,
  type AuthConfig,
} from '@/lib/googleIdentity';

const POST_LOGIN_KEY = 'adminLoginNext';

// Same-app destinations only, never an arbitrary URL: an admin page, or the MCP
// OAuth consent page (which carries its request in the query string).
function safePostLoginPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\/admin\/[A-Za-z0-9/_-]*$/.test(value)) {
    return /^\/admin\/(login|not-invited)\b/.test(value) ? null : value;
  }
  if (/^\/oauth\/authorize\?[A-Za-z0-9%&=._~:/+*-]*$/.test(value)) return value;
  return null;
}

// ?next= survives the round trip; sessionStorage keeps it if the page reloads.
function readPostLoginPath(): string {
  const fromQuery = safePostLoginPath(new URLSearchParams(window.location.search).get('next'));
  try {
    if (fromQuery) window.sessionStorage.setItem(POST_LOGIN_KEY, fromQuery);
    return fromQuery ?? safePostLoginPath(window.sessionStorage.getItem(POST_LOGIN_KEY)) ?? '/admin';
  } catch {
    return fromQuery ?? '/admin';
  }
}

async function exchangeIdToken(idToken: string): Promise<PhoneCodeResult & { notInvited?: boolean }> {
  try {
    const res = await fetch('/api/auth/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.code === 'not_invited') return { ok: false, notInvited: true };
    return { ok: false, code: data.code };
  } catch {
    return { ok: false, code: 'generic' };
  }
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="mr-2 h-4 w-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92c-.26 1.28-1.02 2.37-2.15 3.1v2.58h3.48c2.04-1.88 3.21-4.65 3.21-7.55Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.48-2.58c-.98.66-2.24 1.06-3.8 1.06-2.87 0-5.3-1.94-6.17-4.54H2.23v2.66C4.04 20.53 7.73 23 12 23Z" />
      <path fill="#FBBC05" d="M5.83 14.28A6.6 6.6 0 0 1 5.48 12c0-.79.14-1.55.35-2.28V7.06H2.23A10.94 10.94 0 0 0 1 12c0 1.78.43 3.45 1.23 4.94l3.6-2.66Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.73 1 4.04 3.47 2.23 7.06l3.6 2.66C6.7 7.12 9.13 5.38 12 5.38Z" />
    </svg>
  );
}

export default function AdminLogin() {
  usePageSeo({ title: 'Admin login', noindex: true });

  const { isAdmin, loading, checkSession } = useAdminAuth();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [, setLocation] = useLocation();
  const [postLoginPath] = useState(readPostLoginPath);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAuthConfig().then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && isAdmin) {
      try {
        window.sessionStorage.removeItem(POST_LOGIN_KEY);
      } catch {
        // Ignore storage errors.
      }
      // The consent page is served by its own shell, so it needs a full load.
      if (postLoginPath.startsWith('/oauth/')) window.location.assign(postLoginPath);
      else setLocation(postLoginPath);
    }
  }, [loading, isAdmin, setLocation, postLoginPath]);

  if (loading) {
    return <AppLoader />;
  }

  // Exchanges a verified Firebase ID token for the Express session.
  const finishSignIn = async (idToken: string): Promise<PhoneCodeResult> => {
    const result = await exchangeIdToken(idToken);
    if (result.ok) {
      await checkSession();
      return result;
    }
    if (result.notInvited) {
      setLocation('/admin/not-invited');
      return { ok: true };
    }
    return result;
  };

  const handleGoogleLogin = async () => {
    if (!config?.enabled) return;
    setError('');
    setGoogleSubmitting(true);
    try {
      const result = await finishSignIn(await signInGoogleAlternative(config));
      if (!result.ok) setError(signInErrorMessage(result.code));
    } catch (err) {
      if (!isPopupDismissed(err)) {
        // Firebase's own code, for whoever looks into a failed Google sign-in.
        console.warn('[signin] Google sign-in failed', (err as { code?: string })?.code ?? err);
        setError(signInErrorMessage(googlePhoneError(err)));
      }
    } finally {
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
        description="Sign in with your phone to access the admin dashboard."
      />

      <div className="space-y-5">
        {config === null ? (
          <div className="flex justify-center py-8" data-testid="signin-loading">
            <Loader2 className="h-6 w-6 animate-spin text-fog-400" />
          </div>
        ) : !config.enabled ? (
          <div
            role="alert"
            data-testid="signin-unavailable"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-fog-300"
          >
            Sign-in unavailable right now. Try again in a moment.
          </div>
        ) : (
          <>
            <PhoneCodeFlow config={config} variant="auth" onVerified={finishSignIn} />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-fog-400">or</div>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="button"
              onClick={handleGoogleLogin}
              className={`${AUTH_SECONDARY_BUTTON} !border-white/30 hover:!border-white/50`}
              disabled={googleSubmitting}
              data-testid="button-login-google"
            >
              {googleSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleMark />}
              Continue with Google
            </Button>

            <p className="pt-2 text-center text-sm text-fog-400">
              Access is by invitation only. Ask an administrator to add your phone or Google email.
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
