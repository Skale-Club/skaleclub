import type { FolderItem } from "./items";
import { CATALOG_CATEGORY_LABEL, siteDomain, type CatalogCategory } from "@shared/catalog";
import { Chip, Editable, ImageFrame, INK, Price, printImage } from "./primitives";

/**
 * The cards that fill panels 2 and 3 of the folder.
 *
 * They mirror the website's CatalogCard: same model (CatalogItem), same order
 * of information (category, title, subtitle, features, price), same cover
 * treatment and the same fallback when there is no image. `cover` is the card
 * image and `logo` the product mark, badged over the cover's corner.
 */

/** Section title for a panel: eyebrow, heading, rule. */
export function PanelHeading({
  eyebrow,
  title,
  onDark = true,
}: {
  eyebrow?: string;
  title: string;
  onDark?: boolean;
}) {
  return (
    <div className="shrink-0">
      {eyebrow && (
        <Editable
          className="text-[7.5pt] font-bold uppercase tracking-[0.2em]"
          style={{ color: onDark ? "#8FA9EE" : INK.cta }}
        >
          {eyebrow}
        </Editable>
      )}
      <Editable
        as="h2"
        // 16pt read as timid on an A4 panel: the jump from eyebrow to title has
        // to be as visible on paper as it is on the site.
        className="mt-[1.8mm] text-[24pt] font-extrabold leading-[1] tracking-[-0.02em]"
        style={{ color: onDark ? "#FFFFFF" : INK.navy }}
      >
        {title}
      </Editable>
      <div
        className="mt-[2.5mm] rounded-full"
        style={{ height: "1.2mm", width: "18mm", backgroundColor: INK.cta }}
      />
    </div>
  );
}

/**
 * App card — the paid products. Carries a price, so it is the denser of the two.
 *
 * @param dense Drops the feature chips when the panel has to fit more rows.
 */
