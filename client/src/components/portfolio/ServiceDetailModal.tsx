import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { PortfolioService } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { badgeColorMap } from "@/components/PortfolioCard";
import { getOriginalImageUrl } from "@/components/admin/shared/utils";

const checkColorMap: Record<string, string> = {
  blue: "text-blue-400",
  purple: "text-purple-400",
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
};

interface ServiceDetailModalProps {
  service: PortfolioService;
  isOpen: boolean;
  onClose: () => void;
  onCta: (source: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function ServiceDetailModal({ service, isOpen, onClose, onCta, onPrev, onNext }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const [imageAspectRatio, setImageAspectRatio] = useState("16 / 9");
  const checkColor = checkColorMap[service.accentColor || 'blue'] || checkColorMap.blue;

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous service"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next service"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-[#0a0f18] to-[#0d1320]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  {t(service.title)}
                </h2>
                {service.toolUrl && (
                  <a
                    href={service.toolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
                    title="Open tool in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open tool
                  </a>
                )}
              </div>
              <p className="text-lg text-purple-100 mb-6">
                {t(service.subtitle)}
              </p>
              {service.imageUrl && (
                <div
                  className="w-full rounded-2xl shadow-xl overflow-hidden mb-6 bg-[radial-gradient(circle_at_top,_rgba(64,110,241,0.16),_rgba(15,23,42,0.94)_70%)] border border-white/10"
                  style={{ aspectRatio: imageAspectRatio }}
                >
                  <img
                    src={getOriginalImageUrl(service.imageUrl)}
                    alt={service.title}
                    loading="eager"
                    decoding="async"
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalWidth > 0 && naturalHeight > 0) {
                        setImageAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                      }
                    }}
                    className="w-full h-full object-cover object-center"
                    style={{ imageRendering: 'auto', transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden' }}
                  />
                </div>
              )}
              <p className="text-white/90 leading-relaxed">
                {t(service.description)}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-sm rounded-2xl p-7 mb-6 flex-1 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative mb-6 flex items-start justify-between gap-4">
                  <div className="flex items-baseline gap-1.5 text-white">
                    <span className="text-5xl font-extrabold tracking-tight">{service.price}</span>
                    <span className="text-sm text-white/50 font-medium uppercase tracking-wider">{t(service.priceLabel)}</span>
                  </div>
                  <span className="shrink-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t(service.badgeText)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                    {t("What's included")}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                <ul className="space-y-3">
                  {(service.features || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className={`w-5 h-5 ${checkColor} shrink-0 mt-0.5`} />
                      <span className="text-white/85 text-sm leading-snug">{t(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => onCta(service.slug)}
                className="w-full px-8 py-4 bg-primary text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                {t(service.ctaText)}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
