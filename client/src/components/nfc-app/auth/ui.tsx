import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const cardClass = 'rounded-2xl border border-white/10 bg-white/5';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; icon?: ReactNode };

export function CtaButton({ busy, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 font-bold text-white transition-colors hover:bg-[#3B5BBE] disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function GhostButton({ busy, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
