import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { CATALOG_CATEGORY_LABEL, catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Cover } from "@/components/catalog/Cover";
import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { badgeIconMap } from "@/components/home/TrustBadges";
import { Loader2 } from "@/components/ui/loader";
import { getImageUrl } from "@/components/admin/shared/utils";
import "./portfolio.css";

type ListKey = "apps" | "services";

/** A direct, top-aligned crop of a product screenshot. */
function PfScreenshot({
  src,
  alt,
  loading = "lazy",
  className = "",
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
  className?: string;
}) {
  return (
    <span className={`pf-shot ${className}`}>
      <img src={src} alt={alt} loading={loading} decoding="async" />
    </span>
  );
}

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
  const trustBadges = content?.trustBadges ?? [];

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

  const reelApps = apps.filter((a) => a.cover);
  const reelItems = reelApps.length >= 3 ? [...reelApps, ...reelApps] : [];

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
          </div>
        </div>

        {/* All apps with a cover, equal size, looped. Decorative — the same
            apps are the real, keyboard-reachable buttons in the section below. */}
        {reelItems.length > 0 && (
          <div className="pf-reel" aria-hidden="true">
            <div className="pf-reel__track">
              {reelItems.map((item, i) => (
                <PfScreenshot
                  key={`${item.key}-${i}`}
                  className="pf-reel__shot"
                  src={getImageUrl(item.cover, { width: 720, quality: 80 })}
                  alt=""
                  loading="eager"
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ TRUST LINE ============ */}
      {trustBadges.length > 0 && (
        <div className="pf-trust">
          <div className="container-custom container-page mx-auto pf-trust__row">
            {trustBadges.map((badge, i) => {
              const Icon = badgeIconMap[(badge.icon || "").toLowerCase()] || badgeIconMap.star;
              return (
                <div key={i} className="pf-trust__item">
                  <Icon aria-hidden="true" />
                  <div>
                    <div className="pf-trust__title">{t(badge.title)}</div>
                    <div className="pf-trust__desc">{t(badge.description)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

            <div className="pf-shows">
              {apps.map((item, i) => {
                const flipped = i % 2 === 1;
                const eyebrow = item.category ? t(CATALOG_CATEGORY_LABEL[item.category]) : undefined;
                const features = item.features.slice(0, 3);
                const dashboard = item.screens.find((s) => s.kind === "dashboard");
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`pf-show ${flipped ? "pf-show--flip" : ""}`}
                    onClick={() => openItem("apps")(item)}
                  >
                    <span className="pf-show__media">
                      <span className="pf-show__panel">
                        {item.badge && item.cover && <span className="pf-show__badge">{t(item.badge)}</span>}
                        {item.cover ? (
                          <PfScreenshot className="pf-show__shot" src={getImageUrl(item.cover, { width: 1200, quality: 80 })} alt={item.title} />
                        ) : (
                          <Cover item={item} className="pf-show__shot" width={1200} />
                        )}
                        {item.cover && dashboard && (
                          <PfScreenshot className="pf-show__dash" src={getImageUrl(dashboard.url, { width: 600, quality: 80 })} alt="" />
                        )}
                      </span>
                    </span>
                    <span className="pf-show__text">
                      {eyebrow && <span className="pf-show__index">{eyebrow}</span>}
                      <span className="pf-show__name">
                        {item.logo && <img className="pf-show__logo" src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" />}
                        <h3>{item.title}</h3>
                      </span>
                      {item.subtitle && <span className="pf-show__pitch">{t(item.subtitle)}</span>}
                      {features.length > 0 && <span className="pf-show__feats">{features.map((f) => t(f)).join(" · ")}</span>}
                      <span className="pf-show__foot">
                        {item.price ? (
                          <span className="pf-show__price">{item.price.value}{item.price.label && <small>{t(item.price.label)}</small>}</span>
                        ) : (
                          <span className="pf-show__price pf-show__price--quote">{t("Custom quote")}</span>
                        )}
                        <span className="pf-show__go">{t("See details")} <span aria-hidden="true">→</span></span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
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
      <section className="pf-final" id="cta">
        <div className="container-custom container-page mx-auto">
          <div className="pf-final__box">
            <div>
              <div className="inline-flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-cta-soft">
                <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-cta" />
                {t("Next step")}
              </div>
              <h2 className="pf-final__title">{t(cta?.title || "Ready to Redefine Your Potential?")}</h2>
              {cta?.subtitle && <p className="pf-final__sub">{t(cta.subtitle)}</p>}
            </div>
            <div className="pf-final__actions">
              <button
                type="button"
                onClick={() => openForm("footer")}
                className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-4 font-bold text-white transition-colors hover:bg-cta-hover"
              >
                {t(cta?.buttonText || "Book a Strategy Session")} <span aria-hidden="true">→</span>
              </button>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#B4C0D8] transition-colors hover:text-white"
                >
                  {t("or talk on WhatsApp")} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

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
