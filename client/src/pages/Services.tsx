import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioPillars } from "@/components/portfolio/PortfolioPillars";
import { PortfolioServices } from "@/components/portfolio/PortfolioServices";

/** Every service we perform, in full. /portfolio shows the same list with a "See all" link. */
export default function Services() {
  const { t } = useTranslation();
  usePageSeo({
    title: t("Services"),
    description: t("Marketing and technology services tailored to your business: AI, automation, websites and more."),
  });

  return (
    <CatalogPageShell source="services">
      {({ services, buttonText, openItem, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Services")}
            title={t("Built by us, for your business")}
            subtitle={t("Tailored marketing and technology, quoted for your case.")}
            buttonText={buttonText}
            onCta={() => openForm("hero")}
          />
          <PortfolioPillars />
          <PortfolioServices services={services} onOpen={openItem("services")} hideHeading />
          {cta}
        </>
      )}
    </CatalogPageShell>
  );
}
