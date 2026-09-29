import { ArrowRight } from "lucide-react";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";

export function PortfolioHero({
  badge,
  title,
  subtitle,
  buttonText,
  onCta,
}: {
  badge: string;
  title: string;
  subtitle: string;
  buttonText: string;
  onCta: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Band tone="hero" pattern containerClassName="page-top pb-16 sm:pb-24">
      <Eyebrow>{badge}</Eyebrow>
      <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50 sm:text-6xl lg:text-7xl">
        {title}
      </h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-fog-400 sm:text-xl">{subtitle}</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <PillButton variant="primary" onClick={onCta}>
          {buttonText}
          <ArrowRight className="h-4 w-4" />
        </PillButton>
        <PillLink href="#apps" variant="ghost">{t("See the apps")}</PillLink>
      </div>
    </Band>
  );
}
