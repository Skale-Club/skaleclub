import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ServicesHeaderProps {
  tagLabel: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}

export function ServicesHeader({ tagLabel, title, subtitle, dark = false }: ServicesHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="container-custom mx-auto px-4 sm:px-6 md:px-10">
      <div className="max-w-4xl space-y-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1 border rounded-full shadow-sm text-[11px] font-semibold uppercase tracking-[0.08em] ${dark ? 'bg-white/10 border-white/10 text-white/80' : 'bg-white/70 text-slate-600'}`}>
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>{t(tagLabel)}</span>
        </div>
        <h2 className={`text-3xl md:text-4xl font-bold leading-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
          {t(title)}
        </h2>
        {subtitle && (
          <p className={`text-lg md:text-xl leading-relaxed ${dark ? 'text-white/70' : 'text-slate-600'}`}>
            {t(subtitle)}
          </p>
        )}
      </div>
    </div>
  );
}
