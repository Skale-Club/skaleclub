import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";

/** Every ready-made app, in full. /portfolio shows the same list with a "See all" link. */
export default function Apps() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Apps"), description: t("Ready-made apps we build and run, each with a fixed price. Subscribe and start.") });

  return (
    <CatalogPageShell source="apps">
      {({ apps, buttonText, openItem, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Apps")}
            title={t("Apps we build and run")}
            subtitle={t("Our own products, live today, with a fixed price. Subscribe and start.")}
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
