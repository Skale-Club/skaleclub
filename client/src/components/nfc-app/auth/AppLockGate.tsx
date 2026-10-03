import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint, LogOut } from 'lucide-react';
import { CtaButton, GhostButton, eyebrowClass, iconBlockClass, titleClass } from './ui';
import { PasskeyCancelled, biometricLabel, deviceFlags, nfcLogout, reauthWithPasskey } from './lib';

const LOCK_AFTER_MS = 5 * 60_000;

/** Full-screen biometric lock, shown on cold start and after 5+ minutes hidden. Off by default. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => deviceFlags.appLock());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (deviceFlags.appLock() && since !== null && Date.now() - since > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const unlock = useCallback(async (auto = false) => {
    setBusy(true);
    setError('');
    try {
      await reauthWithPasskey();
      setLocked(false);
    } catch (err) {
      if ((err as { status?: number })?.status === 404) {
        // No passkey left on the account: the lock could never open, so turn it off.
        deviceFlags.setAppLock(false);
        setLocked(false);
      } else if (!auto && !(err instanceof PasskeyCancelled)) {
        setError('Não foi possível verificar. Tente de novo.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // Try once on cold start; browsers that need a tap simply fall back to the button.
  useEffect(() => {
    if (locked) void unlock(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-navy-900 px-6 pattern-grid-dark"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-xs">
        <div className={`h-16 w-16 ${iconBlockClass}`}>
          <Fingerprint className="h-8 w-8" />
        </div>
        <p className={`mt-6 ${eyebrowClass}`}>Skale NFC</p>
        <h1 className={`mt-3 ${titleClass}`}>Skale NFC bloqueado</h1>
        <p className="mt-3 text-fog-200">Confirme com {biometricLabel()} para continuar.</p>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-8 space-y-3">
          <CtaButton busy={busy} onClick={() => unlock()} icon={<Fingerprint className="h-5 w-5" />}>
            Desbloquear
          </CtaButton>
          <GhostButton onClick={() => void nfcLogout()} icon={<LogOut className="h-5 w-5" />}>
            Sair
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
