import type { FolderItem } from "./items";
import { Check } from "lucide-react";
import { Chip, Editable, ImageFrame, INK, Price, printImage } from "./primitives";

/**
 * The cards that fill panels 2 and 3 of the folder.
 *
 * Both use the imagery the site already has on each entry: `imageUrl` is the
 * card photo and `logoIconUrl` is the product mark, badged over the photo's
 * corner. The earlier version printed neither on the small cards, which is what
 * made the spread read as a price list rather than a product line-up.
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
        className="mt-[1.5mm] text-[16pt] font-extrabold leading-[1.1]"
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
}: {
  item: FolderItem;
  showPrices: boolean;
  dense?: boolean;
  onDark?: boolean;
}) {
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
        {item.imageUrl ? (
          <ImageFrame src={item.imageUrl} ratio="16 / 8" radius="0" tone="cta" />
        ) : (
          // Not every product has a photo — in production XmartMenu and
          // Xtimator have an empty `imageUrl`. An empty grey box on a printed
          // brochure reads as a mistake, so fall back to the product mark on a
          // brand panel, which reads as a deliberate treatment.
          <div
            className="flex items-center justify-center"
            style={{
              aspectRatio: "16 / 8",
              background: "linear-gradient(135deg, #16233E 0%, #0B1526 100%)",
            }}
          >
            {item.logoIconUrl ? (
              <img
                src={printImage(item.logoIconUrl, 400)}
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
        {item.logoIconUrl && item.imageUrl && (
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
              src={printImage(item.logoIconUrl, 320)}
              alt=""
              className="w-full h-full object-contain p-[0.8mm]"
            />
          </div>
        )}
      </div>

      <div
        className="flex flex-col px-[3.2mm] pb-[3mm]"
        style={{ paddingTop: item.logoIconUrl && item.imageUrl ? "5mm" : "3mm" }}
      >
        <div className="flex items-start justify-between gap-[2mm]">
          <Editable
            className="text-[10pt] font-extrabold leading-tight"
            style={{ color: onDark ? "#FFFFFF" : INK.navy }}
          >
            {item.title}
          </Editable>
          {showPrices && item.price && (
            <Price
              price={item.price}
              label={item.priceLabel}
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
}: {
  item: FolderItem;
  dense?: boolean;
  onDark?: boolean;
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
        src={item.imageUrl}
        ratio={imageRatio ?? (dense ? "16 / 6" : "16 / 8")}
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
          // Wrapping is fine because the block above has a pinned height, so a
          // second chip line does not push the photo and break the row's
          // alignment. Clipping them mid-word looked like a rendering fault.
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
 * Two-column grid that fills its panel. `auto-rows-fr` keeps every row the same
 * height, and an odd final card spans the full width instead of leaving a hole.
 */
export function CardGrid({ children }: { children: React.ReactNode[] }) {
  const count = children.length;
  return (
    <div className="mt-[3.5mm] flex-1 min-h-0 grid grid-cols-2 gap-[2.5mm] auto-rows-fr">
      {children.map((child, i) => (
        <div
          key={i}
          className={i === count - 1 && count % 2 === 1 ? "col-span-2 min-h-0" : "min-h-0"}
        >
          {child}
        </div>
      ))}
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
}: {
  item: FolderItem;
  /** Lines the description is clamped to, so every row keeps the same height. */
  descriptionLines?: number;
  onDark?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="flex gap-[3.2mm] py-[2.6mm] flex-1 min-h-0 items-center"
      style={{
        borderBottom: last
          ? undefined
          : `0.2mm solid ${onDark ? "rgba(255,255,255,0.12)" : INK.rule}`,
      }}
    >
      <ImageFrame
        src={item.imageUrl}
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
        <div key={i} className="flex items-start gap-[3mm]">
          <span
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: "5mm", height: "5mm", marginTop: "0.6mm", backgroundColor: INK.cta }}
          >
            <Check style={{ width: "2.8mm", height: "2.8mm", color: "#FFFFFF" }} />
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
