import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";

/** Every SaaS platform, in full. /portfolio shows the same list with a "See all" link. */
export default function Apps() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Platforms"), description: t("Subscription-based online software for booking, content, websites, CRM and sales. Choose a platform and get started.") });

  return (
    <CatalogPageShell source="apps">
      {({ apps, buttonText, openItem, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Platforms")}
            title={t("Tools to sell more and work less")}
            subtitle={t("Subscription-based online platforms for booking, content, websites, CRM and sales, designed to simplify daily work and help your business grow.")}
            buttonText={buttonText}
            onCta={() => openForm("hero")}
          />
          <PortfolioApps apps={apps} onOpen={openItem("apps")} source="apps" hideHeading />
          {cta}
        </>
      )}
    </CatalogPageShell>
  );
}
