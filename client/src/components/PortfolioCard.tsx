import { memo } from "react";
import {
  Image as ImageIcon,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Globe,
  Calendar,
  CreditCard,
  Users,
  MessageCircle,
  Rocket,
  Utensils,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PortfolioService } from "@shared/schema";
import { getImageUrl } from "@/components/admin/shared/utils";
import { ProjectPreview } from "@/components/home/ProjectPreview";

// Badge color mappings for named accent colors
export const badgeColorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500", text: "text-white" },
  purple: { bg: "bg-purple-500", text: "text-white" },
  green: { bg: "bg-emerald-500", text: "text-white" },
  orange: { bg: "bg-orange-500", text: "text-white" },
  red: { bg: "bg-red-500", text: "text-white" },
};

interface PortfolioCardProps {
  service: PortfolioService;
  onClick?: () => void;
  className?: string;
  variant?: 'dark' | 'light';
  description?: string;
  compact?: boolean; // ~20% smaller — used by the homepage carousels
  showPrice?: boolean;
}

function getServiceFallbackIcon(service: PortfolioService) {
  const slug = (service.slug || "").toLowerCase();
  const icon = (service.iconName || "").toLowerCase();

  if (slug.includes("xareable") || slug.includes("astropilot") || icon.includes("sparkle")) {
    return Sparkles;
  }
  if (slug.includes("site") || slug.includes("web") || icon.includes("globe")) {
    return Globe;
  }
  if (slug.includes("kedule") || slug.includes("schedul") || icon.includes("calendar")) {
    return Calendar;
  }
  if (slug.includes("menu") || icon.includes("utensil")) {
    return Utensils;
  }
  if (slug.includes("timator") || icon.includes("sheet") || icon.includes("calc")) {
    return FileSpreadsheet;
  }
  if (slug.includes("crm") || slug.includes("phere") || icon.includes("user")) {
    return Users;
  }
  if (slug.includes("pay") || icon.includes("credit")) {
    return CreditCard;
  }
  if (slug.includes("chat") || icon.includes("message")) {
    return MessageCircle;
  }
  return Rocket;
}

/**
 * Shared Portfolio Card Component
 * Used in both /portfolio page and homepage "What We Do" section.
 * When compact=true, preserves tight proportions for horizontal auto-scrolling carousels.
 * When compact=false (portfolio page), renders a rich, high-end agency card with full details.
 */
