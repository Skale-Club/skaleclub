import { Phone } from "lucide-react";
import type { FolderData, FolderTemplate } from "../types";
import { CONTENT_PAD_MM, panelPadding } from "../paper";
import { AppCard, CardGrid, gridFillsPhotos, gridImageRatio, PanelHeading, ServiceCard, TrustStrip } from "../cards";
import { ClosingPanel } from "../closing";
import { Editable, Eyebrow, GridPattern, INK, printImage } from "../primitives";

/**
 * "Editorial", the default folder, set in the site's editorial design
 * (the 2026-09-28 redesign that took /nfc-guide as its reference).
 *
 * A bi-fold is four panels, read in this order:
 *
 *   Panel 1 (outside right)  Cover, as the home hero: navy, hairline grid,
 *                            the founder cut-out and the proof strip.
 *   Panel 2 (inside left)    01 · Apps, cards like /portfolio's.
 *   Panel 3 (inside right)   02 · Services, photo cards like /portfolio's.
 *   Panel 4 (outside left)   03 · Products (NFC) and the close.
 *
 * The numbered eyebrows are the site's, so the folder walks the same
 * Apps · Services · Products sequence the Portfolio menu does.
 */

/** Panel 1, the cover. Shared with Catalog. */
export function CoverPanel({ bleed, brand, settings }: FolderData) {
  const badges = settings?.homepageContent?.trustBadges ?? [];
  const outer = CONTENT_PAD_MM + bleed;

  return (
    <div
      className="w-1/2 h-full flex flex-col relative overflow-hidden"
      style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navy }}
    >
      <GridPattern />

      {/* The site's hero image is a transparent cut-out, so it stands on the
          grid as on the home page, bottom-anchored on the proof strip and
          aligned to its right edge, so nothing of it shows beside the strip.
          A rectangular photo picked in the toolbar lands in the same box. */}
      {brand.coverPhoto && (
        <img
          src={printImage(brand.coverPhoto, 1400)}
          alt=""
          className="absolute object-contain object-right-bottom pointer-events-none"
          // Bottom edge tucked behind the strip (which paints over it), so the
          // cut-out never ends on a hard line above the cells.
          style={{ right: `${outer}mm`, bottom: `${outer + 12}mm`, width: "62%", height: "56%" }}
        />
      )}

      {brand.logoOnDark ? (
        <img
          src={printImage(brand.logoOnDark, 400)}
          alt={brand.name}
          className="object-contain self-start relative shrink-0"
          style={{ height: "10mm", marginTop: "2mm" }}
        />
      ) : (
        <Editable className="text-[15pt] font-semibold relative shrink-0" style={{ color: INK.fog50, marginTop: "2mm" }}>
          {brand.name}
        </Editable>
      )}

      <div className="relative shrink-0 mt-[14mm]">
        <Eyebrow>Apps · Services · Products</Eyebrow>
        <Editable
          as="h1"
          className="mt-[3.5mm] text-[28pt] font-semibold leading-[1.02] tracking-[-0.035em]"
          style={{ color: INK.fog50 }}
        >
          {brand.heroTitle}
        </Editable>
        <Editable className="mt-[4mm] text-[10pt] leading-[1.45]" style={{ color: INK.fog400, maxWidth: "62mm" }}>
          {brand.heroSubtitle}
        </Editable>
        {brand.phone && (
          // The site's CTA pill. On paper the action is the phone number, so
          // that is what the pill carries.
          <div
            className="mt-[6mm] inline-flex items-center gap-[1.8mm] rounded-full px-[4.5mm] py-[2.2mm] font-bold text-[9.5pt] text-white"
            style={{ backgroundColor: INK.cta }}
          >
            <Phone style={{ width: "3.2mm", height: "3.2mm" }} />
            <Editable>{brand.phone}</Editable>
          </div>
        )}
      </div>

      <div className="mt-auto relative shrink-0">
        <TrustStrip badges={badges} />
        <div className="mt-[3mm] flex items-center justify-between text-[8pt]" style={{ color: INK.fog400 }}>
          <Editable>{brand.siteLabel}</Editable>
          {brand.email && <Editable>{brand.email}</Editable>}
        </div>
      </div>
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

/** Panels 2 and 3. Shared with Showcase. */
export function EditorialInside({ bleed, apps, services, showPrices }: FolderData) {
  // Past eight cards a two-column grid runs out of row height, so the panel
  // goes to three columns.
  const appColumns: 2 | 3 = apps.length > 8 ? 3 : 2;
  const serviceColumns: 2 | 3 = services.length > 8 ? 3 : 2;
  const serviceRows = Math.ceil(services.length / serviceColumns);
  // Description lines per card: fewer as the grid gets denser, so every card
  // keeps its title and the photos stay the same height across the row.
  const descriptionLines = serviceColumns === 3 ? 1 : serviceRows >= 4 ? 2 : 3;

  return (
    <>
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading
          eyebrow="01 · Apps"
          title="Apps we build and run"
          subtitle="Our own products, live today, with a fixed price."
        />
        {apps.length > 0 ? (
          <CardGrid
            keyOf={(item) => item.key}
            items={apps}
            columns={appColumns}
            renderItem={(item, { wide, span }) => (
              <AppCard
                item={item}
                showPrices={showPrices}
                imageRatio={gridImageRatio(apps.length, appColumns)}
                fillImage={gridFillsPhotos(apps.length, appColumns)}
                span={wide ? span : 1}
              />
            )}
          />
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: INK.fog400 }}>
            Pick apps in the sidebar.
          </p>
        )}
      </div>

      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading
          eyebrow="02 · Services"
          title="Built by us, for your business"
          subtitle="Tailored marketing and technology, quoted for your case."
        />
        {services.length > 0 ? (
          <CardGrid
            keyOf={(item) => item.key}
            items={services}
            columns={serviceColumns}
            renderItem={(item, { wide, span }) => (
              <ServiceCard
                item={item}
                imageRatio={gridImageRatio(services.length, serviceColumns)}
                fillImage={gridFillsPhotos(services.length, serviceColumns)}
                descriptionLines={descriptionLines}
                span={wide ? span : 1}
              />
            )}
          />
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: INK.fog400 }}>
            Pick services in the sidebar.
          </p>
        )}
      </div>
    </>
  );
}

export const editorialTemplate: FolderTemplate = {
  id: "editorial",
  name: "Editorial",
  description: "The site's look: hero cover with the grid, apps and services as /portfolio cards, NFC products on the back.",
  Outside,
  Inside: EditorialInside,
  sheetBackground: { outside: INK.navyDeep, inside: INK.navyDeep },
};
