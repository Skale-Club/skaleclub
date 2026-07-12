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
  variant?: "dark" | "light";
}

/*
 * Pixel-exact clone of three Figma breakpoint frames, switched by viewport width:
 *   - Desktop: "Frame 54" (1702:58), two-column layout, card 1664×929.
 *   - Tablet:  "Frame 55" (1726:387), single-column stacked layout, card 586×1214.
 *   - Mobile:  "Frame 56" (1726:388), single-column stacked layout, card 306×774.
 * Each Figma frame also contains a purple "screen size" rectangle (1920×1080 /
 * 744×1248 / 360×777) that the designer added purely as a device-scale reference —
 * it never renders on the site, only the dark card + its contents does.
 *
 * Each variant renders in its own frame's native coordinate space and scales as one
 * unit via CSS container units: the wrapper is a size-container, and children are
 * sized in `cqw` (1% of the wrapper's width). Desktop keeps the small margin the
 * card has within its Figma frame (67/32px inset); tablet/mobile cards fill their
 * wrapper edge-to-edge, since in those frames the card is effectively the whole
 * popup with no extra chrome around it.
 *
 * Shared by both the dark /portfolio popup and the light homepage "Solutions"
 * carousel popup (`variant` swaps card/text colors only — geometry never changes).
 */
const U = 17.99; // Desktop: Figma px per 1cqw (1799px width / 100)
const cqw = (px: number) => `${(px / U).toFixed(3)}cqw`;

const U_TABLET = 5.86; // Tablet: card width (586px) / 100
const cqwT = (px: number) => `${(px / U_TABLET).toFixed(3)}cqw`;

const U_TABLET_CONTENT = 6.67; // Tablet content: Figma Frame 58 card width (667px) / 100
const cqwTContent = (px: number) => `${(px / U_TABLET_CONTENT).toFixed(3)}cqw`;

const U_MOBILE = 3.06; // Mobile: card width (306px) / 100
const cqwM = (px: number) => `${(px / U_MOBILE).toFixed(3)}cqw`;

type CqwFn = (px: number) => string;

// Shrinks proportionally with the card on viewports narrower than the Figma
// reference (so content never looks oversized on a real device), but never
// grows past the exact Figma pixel value on wider cards (the "don't make
// icons/text bigger, just stretch the container" rule from an earlier pass).
const capAtFigmaSize = (cqwFn: CqwFn, px: number) => `min(${cqwFn(px)}, ${px}px)`;

// Card chrome + text colors. Everything else (feature pills, CTA button,
// laptop bezel, nav/close buttons, slider dots) is a self-contained element
// that already reads fine on both a dark and a light card, so it stays fixed
// across variants — only what sits directly on the card background changes.
const THEME = {
  dark: {
    cardBg: "#070b13",
    cardBorder: "1px solid #524eae96",
    cardShadow: "none",
    divider: "rgba(255,255,255,0.22)",
    iconBg: "rgba(255,255,255,0.06)",
    iconBorder: "1px solid rgba(255,255,255,0.12)",
    title: "#ffffff",
    description: "#ffffff",
    price: "#ffffff",
    priceLabel: "rgba(255,255,255,0.6)",
    urlClass: "text-white hover:underline",
  },
  light: {
    cardBg: "#ffffff",
    cardBorder: "1px solid #e2e8f0",
    cardShadow: "0 40px 100px -25px rgba(0,0,0,0.55)",
    divider: "rgba(15,23,42,0.1)",
    iconBg: "#f1f5f9",
    iconBorder: "1px solid #e2e8f0",
    title: "#0f172a",
    description: "#334155",
    price: "#0f172a",
    priceLabel: "#64748b",
    urlClass: "text-slate-600 hover:text-slate-900 hover:underline",
  },
} as const;

// Figma placeholder content — used only as empty-state fallback, never over real data.
const FALLBACK_TITLE = "Title Title";
const FALLBACK_FEATURES = ["Site-integrated", "Site-integrated", "Site-integrated"];
const FALLBACK_DESCRIPTION =
  "Description description descriptiondescriptiondescription";

