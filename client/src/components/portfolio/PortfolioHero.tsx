import { ArrowRight } from "lucide-react";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";

/**
 * Archive-page header for /portfolio, /apps, /services and /products: a short
 * band (title, one line, the call to action beside it on desktop) so the
 * catalog itself starts above the fold.
 */
export function PortfolioHero({
  badge,
  title,
  subtitle,
  buttonText,
  onCta,
  secondary,
}: {
  badge: string;
  title: string;
  subtitle: string;
  buttonText: string;
  onCta: () => void;
  /** Optional ghost link next to the main button. */
  secondary?: { href: string; label: string };
}) {
  return (
    <Band tone="hero" pattern containerClassName="page-top pb-10 sm:pb-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div>
          <Eyebrow>{badge}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-fog-50 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-fog-400 sm:text-lg">{subtitle}</p>
        </div>
        {/* Phones already carry the quote button in the fixed bottom bar
            (MobileActionBar), so the header stays just the title there. */}
        <div className="hidden shrink-0 gap-3 sm:flex sm:flex-row">
          <PillButton variant="primary" onClick={onCta}>
            {buttonText}
            <ArrowRight className="h-4 w-4" />
          </PillButton>
          {secondary && <PillLink href={secondary.href} variant="ghost">{secondary.label}</PillLink>}
        </div>
      </div>
    </Band>
  );
}
