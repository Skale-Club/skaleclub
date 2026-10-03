import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ClipboardPaste, Copy, Loader2, type LucideIcon } from 'lucide-react';
import { copyToClipboard, haptic, readClipboard } from './lib';

export type Identity = 'skale' | 'direct';

// ─── Class kit (editorial design language, shared by every NFC app screen) ────

export const CARD = 'rounded-none border border-white/10 bg-navy-800';
export const INPUT =
  'w-full min-h-[48px] rounded-none border border-white/10 bg-navy-900 px-4 text-base text-fog-50 placeholder:text-fog-400 [color-scheme:dark] focus:border-cta-soft focus:outline-none';
/** Class for native <option> so dropdown lists render on a dark surface. */
export const OPTION = 'bg-navy-900 text-fog-50';
export const BTN_PRIMARY =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-bold text-white transition-colors hover:bg-cta-hover active:bg-cta-hover disabled:opacity-50';
/** Secondary on dark: off-white pill. */
export const BTN_SECONDARY =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-fog-50 px-5 text-base font-semibold text-ink transition-colors active:bg-fog-200 disabled:opacity-50';
/** Tertiary: outline pill. */
export const BTN_TERTIARY =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-base font-semibold text-fog-50 transition-colors active:bg-white/10 disabled:opacity-50';
/** Emerald primary, only for the customer direct-link identity. */
export const BTN_DIRECT =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-base font-bold text-white transition-colors hover:bg-emerald-600 active:bg-emerald-600 disabled:opacity-50';
export const EYEBROW = 'text-xs font-bold uppercase tracking-[0.24em] text-cta-soft';
export const EYEBROW_MUTED = 'text-xs font-bold uppercase tracking-[0.2em] text-fog-400';
export const SHEET_TITLE = 'text-2xl font-semibold leading-[1.1] tracking-[-0.025em] text-fog-50';
/** Square icon blocks for tiles and list rows (Skale = blue, direct link = emerald). */
export const ICON_BLOCK_SKALE = 'flex shrink-0 items-center justify-center rounded-none border border-cta/30 bg-cta/15 text-cta-soft';
export const ICON_BLOCK_DIRECT =
  'flex shrink-0 items-center justify-center rounded-none border border-emerald-400/30 bg-emerald-400/10 text-emerald-400';

const SAFE_X = { paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' } as const;

/**
 * Full-height navy app frame with safe areas. `hero` renders in the full-bleed
 * grid band at the top (header + screen title); children sit below it.
 */
export function Screen({ children, hero }: { children: ReactNode; hero?: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-navy-950 font-sans text-fog-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {hero && (
        <div className="border-b border-white/10 bg-navy-900 pattern-grid-dark" style={{ paddingTop: 'env(safe-area-inset-top)', ...SAFE_X }}>
          <div className="mx-auto w-full max-w-md px-4 pb-6">{hero}</div>
        </div>
      )}
      <div style={hero ? SAFE_X : { paddingTop: 'env(safe-area-inset-top)', ...SAFE_X }}>
        <div className="mx-auto w-full max-w-md px-4 pb-10 pt-5">{children}</div>
      </div>
    </div>
  );
}

/** Hero content: back button row, eyebrow and a large tight title. Pass it as `Screen`'s `hero`. */
export function TopBar({
  title,
  back = '/nfc/home',
  right,
  eyebrow = 'Skale NFC',
  identity,
}: {
  title: string;
  back?: string | null;
  right?: ReactNode;
  eyebrow?: string;
  /** Colours the eyebrow with the piece's identity (blue Skale / emerald direct). */
  identity?: Identity;
}) {
  return (
    <header>
      <div className="flex min-h-[64px] items-center gap-2">
        {back && (
          <Link
            href={back}
            aria-label="Voltar"
            className="-ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-fog-50 active:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
        )}
        <div className="flex-1" />
        {right}
      </div>
      <p className={identity === 'direct' ? EYEBROW.replace('text-cta-soft', 'text-emerald-400') : EYEBROW}>{eyebrow}</p>
      <h1 className="mt-3 break-words text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-fog-50">{title}</h1>
    </header>
  );
}

/** Editorial tile for the big home actions: square icon, title, one line, arrow. */
export function ActionTile({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  primary,
  compact,
  iconClassName,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  /** Secondary actions: shorter tile, smaller title. */
  compact?: boolean;
  /** Icon colour on non-primary tiles (default: the Skale accent). */
  iconClassName?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`flex ${compact ? 'min-h-[68px]' : 'min-h-[88px]'} w-full items-center gap-4 rounded-none border p-4 text-left transition-colors disabled:opacity-60 ${
        primary ? 'border-cta bg-cta text-white active:bg-cta-hover' : 'border-white/10 bg-navy-800 text-fog-50 active:bg-navy-700'
      }`}
    >
      <span
        className={`flex ${compact ? 'h-11 w-11' : 'h-14 w-14'} shrink-0 items-center justify-center rounded-none ${
          primary ? 'bg-white/15 text-white' : `border border-white/10 bg-navy-900 ${iconClassName ?? 'text-cta-soft'}`
        }`}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold tracking-[-0.02em] ${compact ? 'text-base' : 'text-xl'}`}>{title}</span>
        <span className={`block text-sm ${primary ? 'text-white/80' : 'text-fog-400'}`}>{description}</span>
      </span>
      <ArrowRight className={`h-5 w-5 shrink-0 ${primary ? 'text-white' : 'text-fog-400'}`} />
    </button>
  );
}

export function Banner({ banner }: { banner: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!banner) return null;
  const ok = banner.tone === 'ok';
  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-2 rounded-none border px-4 py-3 text-sm font-medium ${
        ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-red-400/30 bg-red-400/10 text-red-100'
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
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${
        skale ? 'bg-cta/15 text-cta-soft' : 'bg-emerald-400/10 text-emerald-400'
      }`}
    >
      {skale ? 'Tag Skale' : 'Link direto do cliente'}
    </span>
  );
}

/** Card with a coloured top rule that tells the operator which kind of piece this is. */
export function IdentityHeader({ kind, children }: { kind: Identity; children: ReactNode }) {
  const skale = kind === 'skale';
  return (
    <section className={`rounded-none border border-t-2 border-white/10 bg-navy-800 p-5 ${skale ? 'border-t-cta' : 'border-t-emerald-400'}`}>
      {children}
    </section>
  );
}

export function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-emerald-400/10 text-emerald-300',
    amber: 'bg-amber-400/10 text-amber-300',
    red: 'bg-red-400/10 text-red-300',
    slate: 'bg-white/10 text-fog-300',
    blue: 'bg-cta/15 text-cta-soft',
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
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-fog-50 active:bg-white/10"
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
        copied ? 'bg-emerald-500' : 'bg-cta hover:bg-cta-hover active:bg-cta-hover'
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
        className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-semibold text-fog-50 active:bg-white/10"
      >
        <ClipboardPaste className="h-4 w-4" />
        Colar
      </button>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={`mb-1.5 block ${EYEBROW_MUTED}`}>{children}</label>;
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
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-navy-950/80" />
      <div
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-none border border-b-0 border-white/10 bg-navy-800 px-5 pt-3 duration-200 animate-in slide-in-from-bottom"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>
  );
}
