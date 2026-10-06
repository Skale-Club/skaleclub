import { Check, Shield, Trophy, Zap, type LucideIcon } from "lucide-react";
import { CATALOG_CATEGORY_LABEL, headlineParts } from "@shared/catalog";
import type { FolderItem } from "./items";
import type { FolderProduct } from "./products";
import { Editable, Eyebrow, ImageFrame, INK, Price, printImage } from "./primitives";

/**
 * The cards that fill the folder's panels, in the site's editorial voice
 * (/portfolio): sharp corners, a navy-800 surface inside a hairline frame,
 * a tracked category eyebrow, Inter semibold titles, fog body copy.
 *
 * They read the same CatalogItem as the site's cards, so a product can never
 * show one image or one price on the site and another on paper. The print
 * versions stay separate components because millimetres and a fixed sheet are
 * another medium.
 */

const CARD_SURFACE: React.CSSProperties = {
  backgroundColor: INK.card,
  border: `0.25mm solid ${INK.hairline}`,
};

/** The site's eyebrow + display title + subtitle, at panel scale. */
export function PanelHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="shrink-0">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Editable
        as="h2"
        className="mt-[2.6mm] text-[20pt] font-semibold leading-[1.04] tracking-[-0.025em]"
        style={{ color: INK.fog50 }}
      >
        {title}
      </Editable>
      {subtitle && (
        <Editable className="mt-[2mm] text-[8.5pt] leading-snug" style={{ color: INK.fog400 }}>
          {subtitle}
        </Editable>
      )}
    </div>
  );
}

/** Two lines of body copy at most, clamped rather than cut mid-word. */
const clamp = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
});

/** "Systems & Booking", the label the site's card carries above the title. */
function CategoryEyebrow({ item }: { item: FolderItem }) {
  // An empty slot rather than nothing: see the headline note in AppCard.
  if (!item.category) return <div className="mb-[1.4mm]" style={{ height: "1.9mm" }} />;
  return (
    <Eyebrow className="mb-[1.4mm] text-[5.4pt] tracking-[0.2em]">
      {CATALOG_CATEGORY_LABEL[item.category]}
    </Eyebrow>
  );
}

/**
 * App card: the X-branded products. The cover is the app's own home page,
 * anchored to its top edge as on /portfolio; the mark sits beside the title,
 * and the benefit headline carries the site's blue highlight.
 *
 * @param imageRatio Set by the template from the row count, so the photo gives
 *   up height before the copy under it does.
 */
