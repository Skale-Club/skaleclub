import { ArrowRight, MessageCircle } from "lucide-react";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackEvent } from "@/lib/analytics";

export function PortfolioCta({
  title,
  subtitle,
  buttonText,
  phone,
  onCta,
}: {
  title: string;
  subtitle?: string;
  buttonText: string;
  phone?: string;
  onCta: () => void;
}) {
  const { t } = useTranslation();
  const whatsappLink = useSiteWhatsappHref(phone);
  return (
    <Band tone="cta" id="cta">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <Eyebrow className="tracking-[0.22em] text-cta-softer">{t("Next step")}</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-fog-50 sm:text-5xl">{title}</h2>
          {subtitle && <p className="mt-4 max-w-2xl text-sm leading-6 text-fog-300">{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <PillButton variant="primary" onClick={onCta}>
            {buttonText}
            <ArrowRight className="h-4 w-4" />
          </PillButton>
          {phone && (
            <PillLink
              href={whatsappLink}
              target="_blank"
              variant="ghost"
              onClick={() => trackEvent("click_whatsapp", { location: "portfolio_cta" })}
            >
              <MessageCircle className="h-4 w-4" />
              {t("Talk on WhatsApp")}
            </PillLink>
          )}
        </div>
      </div>
    </Band>
  );
}
