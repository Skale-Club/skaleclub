import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { EditorialCard } from '@/components/editorial';

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

export const StepCard = memo(function StepCard({ step, index, stepLabel, whatWeDoLabel, outcomeLabel }: StepCardProps) {
  const { t } = useTranslation();
  const numberLabel = step.numberLabel || String(index + 1).padStart(2, '0');

  return (
    <EditorialCard
      tone="light"
      className="group relative flex-shrink-0 w-full sm:w-[70%] md:w-[52%] tablet:w-[365px] transition-colors duration-300 hover:border-cta-ink/30 p-0 sm:p-0"
    >
      <div className="absolute right-4 top-3 font-display text-6xl font-semibold text-ink/[0.06] pointer-events-none">
        {numberLabel}
      </div>
      <div className="relative z-10 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 min-w-12 flex-shrink-0 rounded-full bg-cta-ink/10 text-cta-ink flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cta-ink">{t(stepLabel)} {numberLabel}</p>
            <h3 className="font-display text-2xl font-semibold leading-tight text-ink">{t(step.title)}</h3>
          </div>
        </div>
        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t(whatWeDoLabel)}</p>
            <p className="leading-relaxed text-ink-500">{t(step.whatWeDo)}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cta-ink">{t(outcomeLabel)}</p>
            <p className="font-medium leading-relaxed text-ink">{t(step.outcome)}</p>
          </div>
        </div>
      </div>
    </EditorialCard>
  );
});
