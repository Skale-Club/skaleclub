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

        {/* ── LEFT CONTENT — each block absolutely anchored at a fixed Figma (x,y). Base
             Figma positions were logo/title 203, pills 354, price 435, URLs 618, CTA 815;
             pills/price/URLs are now shifted +50.51 to make room for the 2-line title, and
             the CTA sits beside the URL list instead of below it (see each block's comment). ── */}

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
              alt={service.title}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Title — Inter Bold 86.31 @ box (342,195). Product/app names are proper nouns and are
            never translated. Wraps to a max of 2 lines (compact line-height so the extra line
            doesn't push everything below it down too far) instead of overlapping the
            description; width is still capped to the gap before the description (starts at 844). */}
        <h2
          className="absolute font-bold text-white m-0 overflow-hidden"
          style={{
            left: cqw(342), top: cqw(195), width: cqw(482), fontSize: cqw(86.31),
            lineHeight: cqw(99.26), letterSpacing: "-0.01em",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}
        >
          {service.title || FALLBACK_TITLE}
        </h2>

        {/* Feature pills — #d4b9f6 fill, #6f12e1 border+text, SemiBold 23.23, h45, gap28.
            top shifted +50.51 vs the original 354 to absorb the 2-line title's extra height.
            Pills auto-width to their label and wrap to a second row when they exceed 660. */}
        <div
          className="absolute flex flex-wrap items-center"
          style={{ left: cqw(224), top: cqw(404.51), width: cqw(660), gap: cqw(28) }}
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

        {/* Price — "$69" big (800) + "/mo" small (300). top shifted +50.51 (see title comment) */}
        <div className="absolute flex items-baseline" style={{ left: cqw(226), top: cqw(485.51) }}>
          <span className="text-white" style={{ fontSize: cqw(120), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {service.price || "$69"}
          </span>
          <span style={{ fontSize: cqw(48), fontWeight: 300, lineHeight: 1, marginLeft: cqw(6), color: "rgba(255,255,255,0.6)" }}>
            {t(service.priceLabel) || "/mo"}
          </span>
        </div>

        {/* URL list — Inter Regular 29.31, line-height 35. top shifted +50.51 (see title comment).
            Capped to 280 wide with an ellipsis so long domains can never run under the CTA
            button, which now sits to the right of this list instead of below it. */}
        <div className="absolute flex flex-col items-start" style={{ left: cqw(226), top: cqw(668.51) }}>
          {displayUrls.map((url, i) => (
            <a
              key={i}
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline whitespace-nowrap overflow-hidden text-ellipsis block"
              style={{ fontSize: cqw(29.31), lineHeight: cqw(35), fontWeight: 400, maxWidth: cqw(280) }}
              onClick={(e) => e.stopPropagation()}
            >
              {url}
            </a>
          ))}
        </div>

        {/* CTA — not in Figma; sits to the right of the URL list, vertically centered against
            it (URL block spans 668.51-808.51, center 738.51, minus half the button height).
            Capped to the remaining width up to the laptop boundary (844) with an ellipsis
            safety net so it can never overlap the mockup even with a very long label. */}
        <button
          onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
          className="absolute bg-primary text-white font-bold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            left: cqw(534), top: cqw(697.01),
            paddingLeft: cqw(44), paddingRight: cqw(44), height: cqw(83), fontSize: cqw(29),
            maxWidth: cqw(310),
          }}
        >
          {t(service.ctaText) || "Get Started"}
        </button>

        {/* Description — spans the same left/width as the laptop mockup below (844,730)
            so its edges line up with the laptop's borders; clamped to 3 lines */}
        <p
          className="absolute text-white m-0"
          style={{
            left: cqw(844), top: cqw(224), width: cqw(730),
            fontSize: cqw(30.31), fontWeight: 300, lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
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
                <span className="text-gray-500" style={{ fontSize: cqw(20) }}>{t("No screenshots")}</span>
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