export function ServiceDetailModal({ service, isOpen, onClose, onCta, onPrev, onNext, variant = "dark" }: ServiceDetailModalProps) {
  const { t, isEnglish } = useTranslation();
  const theme = THEME[variant];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const [leftColSize, setLeftColSize] = useState<{ width: number; height: number } | null>(null);

  const sliderImages: string[] = (service.popupSliderImages as string[]) || [];
  const popupUrls: string[] = (service.popupUrls as string[]) || [];
  const features: string[] = (service.features as string[]) || [];

  const displayFeatures = features.length > 0 ? features : FALLBACK_FEATURES;

  useEffect(() => {
    setCurrentSlide(0);
  }, [service.id]);

  useEffect(() => {
    if (!isOpen || !leftColRef.current) return;
    const el = leftColRef.current;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width && rect.height) setLeftColSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, service.id]);

  const LAPTOP_RATIO = 690 / 446;
  // Desktop Container 3 has no gap between its columns (see gridTemplateColumns
  // below) — the right column's own width equals the left column's width plus
  // the gap that used to sit between them. Keep this in sync with that calc.
  const RECLAIMED_GAP = 32;
  let laptopBoxSize: { width: number; height: number } | null = null;
  if (leftColSize) {
    const rightColWidth = leftColSize.width + RECLAIMED_GAP;
    laptopBoxSize = rightColWidth / leftColSize.height > LAPTOP_RATIO
      ? { width: leftColSize.height * LAPTOP_RATIO, height: leftColSize.height }
      : { width: rightColWidth, height: rightColWidth / LAPTOP_RATIO };
  }

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

  const renderDivider = () => (
    <div className="w-full shrink-0" style={{ height: "1px", background: theme.divider }} />
  );

  const renderFavicon = (cqwFn: CqwFn, size: number, radius: number) => (
    <div
      className="shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: capAtFigmaSize(cqwFn, size), height: capAtFigmaSize(cqwFn, size), borderRadius: capAtFigmaSize(cqwFn, radius),
        background: service.logoIconUrl ? "transparent" : theme.iconBg,
        border: service.logoIconUrl ? "none" : theme.iconBorder,
      }}
    >
      {service.logoIconUrl && (
        <img src={getOriginalImageUrl(service.logoIconUrl)} alt={service.title} className="w-full h-full object-contain" />
      )}
    </div>
  );

  const renderTitle = (cqwFn: CqwFn, fontSize: number, lineHeight: number) => (
    <h2
      className="font-bold m-0 overflow-hidden flex-1 min-w-0"
      style={{
        fontSize: capAtFigmaSize(cqwFn, fontSize),
        lineHeight: capAtFigmaSize(cqwFn, lineHeight), letterSpacing: "-0.01em",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        color: theme.title,
      }}
    >
      {service.title || FALLBACK_TITLE}
    </h2>
  );

  // Pill padding follows an X/2X rule: paddingY (top+bottom) = X, paddingX
  // (left+right) = 2X — same amount above/below the text, double that on
  // each side. `gap` is a literal pre-formatted CSS value (not run through
  // cqwFn) since it must be the exact same fixed pixel amount on every
  // breakpoint, not proportional to the card.
  const renderPills = (cqwFn: CqwFn, fontSize: number, paddingY: number, paddingX: number, gap: string) => (
    <div className="flex items-center flex-wrap" style={{ gap }}>
      {displayFeatures.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center font-semibold whitespace-nowrap rounded-full shrink-0"
          style={{
            paddingTop: capAtFigmaSize(cqwFn, paddingY), paddingBottom: capAtFigmaSize(cqwFn, paddingY),
            paddingLeft: capAtFigmaSize(cqwFn, paddingX), paddingRight: capAtFigmaSize(cqwFn, paddingX),
            fontSize: capAtFigmaSize(cqwFn, fontSize), lineHeight: 1,
            background: "#d4b9f6", color: "#6f12e1", border: "1px solid #6f12e1",
          }}
        >
          {t(f)}
        </span>
      ))}
    </div>
  );

  const renderPrice = (cqwFn: CqwFn, bigSize: number, smallSize: number) => (
    <div className="flex items-baseline flex-wrap" style={{ columnGap: capAtFigmaSize(cqwFn, bigSize * 0.2), rowGap: capAtFigmaSize(cqwFn, smallSize * 0.3) }}>
      <div className="flex items-baseline">
        <span style={{ fontSize: capAtFigmaSize(cqwFn, bigSize), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: theme.price }}>
          {service.price || "$69"}
        </span>
        <span style={{ fontSize: capAtFigmaSize(cqwFn, smallSize), fontWeight: 300, lineHeight: 1, marginLeft: capAtFigmaSize(cqwFn, smallSize * 0.125), color: theme.priceLabel }}>
          {t(service.priceLabel) || "/mo"}
        </span>
      </div>
      {service.setupPrice && (
        <div className="flex items-baseline">
          <span style={{ fontSize: capAtFigmaSize(cqwFn, smallSize), fontWeight: 700, lineHeight: 1, color: theme.priceLabel }}>
            +{service.setupPrice}
          </span>
          <span style={{ fontSize: capAtFigmaSize(cqwFn, smallSize * 0.7), fontWeight: 300, lineHeight: 1, marginLeft: capAtFigmaSize(cqwFn, smallSize * 0.125), color: theme.priceLabel }}>
            {t("setup")}
          </span>
        </div>
      )}
    </div>
  );

  const renderDescription = (cqwFn: CqwFn, fontSize: number, maxLines = 4) => (
    <p
      className="m-0"
      style={{
        fontSize: capAtFigmaSize(cqwFn, fontSize),
        fontWeight: 300, lineHeight: 1.35,
        display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical", overflow: "hidden",
        color: theme.description,
      }}
    >
      {t(service.description) || FALLBACK_DESCRIPTION}
    </p>
  );

  const renderUrls = (cqwFn: CqwFn, fontSize: number, lineHeight: number, maxWidth: string) => (
    <div className="flex flex-col items-start">
      {popupUrls.map((url, i) => (
        <a
          key={i}
          href={url.startsWith("http") ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${theme.urlClass} whitespace-nowrap overflow-hidden text-ellipsis block`}
          style={{ fontSize: capAtFigmaSize(cqwFn, fontSize), lineHeight: capAtFigmaSize(cqwFn, lineHeight), fontWeight: 400, maxWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      ))}
    </div>
  );

  // width is a plain percentage string (e.g. "50%") so the button stretches
  // relative to its container instead of a fixed size — height and fontSize
  // stay independently controlled via cqwFn, unaffected by that stretch.
  const renderCta = (cqwFn: CqwFn, width: string, height: number, fontSize: number) => (
    <button
      onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
      className="flex items-center justify-center rounded-full text-white font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
      style={{ width, height: capAtFigmaSize(cqwFn, height), fontSize: capAtFigmaSize(cqwFn, fontSize), background: "#4c4ac1", border: "1px solid #34336f", alignSelf: "center" }}
    >
      {isEnglish ? "Start" : "Começar"}
    </button>
  );


  const renderScreen = (cqwFn: CqwFn, emptyFontSize: number) => (
    sliderImages.length > 0 ? (
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
        <span className="text-gray-500" style={{ fontSize: capAtFigmaSize(cqwFn, emptyFontSize) }}>{t("No screenshots")}</span>
      </div>
    )
  );

  const renderDots = (cqwFn: CqwFn) => (
    sliderImages.length > 1 && (
      <div className="flex justify-center" style={{ gap: capAtFigmaSize(cqwFn, 14), marginTop: capAtFigmaSize(cqwFn, 16) }}>
        {sliderImages.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${i === currentSlide ? "bg-white" : "bg-white/30 hover:bg-white/60"}`}
            style={{ width: capAtFigmaSize(cqwFn, i === currentSlide ? 28 : 16), height: capAtFigmaSize(cqwFn, 16) }}
          />
        ))}
      </div>
    )
  );

  const renderLaptop = (cqwFn: CqwFn, width: string, emptyFontSize: number) => (
    <div
      className="shrink-0"
      style={{ width, alignSelf: "center" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <LaptopMockup>{renderScreen(cqwFn, emptyFontSize)}</LaptopMockup>
      {renderDots(cqwFn)}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      style={{ alignItems: "safe center", scrollbarGutter: "stable both-edges" }}
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous service"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next service"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className="relative shrink-0 hidden lg:block"
        style={{
          width: "min(72vw, 980px)",
          containerType: "inline-size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0" style={{ borderRadius: cqw(39), background: theme.cardBg, border: theme.cardBorder, boxShadow: theme.cardShadow }} />

        <div className="relative flex flex-col" style={{ padding: `64px ${cqw(157)}`, gap: "32px" }}>
          {renderDivider()}

          {/* Container 1: logo + title, full width */}
          <div className="flex items-center" style={{ gap: cqw(46) }}>
            <div
              className="shrink-0 overflow-hidden flex items-center justify-center"
              style={{
                width: cqw(115.2), height: cqw(115.2), borderRadius: cqw(24),
                background: service.logoIconUrl ? "transparent" : theme.iconBg,
                border: service.logoIconUrl ? "none" : theme.iconBorder,
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

            <h2
              className="font-bold m-0 flex-1 min-w-0"
              style={{
                fontSize: cqw(103.57),
                lineHeight: cqw(119.11), letterSpacing: "-0.01em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                color: theme.title,
              }}
            >
              {service.title || FALLBACK_TITLE}
            </h2>
          </div>

          {/* Container 2: description, full width, no truncation */}
          <p
            className="m-0"
            style={{ fontSize: cqw(33), fontWeight: 300, lineHeight: 1.32, color: theme.description }}
          >
            {t(service.description) || FALLBACK_DESCRIPTION}
          </p>

          {/* Pills: own full-width row so they always stay on one line,
              regardless of the two-column grid below. No padding of its own —
              it just sits in the same top-level flex column, so it inherits
              the existing 32px gap above and below like every other row. */}
          <div className="flex items-center flex-wrap" style={{ gap: "7.61px" }}>
            {displayFeatures.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center font-semibold whitespace-nowrap rounded-full"
                style={{
                  paddingTop: cqw(13.06), paddingBottom: cqw(13.06),
                  paddingLeft: cqw(26.12), paddingRight: cqw(26.12),
                  fontSize: cqw(27.88), lineHeight: 1,
                  background: "#d4b9f6", color: "#6f12e1", border: "1px solid #6f12e1",
                }}
              >
                {t(f)}
              </span>
            ))}
          </div>

          {/* Container 3: two containers side by side, no gap — the right
              (laptop) column absorbs the space a gap would have taken. */}
          <div className="grid items-start" style={{ gridTemplateColumns: `calc(50% - ${RECLAIMED_GAP / 2}px) 1fr` }}>
            {/* Left: price, CTA button, reference links */}
            <div ref={leftColRef} className="flex flex-col" style={{ gap: "32px" }}>
              <div className="flex items-baseline flex-wrap" style={{ columnGap: cqw(24), rowGap: cqw(14) }}>
                <div className="flex items-baseline">
                  <span style={{ fontSize: cqw(120), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: theme.price }}>
                    {service.price || "$69"}
                  </span>
                  <span style={{ fontSize: cqw(48), fontWeight: 300, lineHeight: 1, marginLeft: cqw(6), color: theme.priceLabel }}>
                    {t(service.priceLabel) || "/mo"}
                  </span>
                </div>
                {service.setupPrice && (
                  <div className="flex items-baseline">
                    <span style={{ fontSize: cqw(48), fontWeight: 700, lineHeight: 1, color: theme.priceLabel }}>
                      +{service.setupPrice}
                    </span>
                    <span style={{ fontSize: cqw(34), fontWeight: 300, lineHeight: 1, marginLeft: cqw(6), color: theme.priceLabel }}>
                      {t("setup")}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
                className="flex items-center justify-center text-white font-bold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  width: cqw(308.16), height: cqw(97.92), fontSize: cqw(36),
                  background: "#4c4ac1", border: "1px solid #34336f",
                }}
              >
                {isEnglish ? "Start" : "Começar"}
              </button>

              <div className="flex flex-col items-start">
                {popupUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url.startsWith("http") ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${theme.urlClass} whitespace-nowrap overflow-hidden text-ellipsis block`}
                    style={{ fontSize: cqw(29.31), lineHeight: cqw(35), fontWeight: 400, maxWidth: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {url}
                  </a>
                ))}
              </div>
            </div>

            {/* Right: laptop mockup, sized to fill this (gap-enlarged) column,
                capped to the left column's height so row height is unaffected */}
            <div
              className="flex flex-col items-center justify-center"
              style={{ height: leftColSize ? `${leftColSize.height}px` : undefined }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div className="shrink-0" style={laptopBoxSize ? { width: laptopBoxSize.width, height: laptopBoxSize.height } : { width: "100%", aspectRatio: "690 / 446" }}>
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
              </div>

              {sliderImages.length > 1 && (
                <div className="flex justify-center shrink-0" style={{ gap: cqw(14), marginTop: cqw(16) }}>
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
      </div>

      <div
        className="relative shrink-0 hidden sm:block lg:hidden"
        style={{
          width: "min(100vw, 90vh, 900px)",
          containerType: "inline-size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0" style={{ borderRadius: cqwT(39), background: theme.cardBg, border: theme.cardBorder, boxShadow: theme.cardShadow }} />
        <div className="relative flex flex-col" style={{ paddingLeft: cqwT(52), paddingRight: cqwT(52), paddingTop: "66px", paddingBottom: "66px", gap: "33px" }}>
          {renderDivider()}
          {/* Content sizes below are Figma Frame 58's values scaled by 0.8 (per
              explicit request to shrink content ~20% without touching any
              gap/padding/margin, which stay at their original values). */}
          <div className="flex items-center" style={{ gap: "27px" }}>
            {renderFavicon(cqwTContent, 76.8, 16)}
            {renderTitle(cqwTContent, 51.52, 59.25)}
          </div>
          {renderDescription(cqwTContent, 17.5, 4)}
          {renderPills(cqwTContent, 16.15, 7.56, 15.12, "7.61px")}
          {renderPrice(cqwTContent, 57.6, 23.2)}
          {renderCta(cqwTContent, "50%", 68, 23.06)}
          {renderLaptop(cqwTContent, "100%", 12.15)}
          {renderUrls(cqwTContent, 17.5, 20.88, "100%")}
        </div>
      </div>

      <div
        className="relative shrink-0 block sm:hidden"
        style={{
          width: "min(94vw, 60vh, 580px)",
          containerType: "inline-size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0" style={{ borderRadius: cqwM(38.37), background: theme.cardBg, border: theme.cardBorder, boxShadow: theme.cardShadow }} />
        <div className="relative flex flex-col" style={{ paddingLeft: cqwM(34), paddingRight: cqwM(34), paddingTop: "42px", paddingBottom: "42px", gap: "21px" }}>
          {renderDivider()}
          <div className="flex items-center" style={{ gap: "8px" }}>
            {renderFavicon(cqwM, 56, 11.72)}
            {renderTitle(cqwM, 36.03, 41.43)}
          </div>
          {renderDescription(cqwM, 13.55, 4)}
          {renderPills(cqwM, 11.54, 5.39, 10.8, "7.61px")}
          {renderPrice(cqwM, 50, 20)}
          {renderCta(cqwM, "70%", 49.09, 16.65)}
          {renderLaptop(cqwM, "100%", 8.62)}
          {renderUrls(cqwM, 10.71, 12.79, "100%")}
        </div>
      </div>
    </div>
  );
}
