import { Check } from "lucide-react";
import { CATALOG_CATEGORY_LABEL } from "@shared/catalog";
import type { FolderData, FolderTemplate } from "../types";
import type { FolderItem } from "../items";
import { panelPadding } from "../paper";
import { PanelHeading } from "../cards";
import { ClosingPanel } from "../closing";
import { CoverPanel } from "./editorial";
import { Editable, Eyebrow, INK, Price } from "../primitives";

/**
 * "Catalog": the density option.
 *
 * When the folder has to carry ten-plus apps or services, imagery stops
 * helping and starts crowding. The inside drops to a typographic list with a
 * hairline between entries: more items per panel, still legible at 7.5pt, and
 * it degrades gracefully when items have no image. Cover and back are
 * Editorial's.
 */

function CatalogEntry({
  item,
  showPrices,
  descriptionLines = 2,
  showFeatures = true,
}: {
  item: FolderItem;
  showPrices: boolean;
  descriptionLines?: number;
  /** Off past six entries: eight rows with feature lines overrun the panel. */
  showFeatures?: boolean;
}) {
  return (
    <div className="py-[2.6mm]" style={{ borderBottom: `0.2mm solid ${INK.hairline}` }}>
      <div className="flex items-start justify-between gap-[3mm]">
        <div className="min-w-0">
          {item.category && (
            <Eyebrow className="mb-[1.2mm] text-[5.4pt] tracking-[0.2em]">
              {CATALOG_CATEGORY_LABEL[item.category]}
            </Eyebrow>
          )}
          <Editable className="text-[10.5pt] font-semibold leading-tight tracking-[-0.01em]" style={{ color: INK.fog50 }}>
            {item.title}
          </Editable>
          {item.subtitle && (
            <Editable className="text-[7.5pt] leading-snug mt-[0.4mm]" style={{ color: INK.ctaSoft }}>
              {item.subtitle}
            </Editable>
          )}
        </div>
        {showPrices && item.price && <Price price={item.price.value} label={item.price.label} />}
      </div>

      {item.description && (
        <Editable
          className="text-[7.2pt] leading-[1.4] mt-[1mm] overflow-hidden"
          style={{
            color: INK.fog400,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: descriptionLines,
          }}
        >
          {item.description}
        </Editable>
      )}

      {showFeatures && item.features.length > 0 && (
        <div className="mt-[1.4mm] flex flex-wrap gap-x-[3.5mm] gap-y-[0.6mm]">
          {item.features.slice(0, 3).map((f, i) => (
            <span key={i} className="flex items-center gap-[1.2mm] text-[7pt]" style={{ color: INK.fog300 }}>
              <Check style={{ width: "2.4mm", height: "2.4mm", color: INK.ctaSoft }} />
              <Editable>{f}</Editable>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Outside(props: FolderData) {
  return (
    <>
      <ClosingPanel {...props} />
      <CoverPanel {...props} />
    </>
  );
}

function CatalogList({ items, showPrices }: { items: FolderItem[]; showPrices: boolean }) {
  return (
    <div
      className="mt-[4mm] flex-1 min-h-0 flex flex-col justify-around"
      style={{ borderTop: `0.25mm solid ${INK.hairline}` }}
    >
      {items.map((item) => (
        <CatalogEntry
          key={item.key}
          item={item}
          showPrices={showPrices}
          descriptionLines={items.length > 6 ? 1 : 2}
          showFeatures={items.length <= 6}
        />
      ))}
    </div>
  );
}

function Inside({ bleed, apps, services, showPrices }: FolderData) {
  return (
    <>
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="01 · Apps" title="Apps we build and run" />
        <CatalogList items={apps} showPrices={showPrices} />
      </div>
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="02 · Services" title="Built by us, for your business" />
        <CatalogList items={services} showPrices={false} />
      </div>
    </>
  );
}

export const catalogTemplate: FolderTemplate = {
  id: "catalog",
  name: "Catalog",
  description: "Typographic list inside, no imagery. For when the line-up is long and photos would only crowd it.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.navyDeep, inside: INK.navyDeep },
};
