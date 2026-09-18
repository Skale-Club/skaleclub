import { useEffect, useState } from "react";
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

const SLIDE_MS = 4500;

/**
 * Popup visual. With screens it is a gallery (progress segments, pauses on
 * hover and for reduced motion); without, it is the same Cover as the card.
 */
export function DetailVisual({ item }: { item: CatalogItem }) {
  const slides = item.screens.length ? [...(item.cover ? [item.cover] : []), ...item.screens] : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => setIndex(0), [item.key]);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, item.key]);

  if (slides.length === 0) return <Cover item={item} className="cat-detail__visual" width={1200} />;

  return (
    <div
      className="cat-cover cat-detail__visual"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((url, i) => (
        <img
          key={url}
          className="cat-cover__slide"
          src={getImageUrl(url, { width: 1200, quality: 82 })}
          alt=""
          aria-hidden={i !== index}
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {slides.length > 1 && (
        <div className="cat-cover__segs">
          {slides.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
