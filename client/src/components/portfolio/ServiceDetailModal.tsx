import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

  useEffect(() => {
    setCurrentSlide(0);
  }, [service.id]);

  useEffect(() => {
    if (!isOpen || sliderImages.length <= 1 || isPaused) return;
    intervalRef.current = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % sliderImages.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, sliderImages.length, isPaused]);

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

      {/* Prev */}
      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous service"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next */}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next service"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Purple outer frame — thin border as in Figma (67px/1799 ≈ 3.7% each side) */}
      <div
        className="relative w-full max-w-[900px] rounded-[32px] px-8 py-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-[#6f12e1d9]" />

        {/* Dark inner card — Rectangle 2040 from Figma */}
        <div className="relative rounded-[39px] bg-[#070b13] border border-[#524eae60] overflow-hidden">
          <div className="px-10 py-8">

            {/* Divider line — y:104 from card top in Figma */}
            <div className="w-full h-px bg-white/20 mb-8" />

            {/* Main content — flex row, not grid */}
            <div className="flex">

              {/* LEFT COLUMN — flex-1, grows to fill */}
              <div className="flex-1 min-w-0 pr-8 flex flex-col gap-5">

                {/* Logo + Title on same row */}
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
                  <h2 className="text-[43px] font-bold text-white leading-tight">
                    {t(service.title)}
                  </h2>
                </div>

                {/* Feature pill badges — lavanda fill, purple border, purple text */}
                {features.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {features.map((f, i) => (
                      <span
                        key={i}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold border"
                        style={{ background: "#d4b9f6", color: "#6f12e1", borderColor: "#6f12e1" }}
                      >
                        {t(f)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price — large amount + smaller label */}
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white leading-none">
                    {service.price}
                  </span>
                  <span className="text-xl text-white/50 ml-1">
                    {t(service.priceLabel)}
                  </span>
                </div>

                {/* URL list */}
                {popupUrls.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {popupUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url.startsWith("http") ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] text-white font-light hover:underline"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => onCta(service.slug)}
                  className="mt-auto w-fit px-6 py-2.5 bg-primary text-white font-bold rounded-full text-sm hover:opacity-90 transition-opacity"
                >
                  {t(service.ctaText)}
                </button>
              </div>

              {/* RIGHT COLUMN — fixed 45%, description at top then laptop */}
              <div className="w-[45%] shrink-0 flex flex-col gap-3">

                {/* Description — upper-right as in Figma (y:192 in card) */}
                {service.description && (
                  <p className="text-[15px] text-white/70 font-light leading-relaxed">
                    {t(service.description)}
                  </p>
                )}

                {/* Laptop mockup with image slider */}
                <div
                  className="flex-1"
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
                            style={{ transform: `translateX(${(i - currentSlide) * 100}%)` }}
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
  );
}
