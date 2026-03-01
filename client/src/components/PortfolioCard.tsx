import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PortfolioService } from "@shared/schema";

// Badge color mappings - shared across portfolio pages
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
 * Changes to this component will reflect in both places
 */
export function PortfolioCard({ service, onClick, className = "", variant = 'dark' }: PortfolioCardProps) {
    const { t } = useTranslation();
    const accentColor = service.accentColor || 'blue';
    const badgeColors = badgeColorMap[accentColor] || badgeColorMap.blue;

    // Theme-specific classes
    const themeClasses = variant === 'dark'
        ? {
            card: 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20',
            title: 'text-white',
            subtitle: 'text-white/60',
            price: 'text-white',
            priceLabel: 'text-white/50',
            cta: 'text-blue-400',
        }
        : {
            card: 'bg-white/90 hover:bg-white border-slate-100 hover:border-slate-200 shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)]',
            title: 'text-slate-900',
            subtitle: 'text-slate-600',
            price: 'text-slate-900',
            priceLabel: 'text-slate-500',
            cta: 'text-blue-600',
        };

    return (
        <div
            onClick={onClick}
            className={`group cursor-pointer ${themeClasses.card} border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 ${className}`}
        >
            {/* Service Image with Badge Overlay */}
            {service.imageUrl && (
                <div className="aspect-video w-full overflow-hidden relative">
                    <img
                        src={service.imageUrl}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        draggable={false}
                    />
                    {/* Badge positioned on top-right of image */}
                    {service.badgeText && (
                        <span className={`absolute top-3 right-3 ${badgeColors.bg} ${badgeColors.text} text-xs font-bold px-3 py-1 rounded-full shadow-lg`}>
                            {t(service.badgeText)}
                        </span>
                    )}
                </div>
            )}

            <div className="p-6">
                {/* Title & Subtitle */}
                <h3 className={`text-xl font-bold mb-2 ${themeClasses.title}`}>{t(service.title)}</h3>
                <p className={`text-sm mb-4 ${themeClasses.subtitle}`}>{t(service.subtitle)}</p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-4">
                    <span className={`text-2xl font-bold ${themeClasses.price}`}>{service.price}</span>
                    <span className={`text-sm ${themeClasses.priceLabel}`}>{t(service.priceLabel)}</span>
                </div>

                {/* CTA */}
                <div className={`flex items-center gap-2 text-sm font-medium ${themeClasses.cta}`}>
                    {t(service.ctaText)}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </div>
    );
}

export default PortfolioCard;
