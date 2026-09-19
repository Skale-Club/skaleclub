import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { usePageSeo } from "@/hooks/use-seo";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CatalogCard } from "@/components/catalog/CatalogCard";
import { CatalogDetail } from "@/components/catalog/CatalogDetail";
import { Loader2 } from "@/components/ui/loader";

type ListKey = "apps" | "services";

/** Splits "Stop Doing Repetitive Work. Automate It." so the last sentence can
 *  carry the accent. A one-sentence title is returned whole. */
function splitLastSentence(title: string): [string, string] {
  const at = title.trim().lastIndexOf(". ");
  return at < 0 ? [title, ""] : [title.slice(0, at + 1), title.slice(at + 2)];
}

/** The lowest monthly plan, for the proof band: "$29" + "/month". */
function entryPlan(apps: CatalogItem[]) {
  const monthly = apps
    .filter((a) => a.price && /mo/i.test(a.price.label ?? ""))
    .map((a) => ({ item: a, n: Number.parseFloat(a.price!.value.replace(/[^0-9.]/g, "")) }))
    .filter((x) => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n);
  return monthly[0]?.item;
}

const pad = (n: number) => String(n).padStart(2, "0");

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
  const [heroLead, heroAccent] = splitLastSentence(t(hero?.title || "Stop Doing Repetitive Work. Automate It."));
  const buttonText = t(hero?.buttonText || "Book a Strategy Session");
  const entry = entryPlan(apps);
  const whatsapp = companySettings?.companyPhone?.replace(/\D/g, "");

  const proof = [
    apps.length > 0 && { value: pad(apps.length), label: t("ready-made apps in production") },
    services.length > 0 && { value: pad(services.length), label: t("marketing and technology services") },
    entry?.price && {
      value: entry.price.value,
      unit: entry.price.label ? t(entry.price.label) : undefined,
      label: `${t("entry plan")} (${entry.title})`,
    },
  ].filter(Boolean) as { value: string; unit?: string; label: string }[];

  const grid = (list: ListKey) => {
    const items = lists[list];
    // An odd last item in a 3-column grid spans the line instead of sitting
    // alone and centred (it stays a tile when that would not happen).
    const rowLast = items.length % 3 === 1 && items.length % 2 === 1 && items.length > 1;
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {items.map((item, i) => {
          const isRow = rowLast && i === items.length - 1;
          return (
            <CatalogCard
              key={item.key}
              item={item}
              variant={isRow ? "row" : "tile"}
              onOpen={openItem(list)}
              className={`cat-rise ${isRow ? "md:col-span-2 lg:col-span-3" : ""}`}
              style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}
            />
          );
        })}
      </div>
    );
  };

  const sectionHead = (eyebrow: string, title: string, subtitle: string, count: number) => (
    <div className="mb-8 lg:mb-12 flex items-end justify-between gap-6">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} size="display" />
      <span
        aria-hidden="true"
        className="hidden md:block font-display font-extrabold leading-[0.8] tracking-[-0.04em] text-transparent text-[clamp(4rem,8vw,7.5rem)] [-webkit-text-stroke:1px_rgba(180,192,216,0.28)]"
      >
        {pad(count)}
      </span>
    </div>
  );

  return (
    <div className="bg-surface-dark text-white min-h-screen overflow-x-hidden">
      {/* Hero: the house pattern, left-aligned, one CTA. Atmosphere is one
          corner glow and an almost invisible line texture, nothing else. */}
      <section className="relative page-top pb-12 sm:pb-16 lg:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 [mask-image:linear-gradient(180deg,#000_55%,transparent)]"
          style={{
            background:
              "radial-gradient(40% 55% at 8% 0%, rgba(81,115,214,.16), transparent 70%), repeating-linear-gradient(0deg, transparent 0 31px, rgba(180,192,216,.035) 31px 32px)",
          }}
        />
        <div className="container-custom container-page mx-auto relative">
          <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-cta-soft">
            <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-cta" />
            {t(hero?.badge || "Our Solutions")}
          </div>
          <h1 className="mt-5 max-w-[15ch] font-display font-extrabold leading-[0.93] tracking-[-0.035em] text-[clamp(2.75rem,7.4vw,6.5rem)]">
            {heroLead}
            {heroAccent && <> <span className="text-cta">{heroAccent}</span></>}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg sm:text-xl leading-relaxed text-[#B4C0D8]">
            {t(hero?.subtitle || "Explore the tools and services we've built to help businesses grow.")}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <button
              type="button"
              onClick={() => openForm("hero")}
              className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-4 font-bold text-white transition-colors hover:bg-cta-hover"
            >
              {buttonText} <span aria-hidden="true">→</span>
            </button>
            {apps.length > 0 && (
              <a href="#apps" className="font-medium text-[#B4C0D8] transition-colors hover:text-white">
                {t("See the apps")} ↓
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Proof band: numerals from the catalog itself, one colour. */}
      {proof.length > 0 && (
        <div className="border-y border-white/10">
          <div
            className="container-custom container-page mx-auto grid"
            style={{ gridTemplateColumns: `repeat(${proof.length}, minmax(0, 1fr))` }}
          >
            {proof.map((p, i) => (
              <div key={p.label} className={`min-w-0 py-6 lg:py-7 ${i > 0 ? "pl-4 sm:pl-6 border-l border-white/10" : ""}`}>
                {/* flex-wrap: on narrow columns (mobile, 3-up) the unit wraps
                    onto its own line instead of overflowing the column and
                    getting clipped by the page's overflow-x: clip. */}
                <div className="flex flex-wrap items-baseline gap-x-1 font-display font-extrabold leading-none tracking-[-0.03em] text-[clamp(2.25rem,4.4vw,3.5rem)]">
                  <span>{p.value}</span>
                  {p.unit && <small className="text-[0.42em] font-semibold tracking-normal text-[#B4C0D8]">{p.unit}</small>}
                </div>
                <div className="mt-2 text-sm leading-snug text-[#7C8AA6]">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {apps.length > 0 && (
        <section id="apps" className="pt-16 sm:pt-24 lg:pt-28 scroll-mt-24">
          <div className="container-custom container-page mx-auto">
            {sectionHead("01 · Apps", "Software ready to use", "Our own products, live today, with a fixed price. Subscribe and start.", apps.length)}
            {grid("apps")}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section id="services" className="pt-16 sm:pt-24 lg:pt-28 scroll-mt-24">
          <div className="container-custom container-page mx-auto">
            {sectionHead("02 · Services", "Built by us, for your business", "Tailored marketing and technology, quoted for your case.", services.length)}
            {grid("services")}
          </div>
        </section>
      )}

      {/* Final CTA: one block, one button, WhatsApp as the secondary link. */}
      <section className="py-16 sm:py-24 lg:py-28">
        <div className="container-custom container-page mx-auto">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-surface-card p-8 sm:p-12 lg:p-20 grid gap-8 lg:grid-cols-[1.3fr_auto] lg:items-end">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(45% 80% at 100% 100%, rgba(81,115,214,.22), transparent 70%)" }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-cta-soft">
                <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-cta" />
                {t("Next step")}
              </div>
              <h2 className="mt-4 max-w-[14ch] font-display font-extrabold leading-[0.95] tracking-[-0.035em] text-[clamp(2.25rem,5.6vw,4.75rem)]">
                {t(cta?.title || "Ready to Redefine Your Potential?")}
              </h2>
              {cta?.subtitle && <p className="mt-5 max-w-[46ch] text-lg text-[#B4C0D8]">{t(cta.subtitle)}</p>}
            </div>
            <div className="relative flex flex-col items-start gap-4">
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
