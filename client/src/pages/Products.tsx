import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { CatalogPageShell } from "@/components/portfolio/CatalogPageShell";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioProducts } from "@/components/portfolio/PortfolioProducts";

/**
 * Every product we make, in full: the same archive page as /apps and /services.
 * Each card links to its own managed landing under /products/<slug>.
 */
export default function Products() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Products"), description: t("Things we 3D print for your counter: an NFC review plaque and custom NFC keychains.") });

  return (
    <CatalogPageShell source="products">
      {({ buttonText, openForm, cta }) => (
        <>
          <PortfolioHero
            badge={t("Products")}
            title={t("One tap, more customers")}
            subtitle={t("NFC plaques and keychains that open your Google reviews, Instagram or menu. Made by us, ready to use.")}
            buttonText={buttonText}
            onCta={() => openForm("hero")}
          />
          <PortfolioProducts hideHeading />
          {cta}
        </>
      )}
    </CatalogPageShell>
  );
}
