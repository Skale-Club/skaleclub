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
 */
const U = 17.99; // Desktop: Figma px per 1cqw (1799px width / 100)
const cqw = (px: number) => `${(px / U).toFixed(3)}cqw`;

const U_TABLET = 5.86; // Tablet: card width (586px) / 100
const cqwT = (px: number) => `${(px / U_TABLET).toFixed(3)}cqw`;

const U_MOBILE = 3.06; // Mobile: card width (306px) / 100
const cqwM = (px: number) => `${(px / U_MOBILE).toFixed(3)}cqw`;

type CqwFn = (px: number) => string;

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
  const { t, isEnglish } = useTranslation();
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

  const renderDivider = (cqwFn: CqwFn, left: number, top: number, width: number) => (
    <div className="absolute" style={{ left: cqwFn(left), top: cqwFn(top), width: cqwFn(width), height: "1px", background: "rgba(255,255,255,0.22)" }} />
  );

  const renderFavicon = (cqwFn: CqwFn, size: number, radius: number) => (
    <div
      className="shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: cqwFn(size), height: cqwFn(size), borderRadius: cqwFn(radius),
        background: service.logoIconUrl ? "transparent" : "rgba(255,255,255,0.06)",
        border: service.logoIconUrl ? "none" : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {service.logoIconUrl && (
        <img src={getOriginalImageUrl(service.logoIconUrl)} alt={service.title} className="w-full h-full object-contain" />
      )}
    </div>
  );

  const renderTitle = (cqwFn: CqwFn, fontSize: number, lineHeight: number) => (
    <h2
      className="font-bold text-white m-0 overflow-hidden flex-1 min-w-0"
      style={{
        fontSize: cqwFn(fontSize),
        lineHeight: cqwFn(lineHeight), letterSpacing: "-0.01em",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}
    >
      {service.title || FALLBACK_TITLE}
    </h2>
  );

  const renderPills = (cqwFn: CqwFn, height: number, fontSize: number, gap: number) => (
    <div className="flex items-center" style={{ gap: cqwFn(gap) }}>
      {displayFeatures.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center font-semibold whitespace-nowrap rounded-full shrink-0"
          style={{
            height: cqwFn(height), paddingLeft: cqwFn(height * 0.289), paddingRight: cqwFn(height * 0.289),
            fontSize: cqwFn(fontSize), lineHeight: 1,
            background: "#d4b9f6", color: "#6f12e1", border: "1px solid #6f12e1",
          }}
        >
          {t(f)}
        </span>
      ))}
    </div>
  );

  const renderPrice = (cqwFn: CqwFn, bigSize: number, smallSize: number) => (
    <div className="flex items-baseline">
      <span className="text-white" style={{ fontSize: cqwFn(bigSize), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {service.price || "$69"}
      </span>
      <span style={{ fontSize: cqwFn(smallSize), fontWeight: 300, lineHeight: 1, marginLeft: cqwFn(smallSize * 0.125), color: "rgba(255,255,255,0.6)" }}>
        {t(service.priceLabel) || "/mo"}
      </span>
    </div>
  );

  const renderDescription = (cqwFn: CqwFn, fontSize: number, maxLines = 4) => (
    <p
      className="text-white m-0"
      style={{
        fontSize: cqwFn(fontSize),
        fontWeight: 300, lineHeight: 1.35,
        display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}
    >
      {t(service.description) || FALLBACK_DESCRIPTION}
    </p>
  );

  const renderUrls = (cqwFn: CqwFn, fontSize: number, lineHeight: number, maxWidth: number) => (
    <div className="flex flex-col items-start">
      {displayUrls.map((url, i) => (
        <a
          key={i}
          href={url.startsWith("http") ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:underline whitespace-nowrap overflow-hidden text-ellipsis block"
          style={{ fontSize: cqwFn(fontSize), lineHeight: cqwFn(lineHeight), fontWeight: 400, maxWidth: cqwFn(maxWidth) }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      ))}
    </div>
  );

  const renderCta = (cqwFn: CqwFn, width: number, height: number, fontSize: number) => (
    <button
      onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
      className="flex items-center justify-center rounded-full text-white font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
      style={{ width: cqwFn(width), height: cqwFn(height), fontSize: cqwFn(fontSize), background: "#4c4ac1", border: "1px solid #34336f" }}
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
        <span className="text-gray-500" style={{ fontSize: cqwFn(emptyFontSize) }}>{t("No screenshots")}</span>
      </div>
    )
  );

  const renderDots = (cqwFn: CqwFn) => (
    sliderImages.length > 1 && (
      <div className="flex justify-center" style={{ gap: cqwFn(14), marginTop: cqwFn(16) }}>
        {sliderImages.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${i === currentSlide ? "bg-white" : "bg-white/30 hover:bg-white/60"}`}
            style={{ width: cqwFn(i === currentSlide ? 28 : 16), height: cqwFn(16) }}
          />
        ))}
      </div>
    )
  );

  const renderLaptop = (cqwFn: CqwFn, width: number, marginLeft: number, emptyFontSize: number) => (
    <div
      className="shrink-0"
      style={{ width: cqwFn(width), marginLeft: cqwFn(marginLeft) }}
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
      style={{ alignItems: "safe center" }}
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
          width: "min(99vw, calc((96vh - 32px) * 1799 / 992), 1280px)",
          aspectRatio: "1799 / 992",
          containerType: "size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute"
          style={{
            left: cqw(67), top: cqw(32), width: cqw(1664), height: cqw(929),
            borderRadius: cqw(39), background: "#070b13",
            border: "1px solid #524eae96",
          }}
        />

        <div
          className="absolute"
          style={{ left: cqw(224), top: cqw(136), width: cqw(1350), height: "1px", background: "rgba(255,255,255,0.22)" }}
        />

        <div
          className="absolute overflow-hidden flex items-center justify-center"
          style={{
            left: cqw(224), top: cqw(160), width: cqw(96), height: cqw(96), borderRadius: cqw(20),
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

        <h2
          className="absolute font-bold text-white m-0"
          style={{
            left: cqw(366), top: cqw(158), width: cqw(1208), fontSize: cqw(86.31),
            lineHeight: cqw(99.26), letterSpacing: "-0.01em",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {service.title || FALLBACK_TITLE}
        </h2>

        <div
          className="absolute flex items-center"
          style={{ left: cqw(224), top: cqw(414), width: cqw(518), gap: cqw(14) }}
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

        <div className="absolute flex items-baseline" style={{ left: cqw(224), top: cqw(483) }}>
          <span className="text-white" style={{ fontSize: cqw(120), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {service.price || "$69"}
          </span>
          <span style={{ fontSize: cqw(48), fontWeight: 300, lineHeight: 1, marginLeft: cqw(6), color: "rgba(255,255,255,0.6)" }}>
            {t(service.priceLabel) || "/mo"}
          </span>
        </div>

        <div className="absolute flex flex-col items-start" style={{ left: cqw(224), top: cqw(719) }}>
          {displayUrls.map((url, i) => (
            <a
              key={i}
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline whitespace-nowrap overflow-hidden text-ellipsis block"
              style={{ fontSize: cqw(29.31), lineHeight: cqw(35), fontWeight: 400, maxWidth: cqw(460) }}
              onClick={(e) => e.stopPropagation()}
            >
              {url}
            </a>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCta(service.slug); }}
          className="absolute flex items-center justify-center text-white font-bold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            left: cqw(224), top: cqw(627),
            width: cqw(214), height: cqw(68), fontSize: cqw(25),
            background: "#4c4ac1", border: "1px solid #34336f",
          }}
        >
          {isEnglish ? "Start" : "Começar"}
        </button>

        <p
          className="absolute text-white m-0"
          style={{
            left: cqw(224), top: cqw(281), width: cqw(1350),
            fontSize: cqw(27.5), fontWeight: 300, lineHeight: 1.32,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {t(service.description) || FALLBACK_DESCRIPTION}
        </p>

        <div
          className="absolute"
          style={{ left: cqw(844), top: cqw(414), width: cqw(684) }}
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

      <div
        className="relative shrink-0 hidden sm:block lg:hidden"
        style={{
          width: "min(100vw, 82vh, 700px)",
          aspectRatio: "586 / 1214",
          containerType: "size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0" style={{ borderRadius: cqwT(39), background: "#070b13", border: "1px solid #524eae96" }} />
        {renderDivider(cqwT, 52, 74, 476)}
        <div className="absolute flex flex-col" style={{ left: cqwT(52), top: cqwT(117), width: cqwT(476), gap: cqwT(32) }}>
          <div className="flex items-center" style={{ gap: cqwT(21) }}>
            {renderFavicon(cqwT, 96, 20)}
            {renderTitle(cqwT, 51.86, 59.64)}
          </div>
          {renderPills(cqwT, 32.58, 16.82, 20.55)}
          {renderPrice(cqwT, 72, 29)}
          {renderDescription(cqwT, 21.87, 4)}
          {renderCta(cqwT, 226, 85, 28.82)}
          {renderLaptop(cqwT, 489, -3, 13)}
          {renderUrls(cqwT, 21.87, 26.1, 460)}
        </div>
      </div>

      <div
        className="relative shrink-0 block sm:hidden"
        style={{
          width: "min(96vw, 46vh, 440px)",
          aspectRatio: "306 / 774",
          containerType: "size",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0" style={{ borderRadius: cqwM(38.37), background: "#070b13", border: "1px solid #524eae96" }} />
        {renderDivider(cqwM, 35, 32, 236)}
        <div className="absolute flex flex-col" style={{ left: cqwM(34), top: "50%", width: cqwM(236), gap: cqwM(22), transform: "translateY(-50%)" }}>
          <div className="flex items-center" style={{ gap: cqwM(8) }}>
            {renderFavicon(cqwM, 56, 11.72)}
            {renderTitle(cqwM, 36.03, 41.43)}
          </div>
          {renderPills(cqwM, 16.42, 8.48, 10.36)}
          {renderPrice(cqwM, 50, 20)}
          {renderDescription(cqwM, 10.71, 4)}
          {renderCta(cqwM, 151, 44, 17)}
          {renderLaptop(cqwM, 331, -46, 9)}
          {renderUrls(cqwM, 10.71, 12.79, 240)}
        </div>
      </div>
    </div>
  );
}
