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

/*
 * Pixel-exact clone of Figma "Frame 54" (node 1702:58, 1799×992).
 * The whole popup renders in Frame 54's native coordinate space and scales as one
 * unit via CSS container units: the frame wrapper is a size-container, and children
 * are sized in `cqw` (1cqw = 1% of frame width = 17.99px in Figma space).
 * Conversion: Figma px -> cqw string via cqw().
 *
 * The two content columns are absolutely anchored at their Figma top positions. The
 * LEFT column then FLOWS downward (flex-column) so richer-than-placeholder content
 * (extra/long feature pills, more URLs) never overlaps the price/CTA. For the Figma
 * reference content the flow spacing sums back to the exact Figma y-positions.
 */
const U = 17.99; // Figma px per 1cqw (1799px width / 100)
const cqw = (px: number) => `${(px / U).toFixed(3)}cqw`;

// Figma placeholder content — used only as empty-state fallback, never over real data.
const FALLBACK_TITLE = "Title Title";
const FALLBACK_FEATURES = ["Site-integrated", "Site-integrated", "Site-integrated"];
const FALLBACK_URLS = [
  "obigodeportugues.com",
  "obigodeportugues.com",
  "obigodeportugues.com",
  "obigodeportugues.com",
];
const FALLBACK_DESCRIPTION =
  "Description description descriptiondescriptiondescription";

