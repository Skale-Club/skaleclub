import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Fingerprint, Mail } from 'lucide-react';
import { useAdminAuth } from '@/context/AuthContext';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { CtaButton, GhostButton, cardClass } from './ui';
import {
  PasskeyCancelled,
  biometricLabel,
  deviceFlags,
  loginWithPasskey,
  nextFromLocation,
  passkeySupported,
  trustDevice,
} from './lib';

// AdminLogin reads this after the Google round trip and sends the admin on to it.
const POST_LOGIN_KEY = 'adminLoginNext';

const inputClass =
  'min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cta';

export function NfcLogin() {
  const { isAdmin, loading, signIn, checkSession, isSupabaseAuth, turnstileSiteKey } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [next] = useState(nextFromLocation);
  const supported = passkeySupported();
  const [emailOpen, setEmailOpen] = useState(() => !(supported && deviceFlags.hasPasskey()));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'passkey' | 'email' | 'google' | null>(null);
  // While a login is in flight we navigate ourselves, after trust-device ran.
  const loggingIn = useRef(false);

  const captchaRequired = isSupabaseAuth && !!turnstileSiteKey;
  const onVerify = useCallback((t: string) => setCaptchaToken(t), []);
  const onExpire = useCallback(() => setCaptchaToken(''), []);

  useEffect(() => {
    if (!loading && isAdmin && !loggingIn.current) setLocation(next);
  }, [loading, isAdmin, next, setLocation]);

  const finish = async (alreadyTrusted: boolean) => {
    if (!alreadyTrusted) await trustDevice().catch(() => undefined);
    setLocation(next);
  };

  const faceLogin = async () => {
    setError('');
    setBusy('passkey');
    loggingIn.current = true;
    try {
      await loginWithPasskey();
      await checkSession();
      await finish(true);
    } catch (err) {
      loggingIn.current = false;
      if (!(err instanceof PasskeyCancelled)) {
        setError('Não reconhecemos esse acesso. Entre com e-mail e senha.');
        setEmailOpen(true);
      }
    } finally {
      setBusy(null);
    }
  };

  const emailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      setError('Conclua a verificação antes de entrar.');
      return;
    }
    setError('');
    setBusy('email');
    loggingIn.current = true;
    try {
      await signIn(email, password, undefined, captchaToken ? { captchaToken } : undefined);
      await finish(false);
    } catch (err) {
      loggingIn.current = false;
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível entrar.');
      setCaptchaToken('');
    } finally {
      setBusy(null);
    }
  };

  const googleLogin = async () => {
    setError('');
    setBusy('google');
    try {
      try {
        window.sessionStorage.setItem(POST_LOGIN_KEY, next);
      } catch {
        // Without storage the admin lands on the admin panel; the app is one tap away.
      }
      await signIn(undefined, undefined, 'google');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível entrar.');
      setBusy(null);
    }
  };

  return (
    <main
      className="flex min-h-[100dvh] flex-col justify-center bg-[#0A162E] px-5 text-white"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Skale NFC</h1>
          <p className="mt-2 text-white/70">Entre para gravar e gerenciar plaquinhas.</p>
        </div>

        <div className="space-y-3">
          {supported && (
            <CtaButton busy={busy === 'passkey'} disabled={busy !== null} onClick={faceLogin} icon={<Fingerprint className="h-5 w-5" />}>
              Entrar com {biometricLabel()}
            </CtaButton>
          )}

          {!emailOpen ? (
            <GhostButton disabled={busy !== null} onClick={() => setEmailOpen(true)} icon={<Mail className="h-5 w-5" />}>
              Entrar com e-mail
            </GhostButton>
          ) : (
            <form onSubmit={emailLogin} className={`${cardClass} space-y-3 p-4`}>
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                aria-label="E-mail"
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                aria-label="Senha"
                className={inputClass}
              />
              {captchaRequired && (
                <div className="flex justify-center">
                  <TurnstileWidget siteKey={turnstileSiteKey} onVerify={onVerify} onExpire={onExpire} theme="dark" />
                </div>
              )}
              <CtaButton
                type="submit"
                busy={busy === 'email'}
                disabled={busy !== null || (captchaRequired && !captchaToken)}
              >
                Entrar
              </CtaButton>
            </form>
          )}

          <GhostButton disabled={busy !== null} busy={busy === 'google'} onClick={googleLogin}>
            Continuar com Google
          </GhostButton>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
