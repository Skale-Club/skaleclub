import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";

/** Every ready-made app, in full. /portfolio shows the same list with a "See all" link. */
export default function Apps() {
  const { t } = useTranslation();
  usePageSeo({ core: "apps" });

  return (
    <CatalogPageShell source="apps">
      {({ apps, buttonText, openItem, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Apps")}
            title={t("Tools to sell more and work less")}
            subtitle={t("Booking, content, website, CRM and sales solutions that simplify your day-to-day and help your business grow.")}
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
