import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Nfc, Smartphone, X } from 'lucide-react';
import { errorMessage, haptic } from './lib';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_TERTIARY, BottomSheet, CopyButton, EYEBROW_MUTED, SHEET_TITLE, Spinner, type Identity } from './ui';
import { isWebNfcSupported, mapNfcError, verify, writeUrl } from './webNfc';

export interface WriteResult {
  method: 'web_nfc' | 'manual';
  /** True only when the chip was read back and matched exactly. */
  verified: boolean;
  readbackUrl: string | null;
}

interface Props {
  open: boolean;
  url: string;
  identity: Identity;
  onClose: () => void;
  /** Report the result. May throw: the sheet shows the message and lets the operator retry. */
  onDone: (result: WriteResult) => Promise<void> | void;
}

type Phase = 'idle' | 'writing' | 'verifying' | 'saving' | 'done' | 'error';

function TapAnimation({ identity, label, sub }: { identity: Identity; label: string; sub: string }) {
  const color = identity === 'skale' ? 'bg-cta' : 'bg-emerald-500';
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <span className={`absolute inset-0 animate-ping rounded-full opacity-20 ${color}`} />
        <span className={`absolute inset-4 animate-pulse rounded-full opacity-30 ${color}`} />
        <span className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white ${color}`}>
          <Nfc className="h-10 w-10" />
        </span>
      </div>
      <p className={`mt-4 ${SHEET_TITLE}`}>{label}</p>
      <p className="mt-1 text-sm text-fog-400">{sub}</p>
    </div>
  );
}

const MANUAL_STEPS = [
  'Abra o NFC Tools e vá em Escrever.',
  'Toque em Adicionar um registro.',
  'Escolha URL/URI.',
  'Cole o link copiado e confirme.',
  'Toque em Escrever e aproxime o chip da parte de cima do iPhone.',
];

export default function WriteSheet({ open, url, identity, onClose, onDone }: Props) {
  const supported = isWebNfcSupported();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastVerified, setLastVerified] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cancel();
      setPhase('idle');
      setError(null);
    }
    return cancel;
  }, [open, cancel]);

  const report = useCallback(
    async (result: WriteResult) => {
      setPhase('saving');
      try {
        await onDone(result);
        haptic([60, 40, 60]);
        setLastVerified(result.verified);
        setPhase('done');
      } catch (err) {
        setError(errorMessage(err));
        setPhase('error');
      }
    },
    [onDone],
  );

  const startWrite = useCallback(async () => {
    cancel();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setPhase('writing');
    try {
      await writeUrl(url, ctrl.signal);
      haptic(40);
      setPhase('verifying');
      const readback = await verify(url, ctrl.signal);
      if (readback === url) return await report({ method: 'web_nfc', verified: true, readbackUrl: readback });
      setError(
        readback
          ? `O chip está com outro link: ${readback}. Grave de novo.`
          : 'Não encontrei o link no chip. Grave de novo.',
      );
      setPhase('error');
    } catch (err) {
      const e = mapNfcError(err);
      if (e.silent) return;
      setError(e.message);
      setPhase('error');
    }
  }, [url, cancel, report]);

  const skipVerify = useCallback(() => {
    cancel();
    void report({ method: 'web_nfc', verified: false, readbackUrl: null });
  }, [cancel, report]);

  const close = () => {
    cancel();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title="Gravar chip">
      <div className="flex items-center justify-between">
        <h2 className={SHEET_TITLE}>Gravar chip</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="flex h-12 w-12 items-center justify-center rounded-full text-fog-300 active:bg-white/10"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="mt-2 rounded-none border border-white/10 bg-navy-900 p-4">
        <p className={EYEBROW_MUTED}>Link a gravar</p>
        <p className="mt-1 break-all font-mono text-sm tracking-wide text-fog-50" data-testid="text-write-url">
          {url}
        </p>
      </div>
      <div className="mt-3">
        <CopyButton text={url} large />
      </div>

      {phase === 'done' ? (
        <div className="mt-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-none bg-emerald-500 text-white">
            <Check className="h-10 w-10" />
          </div>
          <p className={`mt-3 ${SHEET_TITLE}`}>{lastVerified ? 'Chip gravado e conferido' : 'Chip marcado como gravado'}</p>
          {!lastVerified && <p className="mt-1 text-sm text-fog-400">Sem conferência de leitura.</p>}
          <button type="button" onClick={close} className={`${BTN_PRIMARY} mt-5`}>
            Pronto
          </button>
        </div>
      ) : phase === 'writing' ? (
        <>
          <TapAnimation identity={identity} label="Aproxime o chip" sub="Encoste no verso do celular e segure." />
          <button type="button" onClick={() => { cancel(); setPhase('idle'); }} className={BTN_TERTIARY}>
            Cancelar
          </button>
        </>
      ) : phase === 'verifying' ? (
        <>
          <TapAnimation identity={identity} label="Encoste de novo para conferir" sub="Gravado. Falta ler o chip de volta." />
          <button type="button" onClick={skipVerify} className={BTN_TERTIARY}>
            Pular conferência
          </button>
        </>
      ) : phase === 'saving' ? (
        <div className="flex flex-col items-center py-8 text-fog-300">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm">Salvando</p>
        </div>
      ) : supported ? (
        <div className="mt-5 space-y-3">
          {phase === 'error' && error && (
            <p role="alert" className="rounded-none border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
              {error}
            </p>
          )}
          <button type="button" onClick={() => void startWrite()} className={BTN_PRIMARY}>
            <Nfc className="h-5 w-5" />
            {phase === 'error' ? 'Tentar de novo' : 'Gravar agora'}
          </button>
          <button
            type="button"
            onClick={() => void report({ method: 'manual', verified: false, readbackUrl: null })}
            className="w-full min-h-[44px] text-sm font-semibold text-fog-400 active:text-fog-50"
          >
            Gravei por outro app, marcar como gravado
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-bold text-fog-50">
            <Smartphone className="h-4 w-4" />
            No iPhone, grave com o NFC Tools
          </div>
          <ol className="mt-3 space-y-2">
            {MANUAL_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-fog-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-white/10 bg-navy-900 text-xs font-bold text-cta-soft">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {phase === 'error' && error && (
            <p role="alert" className="mt-4 rounded-none border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void report({ method: 'manual', verified: false, readbackUrl: null })}
            className={`${BTN_SECONDARY} mt-5`}
          >
            <Check className="h-5 w-5" />
            Marcar como gravado
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

