import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Fingerprint, Loader2, LogOut, Plus, Smartphone, Trash2 } from 'lucide-react';
import { GhostButton, HeroBand, cardClass, eyebrowClass, eyebrowMutedClass, titleClass } from './ui';
import {
  PasskeyCancelled,
  api,
  biometricLabel,
  deviceFlags,
  formatDate,
  nfcLogout,
  passkeySupported,
  registerPasskey,
} from './lib';

interface TrustedDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeen: string;
  current: boolean;
}
interface PasskeyRow {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function Row({
  title,
  meta,
  badge,
  onRevoke,
  busy,
}: {
  title: string;
  meta: string;
  badge?: string;
  onRevoke: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fog-50">
          {title}
          {badge && <span className="ml-2 rounded-full bg-cta/15 px-2 py-0.5 text-xs font-bold text-cta-soft">{badge}</span>}
        </p>
        <p className="truncate text-sm text-fog-400">{meta}</p>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={busy}
        aria-label={`Revogar ${title}`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-fog-400 hover:bg-white/10 hover:text-red-300 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
      </button>
    </li>
  );
}

/** /nfc/devices: trusted devices, passkeys and the biometric app lock. */
export function DevicesScreen() {
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [lock, setLock] = useState(deviceFlags.appLock);
  const supported = passkeySupported();

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api<{ devices: TrustedDevice[] }>('/api/auth/trusted-devices'),
        api<{ passkeys: PasskeyRow[] }>('/api/auth/passkeys'),
      ]);
      setDevices(d.devices);
      setPasskeys(p.passkeys);
    } catch {
      setError('Não foi possível carregar. Puxe para atualizar e tente de novo.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeDevice = async (d: TrustedDevice) => {
    const msg = d.current ? 'Revogar este aparelho vai sair do app agora. Continuar?' : `Revogar "${d.name}"?`;
    if (!window.confirm(msg)) return;
    setBusyId(d.id);
    setError('');
    try {
      await api(`/api/auth/trusted-devices/${d.id}`, { method: 'DELETE' });
      if (d.current) {
        window.location.href = '/nfc/login';
        return;
      }
      await load();
    } catch {
      setError('Não foi possível revogar o aparelho.');
    } finally {
      setBusyId(null);
    }
  };

  const revokePasskey = async (p: PasskeyRow) => {
    if (!window.confirm(`Remover o acesso por ${biometricLabel()} de "${p.deviceName}"?`)) return;
    setBusyId(p.id);
    setError('');
    try {
      await api(`/api/auth/passkeys/${p.id}`, { method: 'DELETE' });
      const remaining = await api<{ passkeys: PasskeyRow[] }>('/api/auth/passkeys');
      if (remaining.passkeys.length === 0) {
        deviceFlags.setHasPasskey(false);
        deviceFlags.setAppLock(false);
        setLock(false);
      }
      setPasskeys(remaining.passkeys);
    } catch {
      setError('Não foi possível remover.');
    } finally {
      setBusyId(null);
    }
  };

  const addPasskey = async () => {
    setAdding(true);
    setError('');
    try {
      await registerPasskey();
      await load();
    } catch (err) {
      if (!(err instanceof PasskeyCancelled)) setError(`Não foi possível ativar ${biometricLabel()}.`);
    } finally {
      setAdding(false);
    }
  };

  const toggleLock = () => {
    const next = !lock;
    deviceFlags.setAppLock(next);
    setLock(next);
  };

  const hasPasskey = (passkeys?.length ?? 0) > 0;

  return (
    <main className="min-h-[100dvh] bg-navy-950 font-sans text-fog-200" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      <HeroBand>
        <Link
          href="/nfc/home"
          className="-ml-2 inline-flex min-h-12 items-center gap-2 rounded-full px-2 font-semibold text-fog-50 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
          Início
        </Link>
        <p className={`mt-3 ${eyebrowClass}`}>Skale NFC</p>
        <h1 className={`mt-3 ${titleClass}`}>Aparelhos e acesso</h1>
      </HeroBand>
      <div className="mx-auto w-full max-w-md px-4 pt-5">
        {error && (
          <p role="alert" className="mb-2 rounded-none border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        <section className="mt-6">
          <h2 className={`mb-2 flex items-center gap-2 ${eyebrowMutedClass}`}>
            <Smartphone className="h-4 w-4" /> Aparelhos confiáveis
          </h2>
          <ul className={`${cardClass} divide-y divide-white/10`}>
            {devices === null ? (
              <li className="flex justify-center p-5">
                <Loader2 className="h-5 w-5 animate-spin text-fog-400" />
              </li>
            ) : devices.length === 0 ? (
              <li className="px-4 py-4 text-sm text-fog-400">Nenhum aparelho confiável.</li>
            ) : (
              devices.map((d) => (
                <Row
                  key={d.id}
                  title={d.name}
                  badge={d.current ? 'Este aparelho' : undefined}
                  meta={`Último uso ${formatDate(d.lastSeen)}`}
                  busy={busyId === d.id}
                  onRevoke={() => void revokeDevice(d)}
                />
              ))
            )}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className={`mb-2 flex items-center gap-2 ${eyebrowMutedClass}`}>
            <Fingerprint className="h-4 w-4" /> {biometricLabel()}
          </h2>
          <ul className={`${cardClass} divide-y divide-white/10`}>
            {passkeys === null ? (
              <li className="flex justify-center p-5">
                <Loader2 className="h-5 w-5 animate-spin text-fog-400" />
              </li>
            ) : passkeys.length === 0 ? (
              <li className="px-4 py-4 text-sm text-fog-400">Nenhum acesso cadastrado.</li>
            ) : (
              passkeys.map((p) => (
                <Row
                  key={p.id}
                  title={p.deviceName}
                  meta={`Criado em ${formatDate(p.createdAt)}, último uso ${formatDate(p.lastUsedAt)}`}
                  busy={busyId === p.id}
                  onRevoke={() => void revokePasskey(p)}
                />
              ))
            )}
          </ul>
          {supported ? (
            <GhostButton className="mt-3" busy={adding} onClick={addPasskey} icon={<Plus className="h-5 w-5" />}>
              Adicionar {biometricLabel()} neste aparelho
            </GhostButton>
          ) : (
            <p className="mt-3 text-sm text-fog-400">Este navegador não oferece acesso por biometria.</p>
          )}
        </section>

        <section className={`${cardClass} mt-6 flex items-center gap-3 p-4`}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fog-50">Pedir {biometricLabel()} ao abrir o app</p>
            <p className="text-sm text-fog-400">
              {hasPasskey ? 'Pede de novo depois de 5 minutos fora do app.' : 'Cadastre o acesso por biometria primeiro.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={lock}
            aria-label={`Pedir ${biometricLabel()} ao abrir o app`}
            disabled={!hasPasskey}
            onClick={toggleLock}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${lock ? 'bg-cta' : 'bg-navy-600'}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${lock ? 'left-7' : 'left-1'}`}
            />
          </button>
        </section>

        <GhostButton className="mt-8" onClick={() => void nfcLogout()} icon={<LogOut className="h-5 w-5" />}>
          Sair
        </GhostButton>
      </div>
    </main>
  );
}
