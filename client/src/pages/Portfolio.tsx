import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Magnet, Target } from "lucide-react";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { CATALOG_CATEGORY_LABEL, catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { AppBlocks } from "@/components/portfolio/AppBlocks";
import { AppStrip } from "@/components/portfolio/AppStrip";
import { FinalCta } from "@/components/portfolio/FinalCta";
import { Loader2 } from "@/components/ui/loader";
import { getImageUrl } from "@/components/admin/shared/utils";
import "./portfolio.css";
import "./portfolio-sections.css";

type ListKey = "apps" | "services";

/** The three things we solve. Page copy, not the home's trust badges. */
const PILLARS = [
  { icon: Target, title: "Prospect", desc: "Find the right businesses and reach them first" },
  { icon: Magnet, title: "Attract", desc: "Get found online and stay active where customers look" },
  { icon: Handshake, title: "Convert", desc: "Follow up, book and quote before the lead goes cold" },
] as const;

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
    trackCTAClick(`portfolio-${source}`, companySettings?.ctaText || "Book Call");
  };

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
  const whatsapp = companySettings?.companyPhone?.replace(/\D/g, "");

  const covers = apps.map((a) => a.cover).filter((c): c is string => !!c);
  const reelItems = covers.length >= 3 ? [...covers, ...covers] : [];

  return (
    <div className="pf-page text-white min-h-screen overflow-x-hidden">
      {/* ============ HERO ============ */}
      <section className="pf-hero page-top">
        <div className="pf-hero__copy container-custom container-page mx-auto">
          <div className="inline-flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-cta-soft">
            <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-cta" />
            {t(hero?.badge || "Our Solutions")}
          </div>
          <h1 className="pf-hero__title">{heroTitle}</h1>
          <p className="pf-hero__sub">{t(hero?.subtitle || "Explore the tools and services we've built to help businesses grow.")}</p>
          <div className="pf-hero__actions">
            <button
              type="button"
              onClick={() => openForm("hero")}
              className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-4 font-bold text-white transition-colors hover:bg-cta-hover"
            >
              {buttonText} <span aria-hidden="true">→</span>
            </button>
            <a href="#apps" className="pf-hero__ghost">{t("See the apps")} <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        {/* Every app home, equal size, looped. Decorative: the strip below and
            the blocks further down are the real, keyboard-reachable entries. */}
        {reelItems.length > 0 && (
          <div className="pf-reel" aria-hidden="true">
            <div className="pf-reel__track">
              {reelItems.map((src, i) => (
                <span key={`${src}-${i}`} className="pf-reel__shot">
                  <img src={getImageUrl(src, { width: 720, quality: 80 })} alt="" loading="eager" decoding="async" />
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ APP STRIP + PILLARS ============ */}
      <AppStrip apps={apps} onOpen={openItem("apps")} />
      <div className="pf-trust">
        <div className="container-custom container-page mx-auto pf-trust__row">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="pf-trust__item">
              <Icon aria-hidden="true" />
              <div>
                <div className="pf-trust__title">{t(title)}</div>
                <div className="pf-trust__desc">{t(desc)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ APPS ============ */}
      {apps.length > 0 && (
        <section id="apps" className="pt-16 sm:pt-24 lg:pt-28 scroll-mt-24">
          <div className="container-custom container-page mx-auto">
            <SectionHeading
              eyebrow="01 · Apps"
              title="Software ready to use"
              subtitle="Our own products, live today, with a fixed price. Subscribe and start."
              size="display"
            />
            <AppBlocks apps={apps} onOpen={openItem("apps")} />
          </div>
        </section>
      )}

      {/* ============ SERVICES ============ */}
      {services.length > 0 && (
        <section id="services" className="pt-16 sm:pt-24 lg:pt-28 scroll-mt-24">
          <div className="container-custom container-page mx-auto">
            <SectionHeading
              eyebrow="02 · Services"
              title="Built by us, for your business"
              subtitle="Tailored marketing and technology, quoted for your case."
              size="display"
            />

            <div className="pf-tiles">
              {services.map((item) => {
                const eyebrow = item.category ? t(CATALOG_CATEGORY_LABEL[item.category]) : undefined;
                const description = item.subtitle ?? item.description;
                return (
                  <button key={item.key} type="button" className="pf-tile" onClick={() => openItem("services")(item)}>
                    {item.cover ? (
                      <img src={getImageUrl(item.cover, { width: 720, quality: 80 })} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="pf-tile__word">{t(item.title)}</span>
                    )}
                    <span className="pf-tile__scrim" />
                    <span className="pf-tile__body">
                      {eyebrow && <span className="pf-tile__cat">{eyebrow}</span>}
                      <span className="pf-tile__title">{t(item.title)}</span>
                      <span className="pf-tile__reveal">
                        {description && <span className="pf-tile__desc">{t(description)}</span>}
                        <span className="pf-tile__go">{t("See details")} →</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <FinalCta
        title={t(cta?.title || "Ready to Redefine Your Potential?")}
        subtitle={cta?.subtitle ? t(cta.subtitle) : undefined}
        buttonText={t(cta?.buttonText || "Book a Strategy Session")}
        whatsapp={whatsapp}
        screens={covers}
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