export function ServiceDetailModal({ service, isOpen, onClose, onCta, onPrev, onNext }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sliderImages: string[] = (service.popupSliderImages as string[]) || [];
  const popupUrls: string[] = (service.popupUrls as string[]) || [];
  const features: string[] = (service.features as string[]) || [];

  const displayFeatures = features.length > 0 ? features : FALLBACK_FEATURES;
  const displayUrls = popupUrls.length > 0 ? popupUrls : FALLBACK_URLS;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
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

      {/* ── Frame 54 wrapper: locked 1799×992 aspect, size-container so children scale in cqw ── */}
      <div
        className="relative shrink-0"
        style={{
          width: "min(96vw, calc(92vh * 1799 / 992), 1120px)",
          aspectRatio: "1799 / 992",
          containerType: "size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Purple frame — Frame 54 root fill #6f12e1 @ 85%. SHARP full-bleed rectangle
            (Figma has NO corner radius here; only the inner dark card is rounded). */}
        <div className="absolute inset-0 overflow-hidden">
          {bgImage && (
            <img src={bgImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: "#6f12e1d9" }} />
        </div>

        {/* Dark card — Rectangle 2040 (67,32) 1664×929, r39, #070b13, border #524eae96 */}
        <div
          className="absolute"
          style={{
            left: cqw(67), top: cqw(32), width: cqw(1664), height: cqw(929),
            borderRadius: cqw(39), background: "#070b13",
            border: "1px solid #524eae96",
          }}
        />

        {/* Divider — Line 1 (224,136) w1350, faint white (right edge x1574 = laptop right edge) */}
        <div
          className="absolute"
          style={{ left: cqw(224), top: cqw(136), width: cqw(1350), height: "1px", background: "rgba(255,255,255,0.22)" }}
        />

        {/* ── LEFT CONTENT — each block absolutely anchored at its EXACT Figma (x,y) so
             every inter-element distance is pixel-faithful to Frame 54 (logo/title 203,
             pills 354, price 435, URLs 618, CTA 815). ── */}

        {/* Logo slot — Favicon 96×96 r20 @ (224,203) */}
        <div
          className="absolute overflow-hidden flex items-center justify-center"
          style={{
            left: cqw(224), top: cqw(203), width: cqw(96), height: cqw(96), borderRadius: cqw(20),
            background: service.logoIconUrl ? "transparent" : "rgba(255,255,255,0.06)",
            border: service.logoIconUrl ? "none" : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {service.logoIconUrl && (
            <img
              src={getOriginalImageUrl(service.logoIconUrl)}
              alt={t(service.title)}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Title — Inter Bold 86.31 @ box (342,195); Figma line-box 148 centers the text
            vertically against the logo exactly as in the design */}
        <h2
          className="absolute font-bold text-white m-0 whitespace-nowrap"
          style={{ left: cqw(342), top: cqw(195), fontSize: cqw(86.31), lineHeight: cqw(148), letterSpacing: "-0.01em" }}
        >
          {t(service.title) || FALLBACK_TITLE}
        </h2>

        {/* Feature pills — #d4b9f6 fill, #6f12e1 border+text, SemiBold 23.23, h45, gap28 @ (224,354).
            Pills auto-width to their label and wrap to a second row when they exceed 660. */}
        <div
          className="absolute flex flex-wrap items-center"
          style={{ left: cqw(224), top: cqw(354), width: cqw(660), gap: cqw(28) }}
        >
          {displayFeatures.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center font-semibold whitespace-nowrap"
              style={{
                height: cqw(45), paddingLeft: cqw(13), paddingRight: cqw(13),
                borderRadius: cqw(45), fontSize: cqw(23.23), lineHeight: 1,
                background: "#d4b9f6", color: "#6f12e1", border: "1px solid #6f12e1",
              }}
            >
              {t(f)}
            </span>
          ))}
        </div>

        {/* Price — "$69" big (800) + "/mo" small (300) @ (226,435) */}
        <div className="absolute flex items-baseline" style={{ left: cqw(226), top: cqw(435) }}>
          <span className="text-white" style={{ fontSize: cqw(120), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {service.price || "$69"}
          </span>
          <span style={{ fontSize: cqw(48), fontWeight: 300, lineHeight: 1, marginLeft: cqw(6), color: "rgba(255,255,255,0.6)" }}>
            {t(service.priceLabel) || "/mo"}
          </span>
        </div>

        {/* URL list — Inter Regular 29.31, line-height 35 @ (226,618) */}
        <div className="absolute flex flex-col items-start" style={{ left: cqw(226), top: cqw(618) }}>
          {displayUrls.map((url, i) => (
            <a
              key={i}
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline whitespace-nowrap"
              style={{ fontSize: cqw(29.31), lineHeight: cqw(35), fontWeight: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              {url}
            </a>
          ))}
        </div>

        {/* CTA — not in Figma; kept in the empty lower-left band @ (226,815) so it never
            overlaps the clone (URLs end ≈758, card bottom ≈961) */}
        <button
          onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
          className="absolute bg-primary text-white font-bold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ left: cqw(226), top: cqw(815), paddingLeft: cqw(34), paddingRight: cqw(34), height: cqw(64), fontSize: cqw(22) }}
        >
          {t(service.ctaText) || "Get Started"}
        </button>

        {/* Description — (1006,224) Inter Light 30.31; clamped to 2 lines like the Figma box
            so it never spills onto the laptop screen (screen top ≈ y333) */}
        <p
          className="absolute text-white m-0"
          style={{
            left: cqw(1006), top: cqw(224), width: cqw(475),
            fontSize: cqw(30.31), fontWeight: 300, lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {t(service.description) || FALLBACK_DESCRIPTION}
        </p>

        {/* Laptop mockup — pixel-fixed at (844,253) 730 wide; slider images fill the screen */}
        <div
          className="absolute"
          style={{ left: cqw(844), top: cqw(253), width: cqw(730) }}
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
                <span className="text-gray-500" style={{ fontSize: cqw(20) }}>No screenshots</span>
              </div>
            )}
          </LaptopMockup>

          {/* Dot indicators */}
          {sliderImages.length > 1 && (
            <div className="flex justify-center" style={{ gap: cqw(14), marginTop: cqw(16) }}>
              {sliderImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${i === currentSlide ? "bg-white" : "bg-white/30 hover:bg-white/60"}`}
                  style={{ width: cqw(i === currentSlide ? 28 : 16), height: cqw(16) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