export const PortfolioCard = memo(function PortfolioCard({
  service,
  onClick,
  className = "",
  variant = 'dark',
  description,
  compact = false,
  showPrice = true,
}: PortfolioCardProps) {
  const { t } = useTranslation();
  const FallbackIcon = getServiceFallbackIcon(service);

  const themeClasses = variant === 'dark'
    ? {
        card: 'bg-[#0d121f]/80 hover:bg-[#121829]/95 border-white/10 hover:border-blue-500/40 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_40px_-15px_rgba(64,110,241,0.25)]',
        title: 'text-white',
        subtitle: 'text-slate-400',
        imageBg: 'bg-slate-900/60',
        iconPlaceholder: 'text-slate-400',
        bubble: 'bg-white/5 text-slate-300 border-white/10',
        priceBg: 'bg-white/5 text-white border-white/10',
      }
    : {
        card: 'bg-white/90 hover:bg-white border-slate-200/70 shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)]',
        title: 'text-slate-900',
        subtitle: 'text-slate-600',
        imageBg: 'bg-slate-100',
        iconPlaceholder: 'text-slate-400',
        bubble: 'bg-slate-100 text-slate-700 border-slate-200',
        priceBg: 'bg-slate-100 text-slate-900 border-slate-200',
      };

  const features = Array.isArray(service.features) ? service.features : [];
  const cardDesc = description || service.description;

  // --------------------------------------------------------------------------
  // COMPACT MODE (Preserved for Homepage Carousels)
  // --------------------------------------------------------------------------
  if (compact) {
    return (
      <div
        onClick={onClick}
        role="group"
        aria-label={service.title}
        className={`group flex h-full cursor-pointer flex-col gap-3 rounded-xl p-3 border transition-all duration-300 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-cta/40 ${themeClasses.card} ${className}`}
      >
        <ProjectPreview
          service={service}
          className={`relative w-full overflow-hidden rounded-lg aspect-[16/10] ${themeClasses.imageBg}`}
          fallback={(
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950/30 to-indigo-950/40">
              <FallbackIcon className="h-8 w-8 text-blue-400/60" />
            </div>
          )}
        />

        <div className="flex items-center gap-2">
          {service.logoIconUrl ? (
            <img
              src={getImageUrl(service.logoIconUrl, { width: 160, quality: 80 })}
              alt={`${service.title} logo`}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 shrink-0 object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FallbackIcon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className={`truncate font-bold leading-tight text-base ${themeClasses.title}`}>
              {onClick ? (
                <button type="button" className="w-full truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                  aria-label={`${t('View Details')} — ${service.title}`}
                  onClick={event => { event.stopPropagation(); onClick(); }}>
                  {service.title}
                </button>
              ) : service.title}
            </h3>
            {service.subtitle && (
              <p className={`truncate text-xs ${themeClasses.subtitle}`}>{t(service.subtitle)}</p>
            )}
          </div>
        </div>

        {cardDesc && (
          <p className={`leading-relaxed line-clamp-3 text-xs ${themeClasses.subtitle}`}>
            {t(cardDesc)}
          </p>
        )}

        <div className="mt-auto overflow-hidden h-6">
          <div className="flex flex-wrap gap-1.5">
            {features.map((feature, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center rounded-full border font-medium h-6 px-2.5 text-[11px] ${themeClasses.bubble}`}
              >
                {t(feature)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // FULL / PORTFOLIO PAGE MODE
  // --------------------------------------------------------------------------
  const maxDisplayFeatures = 3;
  const visibleFeatures = features.slice(0, maxDisplayFeatures);
  const remainingCount = features.length - maxDisplayFeatures;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      className={`group relative flex h-full cursor-pointer flex-col justify-between rounded-2xl p-5 border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-2 ${themeClasses.card} ${className}`}
    >
      <div className="flex flex-col gap-4">
        {/* Hero image or Branded Mockup Visual */}
        <div className={`relative w-full overflow-hidden rounded-xl aspect-[16/10] ${themeClasses.imageBg}`}>
          {service.imageUrl ? (
            <img
              src={getImageUrl(service.imageUrl, { width: 800, quality: 80 })}
              alt={service.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 pointer-events-none"
              draggable={false}
            />
          ) : (
            /* Branded gradient mockup when imageUrl is missing */
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0c1322] via-[#141e34] to-[#0a0f1d]">
              {/* Subtle ambient light and grid pattern */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)",
                  backgroundSize: "20px 20px"
                }}
              />
              <div className="absolute w-28 h-28 rounded-full bg-blue-500/20 blur-2xl" />

              {/* Centered glass badge with logo or icon */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                {service.logoIconUrl ? (
                  <img
                    src={getImageUrl(service.logoIconUrl, { width: 160, quality: 80 })}
                    alt={service.title}
                    className="h-16 w-16 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-blue-400 shadow-xl transition-transform duration-300 group-hover:scale-110">
                    <FallbackIcon className="h-8 w-8" />
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase opacity-80">
                  {service.title}
                </span>
              </div>
            </div>
          )}

          {/* Floating Badge (e.g. AI Powered, Popular, One-time Fee) */}
          {service.badgeText && (
            <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {t(service.badgeText)}
            </div>
          )}

          {/* Floating External Tool Link Badge if toolUrl exists */}
          {service.toolUrl && (
            <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-600/80 backdrop-blur-md border border-blue-400/30 text-white shadow-md">
              <ExternalLink className="w-3 h-3" />
              <span>{t("Live Tool")}</span>
            </div>
          )}
        </div>

        {/* Logo Icon + Title / Subtitle */}
        <div className="flex items-center gap-3.5">
          {service.logoIconUrl ? (
            <img
              src={getImageUrl(service.logoIconUrl, { width: 160, quality: 80 })}
              alt={`${service.title} logo`}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 object-contain pointer-events-none rounded-xl"
              draggable={false}
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <FallbackIcon className="h-6 w-6" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className={`truncate font-bold text-lg leading-snug tracking-tight ${themeClasses.title}`}>
              {service.title}
            </h3>
            {service.subtitle && (
              <p className={`truncate text-xs sm:text-sm font-medium ${themeClasses.subtitle}`}>
                {t(service.subtitle)}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {cardDesc && (
          <p className="line-clamp-2 text-xs sm:text-sm text-slate-300/80 leading-relaxed">
            {t(cardDesc)}
          </p>
        )}

        {/* Feature Pills */}
        {features.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {visibleFeatures.map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium bg-white/[0.04] text-slate-300 border-white/10"
              >
                {t(feature)}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium bg-white/[0.02] text-slate-400 border-white/5">
                +{remainingCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Price & View Details Action */}
      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
        {/* Price display */}
        {showPrice && service.price ? (
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white tracking-tight">
                {service.price}
              </span>
              {service.priceLabel && (
                <span className="text-xs text-slate-400 font-normal">
                  {t(service.priceLabel)}
                </span>
              )}
            </div>
            {service.setupPrice && (
              <span className="text-[11px] text-slate-400">
                +{service.setupPrice} {t("setup")}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* CTA "Ver detalhes" button */}
        <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
          <span>{t("View Details")}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
});

export default PortfolioCard;
