import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PortfolioService } from "@shared/schema";
import { getImageUrl, getOriginalImageUrl } from "@/components/admin/shared/utils";

// Helper to check if string is a hex color
function isHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// Badge color mappings for named colors (fallback)
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
    const [imageAspectRatio, setImageAspectRatio] = useState("16 / 9");
    const accentColor = service.accentColor || '#406EF1';
    const isHex = isHexColor(accentColor);
    const badgeColors = isHex ? null : (badgeColorMap[accentColor] || badgeColorMap.blue);

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
            card: 'bg-white/90 hover:bg-white shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)]',
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
            {/* Service Image */}
            {service.imageUrl && (
                <div
                    className="w-full overflow-hidden relative"
                    style={{ aspectRatio: imageAspectRatio }}
                >
                    <img
                        src={getOriginalImageUrl(service.imageUrl)}
                        alt={service.title}
                        loading="lazy"
                        decoding="async"
                        onLoad={(e) => {
                            const { naturalWidth, naturalHeight } = e.currentTarget;
                            if (naturalWidth > 0 && naturalHeight > 0) {
                                setImageAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                            }
                        }}
                        className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-300 pointer-events-none"
                        draggable={false}
                    />
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

                {/* CTA + Badge */}
                <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center gap-2 text-sm font-medium ${themeClasses.cta}`}>
                        {t(service.ctaText)}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                    {service.badgeText && (
                        <span className="shrink-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            {t(service.badgeText)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PortfolioCard;
