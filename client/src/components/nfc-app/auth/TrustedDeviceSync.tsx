import { useEffect, useState } from 'react';
import { Fingerprint, X } from 'lucide-react';
import { useAdminAuth } from '@/context/AuthContext';
import { CtaButton, cardClass } from './ui';
import {
  PasskeyCancelled,
  api,
  biometricLabel,
  deviceFlags,
  platformAuthenticatorAvailable,
  registerPasskey,
  trustDevice,
} from './lib';

/** Upgrades the session to a trusted (long) one once per load, then offers Face ID once. */
export function TrustedDeviceSync() {
  const { isAdmin, loading } = useAdminAuth();
  const [offer, setOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const sess = await api<{ trusted?: boolean }>('/api/admin/session');
        if (!sess.trusted) await trustDevice();
      } catch {
        // Silent: the session still works, it just keeps the shorter lifetime.
      }
      if (deviceFlags.hasPasskey() || deviceFlags.promptSnoozed()) return;
      if (await platformAuthenticatorAvailable()) {
        if (!cancelled) setOffer(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, isAdmin]);

  if (!offer) return null;

  const dismiss = () => {
    deviceFlags.snoozePrompt();
    setOffer(false);
  };

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await registerPasskey();
      setOffer(false);
    } catch (err) {
      if (!(err instanceof PasskeyCancelled)) setError('Não foi possível ativar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className={`${cardClass} mx-auto max-w-md bg-[#0F2040] p-4 shadow-xl`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta/20 text-cta">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">Ativar {biometricLabel()} neste aparelho</p>
            <p className="mt-1 text-sm text-white/70">Entre sem senha quando a sessão acabar.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Agora não"
            className="-m-2 flex h-12 w-12 items-center justify-center rounded-full text-white/60 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <CtaButton className="mt-3" busy={busy} onClick={enable}>
          Ativar
        </CtaButton>
      </div>
    </div>
  );
}
