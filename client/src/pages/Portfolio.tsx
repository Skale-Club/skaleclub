import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioApps } from "@/components/portfolio/PortfolioApps";
import { PortfolioPillars } from "@/components/portfolio/PortfolioPillars";
import { PortfolioServices } from "@/components/portfolio/PortfolioServices";
import { PortfolioCta } from "@/components/portfolio/PortfolioCta";
import { Loader2 } from "@/components/ui/loader";

type ListKey = "apps" | "services";

export default function Portfolio() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Our Solutions"), description: t("Ready-made apps and the services we perform: AI, automation, websites, marketing and more.") });

  const { data: companySettings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const { data: portfolioServices, isLoading } = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const content = companySettings?.homepageContent;
  const apps = useMemo(() => catalogProducts(portfolioServices), [portfolioServices]);
  const services = useMemo(() => catalogServices(content?.ourServicesSection?.cards), [content?.ourServicesSection?.cards]);
  const lists: Record<ListKey, CatalogItem[]> = { apps, services };

  const [open, setOpen] = useState<{ list: ListKey; index: number } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openItem = (list: ListKey) => (item: CatalogItem) => {
    const index = lists[list].findIndex((i) => i.key === item.key);
    if (index >= 0) setOpen({ list, index });
  };
  const openForm = (source: string) => {
    setOpen(null);
    setIsFormOpen(true);
    // LeadFormModal has no hidden-answer support yet, so the product a lead
    // asked about is parked in sessionStorage for it (or the backend) to read.
    try {
      if (source === "hero" || source === "footer" || source === "mobile-bar") sessionStorage.removeItem("leadContext");
      else sessionStorage.setItem("leadContext", source);
    } catch {
      /* storage unavailable */
    }
    trackCTAClick(`portfolio-${source}`, source);
  };

  // The mobile action bar defers to this page's modal instead of mounting a second one.
  useEffect(() => {
    const onLeadFormOpen = (event: Event) => {
      event.preventDefault();
      openForm("mobile-bar");
    };
    document.addEventListener("lead-form:open", onLeadFormOpen);
    return () => document.removeEventListener("lead-form:open", onLeadFormOpen);
    // openForm only touches stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-surface-dark text-white">
        <Loader2 className="w-8 h-8 animate-spin text-cta-soft" />
        <span className="sr-only">{t("Loading...")}</span>
      </div>
    );
  }

  const hero = content?.portfolioHero;
  const cta = content?.portfolioCtaSection;
  const heroTitle = t(hero?.title || "Stop Doing Repetitive Work. Automate It.");
  const buttonText = t(hero?.buttonText || "Book a Strategy Session");
  const phone = companySettings?.companyPhone?.trim() || undefined;

  return (
    <div className="min-h-screen overflow-x-hidden bg-navy-950 text-fog-200 [color-scheme:dark]">
      <PortfolioHero
        badge={t(hero?.badge || "Our Solutions")}
        title={heroTitle}
        subtitle={t(hero?.subtitle || "Explore the tools and services we've built to help businesses grow.")}
        buttonText={buttonText}
        onCta={() => openForm("hero")}
      />
      <PortfolioApps apps={apps} onOpen={openItem("apps")} />
      <PortfolioPillars />
      <PortfolioServices services={services} onOpen={openItem("services")} />
      <PortfolioCta
        title={t(cta?.title || "Ready to Redefine Your Potential?")}
        subtitle={cta?.subtitle ? t(cta.subtitle) : undefined}
        buttonText={t(cta?.buttonText || "Book a Strategy Session")}
        phone={phone}
        onCta={() => openForm("footer")}
      />

      <CatalogDetail
        items={open ? lists[open.list] : []}
        index={open?.index ?? null}
        onIndexChange={(index) => setOpen((o) => (o ? { ...o, index } : o))}
        onClose={() => setOpen(null)}
        onCta={(item) => openForm(item.slug ?? item.key)}
      />
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
    </div>
  );
}
