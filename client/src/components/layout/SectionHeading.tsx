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
  /** `display` is the big editorial title (portfolio sections): the jump from
   *  eyebrow to title has to read from across the room. */
  size?: 'default' | 'display';
  /** `classic` is the original look; `editorial` is the NFC-guide look
   *  (tokens from the editorial kit, no rule bar). */
  variant?: 'classic' | 'editorial';
  /** Heading element to render. */
  as?: 'h1' | 'h2' | 'h3';
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
  size = 'default',
  variant = 'classic',
  as: Heading = 'h2',
  className,
}: SectionHeadingProps) {
  const { t } = useTranslation();
  const centered = align === 'center';

  if (variant === 'editorial') {
    const light = tone === 'light';
    return (
      <div className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''} ${className ?? ''}`}>
        {eyebrow && (
          <p
            className={`text-xs font-bold uppercase tracking-[0.24em] ${
              Icon ? 'inline-flex items-center gap-2' : ''
            } ${light ? 'text-cta-ink' : 'text-cta-soft'}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{t(eyebrow)}</span>
          </p>
        )}
        <Heading
          className={`${eyebrow ? 'mt-4' : ''} font-display text-4xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-5xl ${
            light ? 'text-ink' : 'text-fog-50'
          }`}
        >
          {t(title)}
        </Heading>
        {subtitle && (
          <p
            className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${centered ? 'mx-auto' : ''} ${
              light ? 'text-ink-500' : 'text-fog-400'
            }`}
          >
            {t(subtitle)}
          </p>
        )}
      </div>
    );
  }

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

      <Heading
        className={`font-display ${
          size === 'display'
            ? 'text-[clamp(2.25rem,5vw,4rem)] font-extrabold leading-[0.98] tracking-[-0.03em]'
            : 'text-3xl md:text-4xl font-bold leading-tight'
        } ${
          eyebrow ? 'mt-3' : ''
        } ${tone === 'dark' ? 'text-white' : 'text-foreground'}`}
      >
        {t(title)}
      </Heading>

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