export function AppCard({
  item,
  showPrices,
  dense = false,
  onDark = true,
  span = 1,
}: {
  item: FolderItem;
  showPrices: boolean;
  dense?: boolean;
  onDark?: boolean;
  /** Columns this card spans. The photo widens to match so the row keeps its height. */
  span?: 1 | 2 | 3;
}) {
  // 16/7 rather than 16/8: the category line above the title costs ~3mm per
  // card, and at three rows of fixed height that came out of the feature chips.
  const photoRatio = `${16 * span} / 7`;
  const surface = onDark
    ? { backgroundColor: "rgba(255,255,255,0.06)", border: "0.25mm solid rgba(255,255,255,0.12)" }
    : { backgroundColor: INK.paper, border: `0.25mm solid ${INK.rule}` };

  return (
    <div
      className="rounded-[2.2mm] overflow-hidden flex flex-col h-full"
      style={surface}
    >
      {/* A fixed ratio, deliberately. A flexible photo absorbed whatever height
          the text below happened to need, so a two-line title or a wrapped chip
          row left one card's photo shorter than its neighbour's and the titles
          across a row stopped lining up. Pinning the ratio makes every photo in
          a row identical by construction; the leftover height falls to the
          bottom of the shorter card, where nobody reads it. */}
      <div className="relative shrink-0">
        {item.cover ? (
          <PrintCover item={item} ratio={photoRatio} />
        ) : (
          // Not every product has a cover yet. An empty grey box on a printed
          // brochure reads as a mistake, so fall back to the product mark on a
          // brand panel, which reads as a deliberate treatment (as on the site).
          <div
            className="flex items-center justify-center"
            style={{
              aspectRatio: photoRatio,
              background: "linear-gradient(135deg, #16233E 0%, #0B1526 100%)",
            }}
          >
            {item.logo ? (
              <img
                src={printImage(item.logo, 400)}
                alt=""
                className="object-contain"
                style={{ maxHeight: "60%", maxWidth: "45%" }}
              />
            ) : (
              <Editable
                className="text-[13pt] font-extrabold tracking-tight"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                {item.title}
              </Editable>
            )}
          </div>
        )}
        {item.logo && item.cover && (
          // The product mark, badged over the photo — this is what makes a card
          // read as "Xkedule" at a glance instead of as a generic stock image.
          <div
            className="absolute flex items-center justify-center rounded-[1.4mm] overflow-hidden"
            style={{
              left: "2.5mm",
              bottom: "-3.5mm",
              width: "10mm",
              height: "10mm",
              backgroundColor: INK.paper,
              border: "0.25mm solid rgba(255,255,255,0.25)",
            }}
          >
            <img
              src={printImage(item.logo, 320)}
              alt=""
              className="w-full h-full object-contain p-[0.8mm]"
            />
          </div>
        )}
      </div>

      {/* Always 5mm, badge or not. The badge hangs 3.5mm below the photo, and
          giving badge-less cards a tighter top pushed their titles 2mm higher
          than their neighbours' in the same row. */}
      <div className="flex flex-col px-[3.2mm] pt-[4.6mm] pb-[3mm]">
        {!dense && <CategoryEyebrow category={item.category} onDark={onDark} />}
        <div className="flex items-start justify-between gap-[2mm]">
          <Editable
            className="text-[10pt] font-extrabold leading-tight"
            style={{ color: onDark ? "#FFFFFF" : INK.navy }}
          >
            {item.title}
          </Editable>
          {showPrices && item.price && (
            <Price
              price={item.price.value}
              label={item.price.label}
              color={onDark ? "#8FA9EE" : INK.cta}
            />
          )}
        </div>

        <Editable
          className="mt-[0.6mm] text-[7.5pt] leading-snug"
          style={{ color: onDark ? "#A9B8D8" : INK.muted }}
        >
          {item.subtitle}
        </Editable>

        {!dense && item.features.length > 0 && (
          <div className="pt-[2mm] flex flex-wrap gap-[1.2mm]">
            {item.features.slice(0, 2).map((f, i) => (
              <Chip key={i} onDark={onDark}>
                {f}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Service card — the work we perform. No price, so the photo can take more of
 * the card and more of them fit in a panel.
 */
export function ServiceCard({
  item,
  dense = false,
  onDark = true,
  imageRatio,
  span = 1,
}: {
  item: FolderItem;
  dense?: boolean;
  onDark?: boolean;
  /** Columns this card spans; the photo widens to match. */
  span?: 1 | 2 | 3;
  /**
   * The photo's aspect ratio. The caller sets it because only the caller knows
   * how many rows the grid has: at four rows a 16/8 photo plus the text below
   * overruns the row and the card's overflow clips the tag. Defaults suit a
   * two- or three-row grid.
   */
  imageRatio?: string;
}) {
  const surface = onDark
    ? { backgroundColor: "rgba(255,255,255,0.06)", border: "0.25mm solid rgba(255,255,255,0.12)" }
    : { backgroundColor: INK.paper, border: `0.25mm solid ${INK.rule}` };

  return (
    <div className="rounded-[2.2mm] overflow-hidden flex flex-col h-full" style={surface}>
      {/* Fixed ratio for the same reason as AppCard. */}
      <ImageFrame
        src={item.cover}
        ratio={span > 1 ? `${16 * span} / 7` : (imageRatio ?? (dense ? "16 / 6" : "16 / 8"))}
        radius="0"
        tone="cta"
        className="shrink-0"
      />
      {/* One tag, not two: service tags are long ("Website customization") and a
          second one wraps, which adds a line to some cards and not others. */}
      <div className="flex flex-col px-[3.2mm] py-[2.6mm]">
        <Editable
          className="text-[9pt] font-bold leading-tight"
          style={{ color: onDark ? "#FFFFFF" : INK.navy }}
        >
          {item.title}
        </Editable>
        {item.subtitle && (
          <Editable
            className="mt-[0.5mm] text-[7pt] leading-snug"
            style={{ color: onDark ? "#A9B8D8" : INK.muted }}
          >
            {item.subtitle}
          </Editable>
        )}
        {!dense && item.features.length > 0 && (
          <div className="pt-[1.8mm] flex gap-[1.2mm]">
            {item.features.slice(0, 1).map((f, i) => (
              <Chip key={i} onDark={onDark}>
                {f}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Grid of cards that fills its panel.
 *
 * `columns` is chosen by the template from the item count: two is the default,
 * three once a panel has to carry more than eight, which is where a two-column
 * grid runs out of row height and starts clipping the captions.
 *
 * Rows are stretched to equal height (`auto-rows-fr`) only from three rows.
 * Below that a stretched row turns a card into a tower with a hundred
 * millimetres of empty surface under its caption; natural height, with the
 * slack at the bottom of the panel, is the honest layout there.
 *
 * An odd final card spans the full width rather than leaving a hole beside it.
 * `renderItem` is told when that happens so it can give the card a wide photo
 * ratio and keep the row the same height as the others.
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
  // From three rows the grid is genuinely full and equal rows look right; at
  // one or two, stretching just moves the empty space inside the cards.
  const stretch = rows >= 3 ? "auto-rows-fr" : "auto-rows-max";
  return (
    <div className={`mt-[3.5mm] flex-1 min-h-0 grid ${cols} ${stretch} gap-[2.5mm]`}>
      {items.map((item, i) => {
        // Only a lone card in the last row spans; two of three do not.
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
 * Service row — the list form used on panel 3.
 *
 * Deliberately a different shape from the app cards on panel 2: a small square
 * thumbnail with the copy beside it, stacked one per line. Apps are a product
 * line-up you scan by picture; services are a list you read, and each one needs
 * its description, not just a name.
 */
export function ServiceListItem({
  item,
  descriptionLines = 2,
  onDark = true,
  last = false,
  stretch = true,
}: {
  item: FolderItem;
  /** Lines the description is clamped to, so every row keeps the same height. */
  descriptionLines?: number;
  onDark?: boolean;
  last?: boolean;
  /**
   * Share the panel's leftover height with the other rows. The template turns
   * this off for short lists: three rows spread across a whole panel read as
   * three orphans, not as a list.
   */
  stretch?: boolean;
}) {
  return (
    <div
      className={`flex gap-[3.2mm] py-[2.6mm] items-center ${stretch ? "flex-1 min-h-0" : ""}`}
      style={{
        borderBottom: last
          ? undefined
          : `0.2mm solid ${onDark ? "rgba(255,255,255,0.12)" : INK.rule}`,
      }}
    >
      <ImageFrame
        src={item.cover}
        ratio="1 / 1"
        radius="1.6mm"
        tone="cta"
        className="shrink-0"
        style={{ width: "14mm" }}
      />
      <div className="min-w-0 flex-1">
        <Editable
          className="text-[9.5pt] font-bold leading-tight"
          style={{ color: onDark ? "#FFFFFF" : INK.navy }}
        >
          {item.title}
        </Editable>
        {item.subtitle && (
          <Editable
            className="text-[7pt] leading-snug mt-[0.3mm]"
            style={{ color: INK.cta }}
          >
            {item.subtitle}
          </Editable>
        )}
        {item.description && (
          // Clamped rather than truncated with an ellipsis mid-word: the rows
          // have to line up, and admin copy varies a lot in length.
          <Editable
            className="text-[7.2pt] leading-[1.35] mt-[0.8mm] overflow-hidden"
            style={{
              color: onDark ? "#A9B8D8" : INK.body,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: descriptionLines,
            }}
          >
            {item.description}
          </Editable>
        )}
      </div>
    </div>
  );
}


/**
 * The closing panel's proof points, taken from the homepage trust badges so the
 * claims in print are the claims on the site.
 */
export function TrustPoints({
  badges,
  onDark = true,
}: {
  badges: { title: string; description?: string }[];
  onDark?: boolean;
}) {
  if (badges.length === 0) return null;
  return (
    <div className="mt-[7mm] flex flex-col gap-[3mm]">
      {badges.slice(0, 3).map((badge, i) => (
        <div key={i} className="flex items-start gap-[3.5mm]">
          {/* Numerals, not check marks: the site's proof band speaks in big
              numbers, and a column of ticks reads as a feature checklist. */}
          <span
            className="shrink-0 font-extrabold leading-none tracking-[-0.03em]"
            style={{ fontSize: "17pt", width: "9mm", color: onDark ? "#8FA9EE" : INK.cta }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <Editable
              className="text-[9.5pt] font-bold leading-tight"
              style={{ color: onDark ? "#FFFFFF" : INK.navy }}
            >
              {badge.title}
            </Editable>
            {badge.description && (
              <Editable
                className="text-[8pt] leading-snug mt-[0.4mm]"
                style={{ color: onDark ? "#A9B8D8" : INK.body }}
              >
                {badge.description}
              </Editable>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// The folder is printed in Portuguese; the site passes the same keys through t().
const CATEGORY_PT: Record<CatalogCategory, string> = {
  ai: "IA e automação",
  websites: "Sites",
  systems: "Sistemas e agendamento",
  crm: "CRM e vendas",
  marketing: "Marketing",
  brand: "Marca",
};

/** The same category label the website card carries above the title. */
function CategoryEyebrow({ category, onDark }: { category?: CatalogCategory; onDark: boolean }) {
  if (!category) return null;
  return (
    <Editable
      className="mb-[1mm] text-[5.8pt] font-bold uppercase tracking-[0.18em] leading-none"
      style={{ color: onDark ? "#8FA9EE" : INK.cta }}
    >
      {CATEGORY_PT[category] ?? CATALOG_CATEGORY_LABEL[category]}
    </Editable>
  );
}

/**
 * The website's composed cover, in millimetres: the product's real home page
 * in a browser window on the brand surface. Every product cover comes out of
 * the same family by construction, on paper as on screen.
 */
function PrintCover({ item, ratio }: { item: FolderItem; ratio: string }) {
  const domain = siteDomain(item.site) ?? siteDomain(item.links[0]);
  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: ratio,
        background: "radial-gradient(70% 70% at 50% 110%, rgba(81,115,214,0.45), transparent 70%), #142038",
      }}
    >
      <div
        className="absolute overflow-hidden"
        style={{
          left: "9%",
          right: "9%",
          top: "13%",
          bottom: "-6%",
          borderRadius: "1.4mm 1.4mm 0 0",
          border: "0.25mm solid rgba(180,192,216,0.3)",
          backgroundColor: "#0B0F18",
        }}
      >
        <div className="flex items-center gap-[0.8mm] px-[1.6mm]" style={{ height: "3mm", backgroundColor: "#151B28" }}>
          {[0, 1, 2].map((d) => (
            <span key={d} className="rounded-full" style={{ width: "0.9mm", height: "0.9mm", backgroundColor: "rgba(180,192,216,0.35)" }} />
          ))}
          {domain && (
            <span className="ml-[1.2mm] truncate" style={{ fontSize: "4.5pt", color: "#7C8AA6" }}>
              {domain}
            </span>
          )}
        </div>
        <img src={printImage(item.cover)} alt="" className="w-full object-cover object-top" style={{ height: "calc(100% - 3mm)" }} />
      </div>
    </div>
  );
}
