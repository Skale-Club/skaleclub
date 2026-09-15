import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The one section header for the public site.
 *
 * Before this, every section invented its own: ServicesHeader used a Sparkles
 * chip with a `text-primary` icon, About and Areas Served used chips in
 * `text-blue-300`, Our Services had no eyebrow at all, and Reviews centred
 * itself while everything else was left-aligned. Four treatments, three blues,
 * two alignments — which is most of why the page reads as assembled rather
 * than designed.
 *
 * The eyebrow is the only place the brand accent appears above the fold apart
 * from the CTA button, so it carries `cta` deliberately.
 */
export interface SectionHeadingProps {
  /** Small label above the title. Omitted when absent — no empty chip. */
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** `dark` is the public site's default; `light` is for pages on paper-white. */
  tone?: 'dark' | 'light';
  align?: 'left' | 'center';
  /** Width cap for the text column. */
  className?: string;
}

export function SectionHeading({
  eyebrow,
  icon: Icon,
  title,
  subtitle,
  tone = 'dark',
  align = 'left',
  className,
}: SectionHeadingProps) {
  const { t } = useTranslation();
  const centered = align === 'center';

  return (
    <div
      className={`max-w-4xl ${centered ? 'mx-auto text-center' : ''} ${className ?? ''}`}
    >
      {eyebrow && (
        <div
          className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cta`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{t(eyebrow)}</span>
        </div>
      )}

      <h2
        className={`font-display text-3xl md:text-4xl font-bold leading-tight ${
          eyebrow ? 'mt-3' : ''
        } ${tone === 'dark' ? 'text-white' : 'text-foreground'}`}
      >
        {t(title)}
      </h2>

      {/* Short rule under every title: the cheapest way to make a stack of
          sections read as one family. */}
      <div
        className={`mt-4 h-[3px] w-14 rounded-full bg-cta ${centered ? 'mx-auto' : ''}`}
        aria-hidden="true"
      />

      {subtitle && (
        <p
          className={`mt-4 text-lg md:text-xl leading-relaxed ${
            tone === 'dark' ? 'text-slate-300' : 'text-muted-foreground'
          }`}
        >
          {t(subtitle)}
        </p>
      )}
    </div>
  );
}
