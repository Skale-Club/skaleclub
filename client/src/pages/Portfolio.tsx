import { usePageSeo } from "@/hooks/use-seo";
import { useState, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  Layers,
  ChevronDown,
} from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { PortfolioCard } from "@/components/PortfolioCard";
import { ServiceDetailModal } from "@/components/ServiceDetailModal";
import { Loader2 } from '@/components/ui/loader';
import { getImageUrl } from "@/components/admin/shared/utils";

type CategoryFilter = 'all' | 'ai' | 'websites' | 'systems' | 'crm';

function getServiceCategory(service: PortfolioService): CategoryFilter {
  const slug = (service.slug || "").toLowerCase();
  const title = (service.title || "").toLowerCase();
  const badge = (service.badgeText || "").toLowerCase();

  if (slug.includes("xareable") || slug.includes("astropilot") || badge.includes("ai") || title.includes("ai") || slug.includes("chat")) {
    return 'ai';
  }
  if (slug.includes("site") || slug.includes("web")) {
    return 'websites';
  }
  if (slug.includes("crm") || slug.includes("phere") || slug.includes("lead")) {
    return 'crm';
  }
  return 'systems';
}

export default function Portfolio() {
  const { t } = useTranslation();
  usePageSeo({ title: t("Our Solutions"), description: t("Ready-made apps and the services we perform: AI, automation, websites, marketing and more.") });
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const { data: portfolioServices, isLoading: isLoadingServices } = useQuery<PortfolioService[]>({
    queryKey: ['/api/portfolio-services'],
    staleTime: 0,
    refetchOnMount: true,
  });

  const portfolioHero = companySettings?.homepageContent?.portfolioHero;
  const portfolioCta = companySettings?.homepageContent?.portfolioCtaSection;
  const showServicesTitle = companySettings?.homepageContent?.portfolioServicesSection?.showTitle ?? true;

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isModalOpen = selectedIndex !== null;
  const selectedService =
    selectedIndex !== null && portfolioServices ? portfolioServices[selectedIndex] : null;

  const handleCta = (source: string) => {
    setIsFormOpen(true);
    setSelectedIndex(null);
    trackCTAClick('portfolio-' + source, companySettings?.ctaText || 'Book Call');
  };

  const openServiceModal = (service: PortfolioService) => {
    const idx = portfolioServices?.findIndex((s) => s.id === service.id) ?? -1;
    if (idx >= 0) setSelectedIndex(idx);
  };

  const goToPrev = () => {
    if (selectedIndex === null || !portfolioServices) return;
    setSelectedIndex((selectedIndex - 1 + portfolioServices.length) % portfolioServices.length);
  };
  const goToNext = () => {
    if (selectedIndex === null || !portfolioServices) return;
    setSelectedIndex((selectedIndex + 1) % portfolioServices.length);
  };

  // Filtered services based on active tab
  const filteredServices = useMemo(() => {
    if (!portfolioServices) return [];
    if (activeCategory === 'all') return portfolioServices;
    return portfolioServices.filter((s) => getServiceCategory(s) === activeCategory);
  }, [portfolioServices, activeCategory]);

  // Counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: portfolioServices?.length || 0,
      ai: 0,
      websites: 0,
      systems: 0,
      crm: 0,
    };
    if (portfolioServices) {
      for (const s of portfolioServices) {
        const cat = getServiceCategory(s);
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [portfolioServices]);

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'ai', label: t('AI & Automation') },
    { key: 'websites', label: t('Websites') },
    { key: 'systems', label: t('Systems & Booking') },
    { key: 'crm', label: t('CRM & Sales') },
  ];

  if (isLoadingServices) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-white gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <span className="text-sm text-slate-400 font-medium">{t("Loading...")}</span>
      </div>
    );
  }

  return (
    <div className="bg-[#09090b] text-white min-h-screen overflow-x-hidden selection:bg-blue-500/30 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────────
          HERO SECTION
          Balanced spacing under floating navbar (~80px height),
          ambient glowing backdrop, modern gradient typography and CTA.
      ───────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 sm:pt-36 sm:pb-20 lg:pt-44 lg:pb-24 flex flex-col items-center justify-center text-center px-4 sm:px-6 overflow-hidden">
        {/* Background Grid Pattern */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Ambient Gradient Glow Lights */}
        <div
          aria-hidden="true"
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[350px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-purple-600/10 blur-[130px] rounded-full pointer-events-none z-0"
        />

        {/* Optional Custom Background Image from Admin Settings */}
        {portfolioHero?.backgroundImage && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-25 mix-blend-screen"
              style={{ backgroundImage: `url(${getImageUrl(portfolioHero.backgroundImage, { width: 1920, quality: 80 })})` }}
            />
            <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#09090b]/80 via-[#09090b]/50 to-[#09090b]" />
          </>
        )}

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border border-blue-500/25 bg-blue-500/10 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-200 font-semibold tracking-wide uppercase text-xs">
              {t(portfolioHero?.badge || "Our Solutions")}
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-5">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-blue-200">
              {t(portfolioHero?.title || companySettings?.heroTitle || "Scale Your Business")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300/80 max-w-2xl mx-auto leading-relaxed mb-8 font-normal">
            {t(portfolioHero?.subtitle || "Explore the tools and services we've built to help businesses grow.")}
          </p>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => handleCta('hero')}
              className="px-8 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-full text-base sm:text-lg transition-all duration-300 hover:scale-105 shadow-[0_0_30px_rgba(64,110,241,0.4)] hover:shadow-[0_0_45px_rgba(64,110,241,0.6)] inline-flex items-center justify-center gap-2.5"
            >
              <span>{t(portfolioHero?.buttonText || "Book a Strategy Session")}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <a
              href="#solutions"
              className="px-6 py-3.5 rounded-full text-sm font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <span>{t("All Solutions")}</span>
              <ChevronDown className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          VALUE PROPOSITION / METRICS STRIP
          Builds immediate trust with tangible proof points.
      ───────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 relative z-20 mb-8 sm:mb-12">
        <div className="max-w-6xl mx-auto rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{t("Proprietary Ecosystem")}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("Built specifically for high performance")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{t("Fast 3-7 Day Deployment")}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("No endless wait to start scaling")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{t("24/7 AI Automation")}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("Never lose a lead or booking")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{t("Tailored Integration")}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("Direct sync with WhatsApp, CRM and payments")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SOLUTIONS GRID SECTION
          Category filter pills + clean responsive 3-column CSS Grid.
      ───────────────────────────────────────────────────────────────── */}
      <section id="solutions" className="py-12 sm:py-16 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto">
          {/* Section Header & Filter Tabs */}
          <div className="flex flex-col items-center mb-10 sm:mb-14">
            {showServicesTitle && (
              <div className="text-center mb-6">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {t("Our Solutions")}
                </h2>
                <p className="text-sm sm:text-base text-slate-400 mt-2">
                  {filteredServices.length} {t("Solutions Available")}
                </p>
              </div>
            )}

            {/* Filter Pills */}
            <div className="flex flex-wrap justify-center items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md max-w-full overflow-x-auto">
              {categories.map((cat) => {
                const count = categoryCounts[cat.key];
                if (cat.key !== 'all' && count === 0) return null;
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Solutions Responsive Grid */}
          {filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {filteredServices.map((service) => (
                <PortfolioCard
                  key={service.id}
                  service={service}
                  description={service.description}
                  onClick={() => openServiceModal(service)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-white/5">
              <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-base">{t("No solutions found in this category.")}</p>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM CTA SECTION
          High-conversion Agency banner with ambient glow and dual CTA.
      ───────────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="relative max-w-5xl mx-auto rounded-3xl p-8 sm:p-14 text-center overflow-hidden border border-blue-500/20 bg-gradient-to-b from-[#0f172a] via-[#0b1120] to-[#070b14] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
          {/* Ambient Glows */}
          <div
            aria-hidden="true"
            className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"
          />

          {portfolioCta?.backgroundImage && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-20 mix-blend-screen"
                style={{ backgroundImage: `url(${getImageUrl(portfolioCta.backgroundImage, { width: 1920, quality: 80 })})` }}
              />
              <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none bg-black/60" />
            </>
          )}

          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-6 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t("Ready to Redefine Your Potential?")}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
              {t(portfolioCta?.title || "Ready to Redefine Your Potential?")}
            </h2>

            <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t(portfolioCta?.subtitle || "Join the forward-thinking companies already scaling with Skale Club.")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => handleCta('footer')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-full text-base sm:text-lg transition-all duration-300 hover:scale-105 shadow-[0_0_30px_rgba(64,110,241,0.4)] hover:shadow-[0_0_45px_rgba(64,110,241,0.6)] flex items-center justify-center gap-2"
              >
                <span>{t(portfolioCta?.buttonText || "Book a Strategy Session")}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {companySettings?.companyPhone && (
                <a
                  href={`https://wa.me/${companySettings.companyPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-7 py-4 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
                >
                  <span>{t("Talk on WhatsApp")}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          isOpen={isModalOpen}
          onClose={() => setSelectedIndex(null)}
          onCta={handleCta}
          onPrev={portfolioServices && portfolioServices.length > 1 ? goToPrev : undefined}
          onNext={portfolioServices && portfolioServices.length > 1 ? goToNext : undefined}
          variant="dark"
        />
      )}

      {/* Lead Form Modal */}
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
    </div>
  );
}

