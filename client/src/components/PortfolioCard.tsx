import { Image as ImageIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PortfolioService } from "@shared/schema";
import { getImageUrl } from "@/components/admin/shared/utils";

// Badge color mappings for named accent colors. Still used by the service
// detail modals (home + portfolio) for the badge pill.
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
    variant?: 'dark' | 'light'; // Add theme variant
}

/**
 * Shared Portfolio Card Component
 * Used in both /portfolio page and homepage "What We Do" section
 * Changes to this component will reflect in both places.
 *
 * Layout is intentionally uniform so every card renders at the same height:
 * a fixed-ratio hero image, a title/subtitle + logo-icon row, and a
 * fixed-height feature "bubble" band at the bottom. The bubble band keeps its
 * reserved space even when a service has no features, so removing bubbles
 * never shortens the card.
 */
export function PortfolioCard({ service, onClick, className = "", variant = 'dark' }: PortfolioCardProps) {
    const { t } = useTranslation();

    const themeClasses = variant === 'dark'
        ? {
            card: 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20',
            title: 'text-white',
            subtitle: 'text-white/60',
            imageBg: 'bg-black/20',
            iconBox: 'bg-white/10 border-white/10',
            iconPlaceholder: 'text-white/30',
            bubble: 'bg-white/10 text-white/80 border-white/10',
        }
        : {
            card: 'bg-white/90 hover:bg-white border-slate-200/70 shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)]',
            title: 'text-slate-900',
            subtitle: 'text-slate-600',
            imageBg: 'bg-slate-100',
            iconBox: 'bg-slate-100 border-slate-200',
            iconPlaceholder: 'text-slate-400',
            bubble: 'bg-slate-100 text-slate-700 border-slate-200',
        };

    const features = Array.isArray(service.features) ? service.features : [];

    return (
        <div
            onClick={onClick}
            className={`group flex h-full cursor-pointer flex-col gap-4 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 ${themeClasses.card} ${className}`}
        >
            {/* Hero image — fixed ratio so all cards line up; object-cover so
                the image fills the box (shorter side to the edge), cropping the
                longer side as needed */}
            <div className={`relative w-full overflow-hidden rounded-xl aspect-[16/10] ${themeClasses.imageBg}`}>
                {service.imageUrl ? (
                    <img
                        src={getImageUrl(service.imageUrl, { width: 800, quality: 80 })}
                        alt={service.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02] pointer-events-none"
                        draggable={false}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className={`h-10 w-10 ${themeClasses.iconPlaceholder}`} />
                    </div>
                )}
            </div>

            {/* Title / subtitle + logo icon */}
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className={`truncate text-lg font-bold leading-tight ${themeClasses.title}`}>
                        {service.title}
                    </h3>
                    {service.subtitle && (
                        <p className={`truncate text-sm ${themeClasses.subtitle}`}>{t(service.subtitle)}</p>
                    )}
                </div>
                {service.logoIconUrl && (
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${themeClasses.iconBox}`}>
                        <img
                            src={getImageUrl(service.logoIconUrl, { width: 160, quality: 80 })}
                            alt={`${service.title} logo`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain pointer-events-none"
                            draggable={false}
                        />
                    </div>
                )}
            </div>

            {/* Feature bubbles — reserved fixed-height band, hovers over its own
                spacing so removing bubbles never shrinks the card */}
            <div className="mt-auto h-7 overflow-hidden">
                <div className="flex flex-wrap gap-1.5">
                    {features.map((feature, idx) => (
                        <span
                            key={idx}
                            className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium ${themeClasses.bubble}`}
                        >
                            {t(feature)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PortfolioCard;
