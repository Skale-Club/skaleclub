import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";

/** Platform catalog. /portfolio shows the same list with a "See all" link. */
export default function Apps() {
  const { t } = useTranslation();
  usePageSeo({ core: "apps" });

  return (
    <CatalogPageShell source="apps">
      {({ apps, buttonText, openItem, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Platforms")}
            title={t("Tools to sell more and work less")}
            subtitle={t("Explore Skale Club platforms for your business and everyday work.")}
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
