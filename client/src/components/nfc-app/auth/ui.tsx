import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Editorial class kit for the auth screens (same tokens as ../ui.tsx).
export const cardClass = 'rounded-none border border-white/10 bg-navy-800';
export const inputClass =
  'min-h-12 w-full rounded-none border border-white/10 bg-navy-900 px-4 text-base text-fog-50 placeholder:text-fog-400 [color-scheme:dark] focus:border-cta-soft focus:outline-none';
export const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.24em] text-cta-soft';
export const eyebrowMutedClass = 'text-xs font-bold uppercase tracking-[0.2em] text-fog-400';
export const titleClass = 'text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-fog-50';
export const iconBlockClass = 'flex shrink-0 items-center justify-center rounded-none border border-cta/30 bg-cta/15 text-cta-soft';

/** Full-bleed navy-900 grid band that opens every screen (header + title). */
export function HeroBand({ children }: { children: ReactNode }) {
  return (
    <div
      className="border-b border-white/10 bg-navy-900 pattern-grid-dark"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 pb-6">{children}</div>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; icon?: ReactNode };

/** Primary: blue pill. */
export function CtaButton({ busy, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-cta px-6 font-bold text-white transition-colors hover:bg-cta-hover disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Secondary on dark: off-white pill. */
export function SecondaryButton({ busy, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-fog-50 px-6 font-semibold text-ink transition-colors hover:bg-fog-200 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Tertiary: outline pill. */
export function GhostButton({ busy, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-fog-50 transition-colors hover:bg-white/10 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
