import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { PortfolioService } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { getOriginalImageUrl } from "@/components/admin/shared/utils";
import { LaptopMockup } from "./LaptopMockup";

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sliderImages: string[] = (service.popupSliderImages as string[]) || [];
  const popupUrls: string[] = (service.popupUrls as string[]) || [];
  const features: string[] = (service.features as string[]) || [];

  // Reset slide when service changes
  useEffect(() => {
    setCurrentSlide(0);
  }, [service.id]);

  // Auto-advance slider
  useEffect(() => {
    if (!isOpen || sliderImages.length <= 1 || isPaused) return;
    intervalRef.current = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % sliderImages.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, sliderImages.length, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen) return null;

  const bgImage = service.popupBgImageUrl
    ? getOriginalImageUrl(service.popupBgImageUrl)
    : null;

  return (
    /* Dark backdrop — fills viewport, click to close */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev service */}
      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous service"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next service */}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next service"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Purple card frame — proportions from Frame 54 Figma:
          inner dark card has ~67px margin on sides, ~32px on top/bottom.
          Background image fills this purple layer. */}
      <div
        className="relative w-full max-w-4xl rounded-[32px] overflow-hidden p-6 md:px-14 md:py-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Optional bg image behind the purple */}
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Purple overlay */}
        <div className="absolute inset-0 bg-[#6f12e1d9]" />

        {/* Dark inner card — radius 39px like Figma Rectangle 2040 */}
        <div className="relative z-10 max-h-[80vh] overflow-y-auto rounded-[39px]">
          <div className="bg-[#070b13] rounded-[39px] border border-[#524eae60] overflow-hidden">
            <div className="p-8 md:p-10">

            {/* Top divider line — as in Frame 54 */}
            <div className="w-full h-px bg-white/20 mb-7" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* LEFT COLUMN */}
              <div className="flex flex-col gap-5">

                {/* Logo + Title */}
                <div className="flex items-center gap-4">
                  {service.logoIconUrl && (
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                      <img
                        src={getOriginalImageUrl(service.logoIconUrl)}
                        alt={service.title}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                      {t(service.title)}
                    </h2>
                    {service.toolUrl && (
                      <a
                        href={service.toolUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-purple-200 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open tool
                      </a>
                    )}
                  </div>
                </div>

                {/* Feature pill badges */}
                {features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {features.map((f, i) => (
                      <span
                        key={i}
                        className="px-4 py-1.5 rounded-full text-sm font-semibold"
                        style={{ backgroundColor: "#d4b9f6", color: "#6f12e1" }}
                      >
                        {t(f)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {service.price}
                  </span>
                  <span className="text-lg text-white/50 font-medium">
                    {t(service.priceLabel)}
                  </span>
                </div>

                {/* URL list */}
                {popupUrls.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {popupUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url.startsWith("http") ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/70 font-light hover:text-white transition-colors"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => onCta(service.slug)}
                  className="mt-auto w-full md:w-auto px-8 py-3 bg-primary text-white font-bold rounded-full text-base hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  {t(service.ctaText)}
                </button>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col gap-4">

                {/* Description */}
                {service.description && (
                  <p className="text-white/70 text-sm leading-relaxed">
                    {t(service.description)}
                  </p>
                )}

                {/* Laptop mockup with slider */}
                <div
                  className="relative"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                >
                  <LaptopMockup>
                    {sliderImages.length > 0 ? (
                      <div className="w-full h-full relative overflow-hidden">
                        {sliderImages.map((src, i) => (
                          <img
                            key={i}
                            src={getOriginalImageUrl(src)}
                            alt={`Screenshot ${i + 1}`}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-in-out"
                            style={{
                              transform: `translateX(${(i - currentSlide) * 100}%)`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No screenshots</span>
                      </div>
                    )}
                  </LaptopMockup>

                  {/* Dot indicators */}
                  {sliderImages.length > 1 && (
                    <div className="flex justify-center gap-2 mt-3">
                      {sliderImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlide(i)}
                          aria-label={`Go to slide ${i + 1}`}
                          className={`rounded-full transition-all duration-300 ${
                            i === currentSlide
                              ? "bg-white w-4 h-2.5"
                              : "bg-white/30 w-2.5 h-2.5 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
