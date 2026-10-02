import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";
import { PortfolioPillars } from "@/components/portfolio/PortfolioPillars";
import { PortfolioServices } from "@/components/portfolio/PortfolioServices";
import { PortfolioProducts } from "@/components/portfolio/PortfolioProducts";

/** The umbrella: a taste of each category, with "See all" into its own page. */
export default function Portfolio() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Our Solutions"), description: t("Ready-made apps and the services we perform: AI, automation, websites, marketing and more.") });

  return (
    <CatalogPageShell source="portfolio">
      {({ content, apps, services, buttonText, openItem, openForm, cta }) => {
        const hero = content?.portfolioHero;
        return (
          <>
            <PortfolioHero
              badge={t(hero?.badge || "Our Solutions")}
              title={t(hero?.title || "Stop Doing Repetitive Work. Automate It.")}
              subtitle={t(hero?.subtitle || "Explore the tools and services we've built to help businesses grow.")}
              buttonText={buttonText}
              onCta={() => openForm("hero")}
              secondary={{ href: "#apps", label: t("See the apps") }}
            />
            <PortfolioApps apps={apps} onOpen={openItem("apps")} source="portfolio" seeAllHref="/apps" />
            <PortfolioPillars />
            <PortfolioServices services={services} onOpen={openItem("services")} seeAllHref="/services" />
            <PortfolioProducts seeAllHref="/products" />
            {cta}
          </>
        );
      }}
    </CatalogPageShell>
  );
}
