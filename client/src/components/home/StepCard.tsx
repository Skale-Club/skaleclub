import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export interface StepItem {
  numberLabel?: string;
  title: string;
  whatWeDo: string;
  outcome: string;
  order?: number;
}

interface StepCardProps {
  step: StepItem;
  index: number;
  stepLabel: string;
  whatWeDoLabel: string;
  outcomeLabel: string;
}

export function StepCard({ step, index, stepLabel, whatWeDoLabel, outcomeLabel }: StepCardProps) {
  const { t } = useTranslation();
  const numberLabel = step.numberLabel || String(index + 1).padStart(2, '0');

  return (
    <div
      className="group relative overflow-visible rounded-3xl bg-white/90 border shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:-translate-y-2 hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)] transition-all duration-300 backdrop-blur flex-shrink-0 w-full md:w-[88%] sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
    >
      <div className="absolute right-4 top-3 text-6xl font-black text-slate-100/80 pointer-events-none">
        {numberLabel}
      </div>
      <div className="relative z-10 p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 min-w-12 flex-shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">{t(stepLabel)} {numberLabel}</p>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{t(step.title)}</h3>
            </div>
          </div>
        </div>
        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(whatWeDoLabel)}</p>
            <p className="text-slate-700 leading-relaxed">{t(step.whatWeDo)}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t(outcomeLabel)}</p>
            <p className="text-slate-900 leading-relaxed font-medium">{t(step.outcome)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
