import type { MouseEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface PracticalBlockProps {
  title: string;
  subtitle: string;
  bullets: string[];
  nextStepLabel: string;
  nextStepText: string;
  ctaHref: string;
  ctaLabel: string;
  helperText?: string | null;
  onCtaClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export function PracticalBlock({
  title,
  subtitle,
  bullets,
  nextStepLabel,
  nextStepText,
  ctaHref,
  ctaLabel,
  helperText,
  onCtaClick,
}: PracticalBlockProps) {
  const { t } = useTranslation();

  return (
    <div className="container-custom mx-auto px-4 sm:px-6 md:px-10 grid gap-6 lg:grid-cols-[2fr_1fr] items-stretch -mt-6 md:-mt-10">
      <div className="rounded-3xl bg-white/90 border shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 space-y-4 h-full">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 min-w-[44px] flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{t(title)}</p>
            <p className="text-sm text-slate-500">{t(subtitle)}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {bullets.map((bullet, idx) => (
            <div
              key={`${bullet}-${idx}`}
              className="p-4 rounded-2xl bg-slate-50/90 border shadow-sm"
            >
              <p className="text-sm text-slate-700 leading-relaxed">{t(bullet)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white/95 border shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 flex flex-col gap-4 justify-center h-full">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.12em]">{t(nextStepLabel)}</p>
          <p className="text-xl font-bold text-slate-900 leading-tight">{t(nextStepText)}</p>
        </div>
        <a
          href={ctaHref}
          onClick={onCtaClick}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#406EF1] hover:bg-[#355CD0] text-white font-semibold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#406EF1] whitespace-nowrap"
          data-form-trigger="lead-form"
        >
          {t(ctaLabel)}
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
        </a>
        {helperText && <p className="text-sm text-slate-600 leading-relaxed">{t(helperText)}</p>}
      </div>
    </div>
  );
}
