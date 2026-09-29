import { memo } from "react";
import { CATALOG_CATEGORY_LABEL, type CatalogItem } from "@shared/catalog";
import { useTranslation } from "@/hooks/useTranslation";
import { priceParts } from "@/lib/format";
import { Cover } from "./Cover";
import "./catalog.css";

export type CatalogCardVariant = "tile" | "compact" | "row";

/** "App · CRM & Sales" / "Service · Marketing". `short` drops the kind for
 *  narrow cards, where the carousel already says what the items are. */
export function useEyebrow(item: CatalogItem, short = false) {
  const { t } = useTranslation();
  const kind = item.kind === "product" ? t("App") : t("Service");
  if (!item.category) return kind;
  const category = t(CATALOG_CATEGORY_LABEL[item.category]);
  return short ? category : `${kind} · ${category}`;
}

export function PriceTag({ item }: { item: CatalogItem }) {
  const { t, language } = useTranslation();
  if (!item.price) return null;
  const { value, prefix, suffix, tight } = priceParts(item.price, language, t);
  return (
    <div className="cat-price">
      {prefix && <small style={{ marginLeft: 0, marginRight: 4 }}>{prefix}</small>}
      {value}
      {suffix && <small style={tight ? { marginLeft: 0 } : undefined}>{suffix}</small>}
    </div>
  );
}

/**
 * The one card for both catalogs. `tile` is the /portfolio grid, `compact` the
 * home carousels, `row` the odd last item of a grid spanning the full line.
 * A native <button>, so keyboard focus and activation come for free.
 */
export const CatalogCard = memo(function CatalogCard({
  item,
  variant = "tile",
  onOpen,
  className = "",
  style,
}: {
  item: CatalogItem;
  variant?: CatalogCardVariant;
  onOpen: (item: CatalogItem) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const eyebrow = useEyebrow(item, variant === "compact");
  const title = item.kind === "service" ? t(item.title) : item.title;
  const features = variant === "compact" ? [] : item.features;
  // Service cards usually carry only a description; it stands in for the subtitle.
  const sub = item.subtitle ?? (item.kind === "service" ? item.description : undefined);

  return (
    <button
      type="button"
      className={`cat cat-card cat-card--${variant} ${className}`}
      style={style}
      onClick={() => onOpen(item)}
    >
      <Cover item={item} width={variant === "row" ? 1000 : 720} />
      <div className="cat-card__body">
        <div className="cat-eyebrow">{eyebrow}</div>
        <h3 className="cat-card__title">{title}</h3>
        {sub && <p className="cat-card__sub">{t(sub)}</p>}
        {features.length > 0 && (
          <ul className="cat-feat">
            {features.map((f) => <li key={f}>{t(f)}</li>)}
          </ul>
        )}
        <div className="cat-card__foot">
          {item.price ? <PriceTag item={item} /> : <span className="cat-card__quote">{t(item.kind === "product" ? "Start here" : "Custom quote")}</span>}
          <span className="cat-card__more" aria-hidden="true">{t("See details")} →</span>
        </div>
      </div>
    </button>
  );
});
