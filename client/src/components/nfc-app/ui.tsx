import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, Check, ClipboardPaste, Copy, Loader2 } from 'lucide-react';
import { copyToClipboard, haptic, readClipboard } from './lib';

export type Identity = 'skale' | 'direct';

export const CARD = 'rounded-2xl border border-white/10 bg-white/5';
export const INPUT =
  'w-full min-h-[48px] rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white placeholder:text-slate-500 focus:border-cta focus:outline-none focus:ring-2 focus:ring-cta/40';
export const BTN_PRIMARY =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-bold text-white transition-colors active:bg-cta-hover disabled:opacity-50';
export const BTN_SECONDARY =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-base font-semibold text-white transition-colors active:bg-white/10 disabled:opacity-50';

/** Full-height navy app frame with safe areas. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] bg-[#0A162E] font-sans text-slate-100"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 pb-10">{children}</div>
    </div>
  );
}

export function TopBar({ title, back = '/nfc/home', right }: { title: string; back?: string | null; right?: ReactNode }) {
  return (
    <header className="flex min-h-[64px] items-center gap-2">
      {back && (
        <Link
          href={back}
          aria-label="Voltar"
          className="-ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
      )}
      <h1 className="flex-1 truncate text-lg font-bold text-white">{title}</h1>
      {right}
    </header>
  );
}

export function Banner({ banner }: { banner: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!banner) return null;
  const ok = banner.tone === 'ok';
  return (
    <div
      role="status"
      className={`mb-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        ok ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-red-400/30 bg-red-500/15 text-red-100'
      }`}
    >
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="min-w-0 break-words">{banner.text}</span>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function IdentityBadge({ kind }: { kind: Identity }) {
  const skale = kind === 'skale';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ${
        skale ? 'bg-cta' : 'bg-emerald-500'
      }`}
    >
      {skale ? 'Tag Skale' : 'Link direto do cliente'}
    </span>
  );
}

/** Colored hero strip that tells the operator which kind of piece this is. */
export function IdentityHeader({ kind, children }: { kind: Identity; children: ReactNode }) {
  const skale = kind === 'skale';
  return (
    <section
      className={`rounded-2xl border p-5 ${
        skale ? 'border-cta/40 bg-cta/15' : 'border-emerald-400/30 bg-emerald-500/10'
      }`}
    >
      <IdentityBadge kind={kind} />
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-500/20 text-emerald-200',
    amber: 'bg-amber-500/20 text-amber-200',
    red: 'bg-red-500/20 text-red-200',
    slate: 'bg-white/10 text-slate-300',
    blue: 'bg-cta/25 text-blue-100',
  } as const;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function CopyButton({ text, label = 'Copiar link', large = false }: { text: string; label?: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onCopy = async () => {
    if (!(await copyToClipboard(text))) return;
    haptic(30);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  if (!large) {
    return (
      <button
        type="button"
        onClick={() => void onCopy()}
        aria-label={label}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
      >
        {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-lg font-bold text-white transition-colors ${
        copied ? 'bg-emerald-600' : 'bg-cta active:bg-cta-hover'
      }`}
    >
      {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

/** URL input with a "Colar" button that reads the clipboard. */
export function LinkInput({
  value,
  onChange,
  placeholder = 'https://cliente.com/menu',
  onPasteFailed,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onPasteFailed?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT}
      />
      <button
        type="button"
        onClick={async () => {
          const text = await readClipboard();
          if (text) {
            onChange(text);
            haptic(20);
          } else onPasteFailed?.();
        }}
        className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white active:bg-white/20"
      >
        <ClipboardPaste className="h-4 w-4" />
        Colar
      </button>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</label>;
}

/** Slide-up sheet with a dimmed backdrop. */
export function BottomSheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0F1F3F] px-5 pt-3 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>
  );
}
