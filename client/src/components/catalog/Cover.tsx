import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { siteDomain, type CatalogItem } from "@shared/catalog";
import { getImageUrl } from "@/components/admin/shared/utils";
import { useTranslation } from "@/hooks/useTranslation";
import "./catalog.css";

/**
 * The cover slot: fixed ratio, one of three designed states, never an empty box.
 *
 * - composed: a product's real website home inside a browser window, on the
 *   brand surface. Every product cover comes out of the same family by
 *   construction, whatever the screenshot looks like.
 * - photo: a service's artwork, under one shared wash.
 * - empty: no image at all, so the product's mark (or its name) becomes the art.
 */
export function Cover({ item, className = "", width = 800 }: { item: CatalogItem; className?: string; width?: number }) {
  const { t } = useTranslation();
  const badge = item.badge ? <span className="cat-cover__badge">{t(item.badge)}</span> : null;

  if (item.kind === "service") {
    if (!item.cover) return <EmptyCover item={item} className={className} badge={badge} />;
    return (
      <div className={`cat-cover ${className}`}>
        <img className="cat-cover__photo" src={getImageUrl(item.cover, { width, quality: 80 })} alt="" loading="lazy" decoding="async" />
        <div className="cat-cover__wash" />
        {badge}
      </div>
    );
  }

  if (!item.cover) return <EmptyCover item={item} className={className} badge={badge} />;
  const domain = siteDomain(item.site) ?? siteDomain(item.links[0]);
  return (
    <div className={`cat-cover cat-cover--composed ${className}`}>
      {item.logo && (
        <span className="cat-cover__mark">
          <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" loading="lazy" />
        </span>
      )}
      {badge}
      <div className="cat-cover__win">
        <div className="cat-cover__bar" aria-hidden="true">
          <i /><i /><i />
          {domain && <span>{domain}</span>}
        </div>
        <img
          src={getImageUrl(item.cover, { width, quality: 80 })}
          alt={`${item.title} | ${t("Website home")}`}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

function EmptyCover({ item, className, badge }: { item: CatalogItem; className: string; badge: React.ReactNode }) {
  return (
    <div className={`cat-cover cat-cover--empty ${className}`}>
      {badge}
      {item.logo ? (
        <img className="cat-cover__logo" src={getImageUrl(item.logo, { width: 400, quality: 90 })} alt="" loading="lazy" />
      ) : (
        <span className="cat-cover__word">{item.title}</span>
      )}
    </div>
  );
}

const SLIDE_MS = 6500;

/**
 * Popup visual. Extra screens activate the carousel; until then, the existing
 * top-anchored homepage remains the only visual. The dashboard and additional
 * screenshots can be added later from the portfolio admin without changing UI.
 */
export function DetailVisual({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const slides = item.screens.length ? [
    ...(item.cover ? [{ url: item.cover, label: t("Website home"), kind: "home" as const }] : []),
    ...item.screens.map((screen, i) => ({
      url: screen.url,
      label: screen.kind === "dashboard"
        ? t("Inside the app")
        : `${t("Screenshot")} ${item.screens.slice(0, i + 1).filter((entry) => entry.kind === "screenshot").length}`,
      kind: screen.kind,
    })),
  ] : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tallScreens, setTallScreens] = useState<Record<string, boolean>>({});
  const step = (delta: number) => setIndex((current) => (current + delta + slides.length) % slides.length);

  useEffect(() => setIndex(0), [item.key]);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, item.key]);

  if (slides.length === 0) {
    if (item.kind === "product" && item.cover) {
      return (
        <div className="cat-cover cat-detail__visual cat-detail__frontpage">
          <img
            src={getImageUrl(item.cover, { width: 1200, quality: 82 })}
            alt={`${item.title} | ${t("Website home")}`}
            loading="eager"
            decoding="async"
          />
          {item.badge && <span className="cat-cover__badge">{t(item.badge)}</span>}
        </div>
      );
    }
    return <Cover item={item} className="cat-detail__visual" width={1200} />;
  }

  return (
    <div
      className="cat-cover cat-detail__visual cat-detail__gallery"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          event.stopPropagation();
          step(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      role="region"
      aria-label={`${item.title} ${t("screenshots")}`}
    >
      {slides.map((slide, i) => (
        <img
          key={slide.url}
          className={`cat-cover__slide cat-cover__slide--${slide.kind === "home" ? "home" : "screen"}${tallScreens[slide.url] ? " cat-cover__slide--tall" : ""}`}
          src={getImageUrl(slide.url, { width: 1200, quality: 82 })}
          alt={i === index ? `${item.title} | ${slide.label}` : ""}
          aria-hidden={i !== index}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          onLoad={(event) => {
            const image = event.currentTarget;
            if (slide.kind !== "home" && image.naturalHeight > image.naturalWidth * 1.3) {
              setTallScreens((current) => current[slide.url] ? current : { ...current, [slide.url]: true });
            }
          }}
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {slides.length > 1 && (
        <div className="cat-detail__gallery-controls">
          <div className="cat-detail__gallery-heading" aria-live="polite">
            <span>{slides[index]?.label}</span>
            <span>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          </div>
          <div className="cat-detail__gallery-actions">
            <button type="button" className="cat-detail__gallery-arrow" onClick={() => step(-1)} aria-label={t("Previous image")}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="cat-cover__segs" aria-label={t("Choose image")}>
              {slides.map((slide, i) => (
                <button
                  key={slide.url}
                  type="button"
                  aria-label={`${slide.label} (${i + 1}/${slides.length})`}
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button type="button" className="cat-detail__gallery-arrow" onClick={() => step(1)} aria-label={t("Next image")}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
