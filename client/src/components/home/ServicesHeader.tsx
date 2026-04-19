import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ServicesHeaderProps {
  tagLabel: string;
  title: string;
  subtitle?: string;
}

export function ServicesHeader({ tagLabel, title, subtitle }: ServicesHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="container-custom mx-auto px-4 sm:px-6 md:px-10">
      <div className="max-w-4xl space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 border rounded-full shadow-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>{t(tagLabel)}</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
          {t(title)}
        </h2>
        {subtitle && (
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
            {t(subtitle)}
          </p>
        )}
      </div>
    </div>
  );
}