export function AppCard({
  item,
  showPrices,
  imageRatio = "16 / 7",
  fillImage = false,
  span = 1,
}: {
  item: FolderItem;
  showPrices: boolean;
  imageRatio?: string;
  /** Let the photo take whatever height the grid row leaves (see `gridFillsPhotos`). */
  fillImage?: boolean;
  /** Columns this card spans. The photo widens to match so the row keeps its height. */
  span?: 1 | 2 | 3;
}) {
  const ratio = span > 1 ? widen(imageRatio, span) : imageRatio;
  const line = item.headline ?? item.subtitle;
  return (
    <div className="flex flex-col h-full overflow-hidden" style={CARD_SURFACE}>
      {item.cover ? (
        <ImageFrame
          src={item.cover}
          ratio={ratio}
          fill={fillImage}
          position="top"
          className={fillImage ? "" : "shrink-0"}
          style={fillImage ? FILL_PHOTO : undefined}
        />
      ) : (
        // No cover yet: the mark on the hero navy reads as a deliberate
        // treatment, an empty grey box as a mistake (the site does the same).
        <div className="flex items-center justify-center" style={{ ...photoBox(ratio, fillImage), backgroundColor: INK.navy }}>
          {item.logo ? (
            <img src={printImage(item.logo, 400)} alt="" className="object-contain" style={{ maxHeight: "55%", maxWidth: "40%" }} />
          ) : (
            <span className="text-[13pt] font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>{item.title}</span>
          )}
        </div>
      )}
      <div className="shrink-0 flex flex-col px-[3mm] pt-[2.4mm] pb-[2.6mm]" style={{ borderTop: `0.25mm solid ${INK.hairline}` }}>
        <CategoryEyebrow item={item} />
        <div className="flex items-center justify-between gap-[2mm]">
          <div className="flex items-center gap-[1.6mm] min-w-0">
            {item.logo && (
              <img src={printImage(item.logo, 160)} alt="" className="shrink-0 object-contain" style={{ width: "4.6mm", height: "4.6mm" }} />
            )}
            <Editable className="text-[10pt] font-semibold leading-tight tracking-[-0.01em] truncate" style={{ color: INK.fog50 }}>
              {item.title}
            </Editable>
          </div>
          {showPrices && item.price && <Price price={item.price.value} label={item.price.label} inline />}
        </div>
        {/* Rendered even when empty: a card without a headline must keep the
            same body height, or its photo grows and the titles across the
            row stop lining up. */}
        <Editable className="mt-[0.8mm] text-[7.2pt] leading-[1.35]" style={{ color: INK.fog300, height: "3.45mm", ...clamp(1) }}>
          {line &&
            headlineParts(line).map((part, i) =>
              part.highlight ? (
                <span key={i} style={{ color: INK.ctaSoft }}>{part.text}</span>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
        </Editable>
      </div>
    </div>
  );
}

/**
 * Service card: the work we perform, as /portfolio's service cards. The photo
 * prints as it is, with no wash, as the site shows it.
 */
export function ServiceCard({
  item,
  imageRatio = "16 / 7",
  fillImage = false,
  descriptionLines = 2,
  span = 1,
}: {
  item: FolderItem;
  imageRatio?: string;
  fillImage?: boolean;
  descriptionLines?: number;
  span?: 1 | 2 | 3;
}) {
  const ratio = span > 1 ? widen(imageRatio, span) : imageRatio;
  // Service cards usually carry only a description; it stands in for the
  // subtitle, as on the site.
  const copy = item.subtitle ?? item.description;
  return (
    <div className="flex flex-col h-full overflow-hidden" style={CARD_SURFACE}>
      <ImageFrame
        src={item.cover}
        ratio={ratio}
        fill={fillImage}
        className={fillImage ? "" : "shrink-0"}
        style={fillImage ? FILL_PHOTO : undefined}
      />
      <div className="shrink-0 flex flex-col px-[3mm] pt-[2.4mm] pb-[2.6mm]">
        <CategoryEyebrow item={item} />
        <Editable className="text-[9.5pt] font-semibold leading-tight tracking-[-0.01em] truncate" style={{ color: INK.fog50 }}>
          {item.title}
        </Editable>
        {descriptionLines > 0 && (
          // Fixed height for the same reason as the app headline: a one-line
          // description must not make its photo taller than its neighbour's.
          <Editable
            className="mt-[0.9mm] text-[6.9pt] leading-[1.4]"
            style={{ color: INK.fog400, height: `${(descriptionLines * 3.41).toFixed(2)}mm`, ...clamp(descriptionLines) }}
          >
            {copy}
          </Editable>
        )}
      </div>
    </div>
  );
}

/** A filling photo still needs a floor, or a crowded grid squeezes it to a sliver. */
const FILL_PHOTO: React.CSSProperties = { minHeight: "12mm" };

function photoBox(ratio: string, fill: boolean): React.CSSProperties {
  return fill ? { flex: "1 1 0", ...FILL_PHOTO } : { aspectRatio: ratio, flexShrink: 0 };
}

/** "16 / 7" spanning two columns becomes "32 / 7", so a wide card keeps the row height. */
function widen(ratio: string, span: number) {
  const [w, h] = ratio.split("/").map((v) => parseFloat(v));
  return `${w * span} / ${h}`;
}

/**
 * Grid of cards that fills its panel.
 *
 * Rows are stretched to equal height (`auto-rows-fr`) only from three rows.
 * Below that a stretched row turns a card into a tower with empty surface
 * under its caption; natural height, with the slack at the bottom of the
 * panel, is the honest layout there.
 *
 * An odd final card spans the full width rather than leaving a hole beside it.
 * `renderItem` is told when that happens so it can widen the photo and keep
 * the row the same height as the others.
 */
export function CardGrid<T>({
  items,
  columns = 2,
  keyOf,
  renderItem,
}: {
  items: T[];
  columns?: 2 | 3;
  /**
   * Stable identity per item. The cells hold contentEditable text, and React
   * reuses a cell keyed by index when the list shifts, so an edit typed on
   * the third card would survive on whatever item lands third next.
   */
  keyOf: (item: T) => string;
  renderItem: (item: T, opts: { wide: boolean; span: 2 | 3 }) => React.ReactNode;
}) {
  const count = items.length;
  const rows = Math.ceil(count / columns);
  const remainder = count % columns;
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-2";
  const stretch = rows >= 3 ? "auto-rows-fr" : "auto-rows-max";
  return (
    <div className={`mt-[4.5mm] flex-1 min-h-0 grid ${cols} ${stretch} gap-[2.4mm]`}>
      {items.map((item, i) => {
        const wide = i === count - 1 && remainder === 1 && count > 1;
        return (
          <div
            key={keyOf(item)}
            // Literal class names: Tailwind's JIT cannot see a `col-span-${n}`
            // template and would purge it, and the card would quietly not span.
            className={wide ? (columns === 3 ? "col-span-3 min-h-0" : "col-span-2 min-h-0") : "min-h-0"}
          >
            {renderItem(item, { wide, span: columns })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Photo ratio for a grid of `count` cards in `columns` columns, used while
 * rows take their natural height. From three rows the photos fill instead:
 * see `gridFillsPhotos`.
 */
export function gridImageRatio(count: number, columns: 2 | 3) {
  const rows = Math.ceil(count / columns);
  if (columns === 3) return rows >= 4 ? "16 / 9" : "16 / 10";
  return rows >= 4 ? "16 / 6.2" : rows === 3 ? "16 / 7.5" : "16 / 9";
}

/**
 * From three rows the grid stretches its rows to fill the panel, and the
 * photo takes whatever height the copy leaves. A fixed ratio there was a
 * guess at that height, and a wrong guess clipped the last line of copy.
 */
export function gridFillsPhotos(count: number, columns: 2 | 3) {
  return Math.ceil(count / columns) >= 3;
}

/**
 * NFC product card: a transparent cut-out on the hero navy, as on the site's
 * Products section, with the entry price and three plain facts.
 */
export function ProductCard({ product, showPrices }: { product: FolderProduct; showPrices: boolean }) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={CARD_SURFACE}>
      {/* Fills the card: the products grid takes the panel height the close
          does not need, so the pictures absorb it instead of a gap. */}
      <div className="relative" style={{ flex: "1 1 0", minHeight: "34mm", backgroundColor: INK.navy }}>
        <img
          src={printImage(product.image, 900)}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          style={{ padding: "3mm", filter: "drop-shadow(0 2mm 3mm rgba(0,0,0,0.45))" }}
        />
      </div>
      <div className="shrink-0 flex flex-col px-[3mm] pt-[2.6mm] pb-[2.8mm]" style={{ borderTop: `0.25mm solid ${INK.hairline}` }}>
        <Editable className="text-[10.5pt] font-semibold leading-tight tracking-[-0.01em]" style={{ color: INK.fog50 }}>
          {product.title}
        </Editable>
        <Editable className="mt-[1mm] text-[7pt] leading-[1.4]" style={{ color: INK.fog400 }}>
          {product.description}
        </Editable>
        <div className="mt-[2mm] flex flex-col gap-[0.9mm]">
          {product.features.map((feature) => (
            <div key={feature} className="flex items-start gap-[1.4mm]">
              <Check className="shrink-0" style={{ width: "2.6mm", height: "2.6mm", marginTop: "0.2mm", color: INK.ctaSoft }} />
              <Editable className="text-[6.8pt] leading-snug" style={{ color: INK.fog300 }}>
                {feature}
              </Editable>
            </div>
          ))}
        </div>
        {showPrices && product.price.value && (
          <div className="pt-[2.6mm]">
            <Price prefix={product.price.prefix} price={product.price.value} label={product.price.label} align="left" />
          </div>
        )}
      </div>
    </div>
  );
}

const BADGE_ICON: Record<string, LucideIcon> = { zap: Zap, shield: Shield, trophy: Trophy };

/**
 * The homepage's proof strip (the three cells under the hero), from the same
 * trust badges, so the claims on paper are the claims on the site.
 */
export function TrustStrip({ badges }: { badges: { icon?: string; title: string; description?: string }[] }) {
  const shown = badges.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <div className="relative shrink-0 grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`, ...CARD_SURFACE }}>
      {shown.map((badge, i) => {
        const Icon = (badge.icon && BADGE_ICON[badge.icon]) || Check;
        return (
          <div
            key={i}
            className="flex items-start gap-[1.8mm] px-[2.6mm] py-[3mm]"
            style={{ borderLeft: i > 0 ? `0.25mm solid ${INK.hairline}` : undefined }}
          >
            <Icon className="shrink-0" style={{ width: "3.4mm", height: "3.4mm", color: INK.ctaSoft }} />
            <div className="min-w-0">
              <Editable className="text-[7pt] font-semibold leading-tight" style={{ color: INK.fog50 }}>
                {badge.title}
              </Editable>
              {badge.description && (
                <Editable className="mt-[0.5mm] text-[6pt] leading-snug" style={{ color: INK.fog400 }}>
                  {badge.description}
                </Editable>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
