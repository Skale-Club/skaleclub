import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { PortfolioCta } from "@/components/portfolio/PortfolioCta";
import { Loader2 } from "@/components/ui/loader";

type ListKey = "apps" | "services";

export interface CatalogPageContext {
  content: CompanySettings["homepageContent"] | undefined;
  apps: CatalogItem[];
  services: CatalogItem[];
  /** Label of the primary call to action (hero button). */
  buttonText: string;
  openItem: (list: ListKey) => (item: CatalogItem) => void;
  openForm: (source: string) => void;
  /** The closing call-to-action band, wired to this page's lead form. */
  cta: ReactNode;
}

/**
 * Everything /portfolio, /apps and /services share: the two catalog queries,
 * the loading screen, the details popup, the lead form and the mobile bar's
 * `lead-form:open` hand-off. A page only picks its sections.
 *
 * `source` prefixes the analytics name of every call to action
 * (`portfolio-hero`, `apps-hero`, `services-footer`...).
 */
export function CatalogPageShell({ source, children }: { source: string; children: (page: CatalogPageContext) => ReactNode }) {
  const { t } = useTranslation();

  const { data: companySettings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const { data: portfolioServices, isLoading } = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    staleTime: 0,
    refetchOnMount: true,
    // The navbar fetches the same list; a failure it cached must not leave the page empty.
    retryOnMount: true,
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
  const openForm = (ctaSource: string) => {
    setOpen(null);
    setIsFormOpen(true);
    // LeadFormModal has no hidden-answer support yet, so the product a lead
    // asked about is parked in sessionStorage for it (or the backend) to read.
    try {
      if (ctaSource === "hero" || ctaSource === "footer" || ctaSource === "mobile-bar") sessionStorage.removeItem("leadContext");
      else sessionStorage.setItem("leadContext", ctaSource);
    } catch {
      /* storage unavailable */
    }
    trackCTAClick(`${source}-${ctaSource}`, ctaSource);
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

  const cta = content?.portfolioCtaSection;
  const buttonText = t(content?.portfolioHero?.buttonText || "Book a Strategy Session");
  const phone = companySettings?.companyPhone?.trim() || undefined;

  return (
    <div className="min-h-screen overflow-x-hidden bg-navy-950 text-fog-200 [color-scheme:dark]">
      {children({
        content,
        apps,
        services,
        buttonText,
        openItem,
        openForm,
        cta: (
          <PortfolioCta
            title={t(cta?.title || "Ready to Redefine Your Potential?")}
            subtitle={cta?.subtitle ? t(cta.subtitle) : undefined}
            buttonText={t(cta?.buttonText || "Book a Strategy Session")}
            phone={phone}
            onCta={() => openForm("footer")}
          />
        ),
      })}

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
