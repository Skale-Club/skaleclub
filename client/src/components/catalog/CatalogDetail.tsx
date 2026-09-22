import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { CatalogItem } from "@shared/catalog";
import { getImageUrl } from "@/components/admin/shared/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { PriceTag, useEyebrow } from "./CatalogCard";
import { DetailVisual } from "./Cover";
import "./catalog.css";

const LIVE_LINKS = 3;
const pad = (n: number) => String(n).padStart(2, "0");
const href = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const label = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/**
 * The one popup for apps and services. A service is the same layout without
 * price or gallery. One tree, recomposed by a container query (text beside
 * the visual on desktop, stacked with a sticky price bar on phones).
 *
 * Keeps what the old modals did right: Esc closes, ←/→ move between items,
 * the browser Back button closes (history entry), body scroll is locked.
 */
export function CatalogDetail({
  items,
  index,
  onIndexChange,
  onClose,
  onCta,
}: {
  items: CatalogItem[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onCta?: (item: CatalogItem) => void;
}) {
  const open = index !== null && items[index] !== undefined;
  if (!open) return null;
  return createPortal(
    <DetailDialog items={items} index={index} onIndexChange={onIndexChange} onClose={onClose} onCta={onCta} />,
    document.body,
  );
}

function DetailDialog({
  items,
  index,
  onIndexChange,
  onClose,
  onCta,
}: {
  items: CatalogItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onCta?: (item: CatalogItem) => void;
}) {
  const { t } = useTranslation();
  const item = items[index];
  const eyebrow = useEyebrow(item);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = items.length > 1;
  const step = (d: number) => onIndexChange((index + d + items.length) % items.length);

  // Latest callbacks for the listeners below, which are bound once per open.
  const latest = useRef({ onClose, step, many });
  latest.current = { onClose, step, many };

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    // Back button closes the popup instead of leaving the page.
    history.pushState({ __catalogDetail: true }, "");
    let closedByBack = false;
    const onPop = () => {
      closedByBack = true;
      latest.current.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.onClose();
      else if (e.key === "ArrowRight" && latest.current.many) latest.current.step(1);
      else if (e.key === "ArrowLeft" && latest.current.many) latest.current.step(-1);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (!closedByBack && (history.state as { __catalogDetail?: boolean } | null)?.__catalogDetail) history.back();
      previouslyFocused?.focus?.();
    };
  }, []);

  const title = item.kind === "service" ? t(item.title) : item.title;
  const prev = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];
  const name = (it: CatalogItem) => (it.kind === "service" ? t(it.title) : it.title);

  return (
    <div className="cat cat-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cat-detail" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button ref={closeRef} type="button" className="cat-detail__close" onClick={onClose} aria-label={t("Close")}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="cat-detail__body">
          <div className="cat-detail__content" key={item.key}>
            <div className="cat-eyebrow cat-rise">{eyebrow}</div>
            <div className="cat-detail__titlerow cat-rise" style={{ animationDelay: "0.05s" }}>
              {item.logo && <img className="cat-detail__logo" src={getImageUrl(item.logo, { width: 160, quality: 90 })} alt="" />}
              <h2 id={titleId} className="cat-detail__title">{title}</h2>
            </div>
            {item.kind === "product" && item.subtitle && (
              <p className="cat-detail__lead cat-rise" style={{ animationDelay: "0.1s" }}>{t(item.subtitle)}</p>
            )}
            {item.description && (
              <p className="cat-detail__desc cat-rise" style={{ animationDelay: "0.15s" }}>{t(item.description)}</p>
            )}
            {item.features.length > 0 && (
              <ul className="cat-feat cat-rise" style={{ animationDelay: "0.2s" }}>
                {item.features.map((f) => <li key={f}>{t(f)}</li>)}
              </ul>
            )}
            {item.links.length > 0 && (
              <div className="cat-detail__live cat-rise" style={{ animationDelay: "0.25s" }}>
                <span>{t("Live at")}</span>
                {item.links.slice(0, LIVE_LINKS).map((url) => (
                  <a key={url} href={href(url)} target="_blank" rel="noopener noreferrer">{label(url)} ↗</a>
                ))}
                {item.links.length > LIVE_LINKS && <span>+{item.links.length - LIVE_LINKS}</span>}
              </div>
            )}
            <div className="cat-detail__buy">
              {item.price ? (
                <div>
                  <PriceTag item={item} />
                  {item.price.setup && (
                    <div className="cat-detail__setup">+ {item.price.setup} {t("one-time setup")}</div>
                  )}
                </div>
              ) : (
                <div className="cat-detail__quote">{t(item.kind === "product" ? "Start here" : "Custom quote after a quick conversation.")}</div>
              )}
              {onCta && (
                <button type="button" className="cat-detail__cta" onClick={() => onCta(item)}>
                  {t(item.cta.label)}
                </button>
              )}
            </div>
          </div>
          <DetailVisual item={item} />
        </div>

        {many && (
          <nav className="cat-detail__nav" aria-label={t("Browse")}>
            <button type="button" onClick={() => step(-1)}>← {name(prev)}</button>
            <span className="cat-detail__count">{pad(index + 1)} / {pad(items.length)}</span>
            <button type="button" onClick={() => step(1)}>{name(next)} →</button>
          </nav>
        )}
      </div>
    </div>
  );
}
