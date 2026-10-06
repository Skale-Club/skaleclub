import type { FolderData, FolderTemplate } from "../types";
import { panelPadding } from "../paper";
import { ClosingPanel } from "../closing";
import { Editable, Eyebrow, GridPattern, INK, printImage } from "../primitives";
import { EditorialInside } from "./editorial";

/**
 * "Showcase": the photo-led cover.
 *
 * Same inside spread and back as Editorial; only the cover differs. The
 * picture fills the whole front panel and the headline is set over its lower
 * half, which suits a full photograph (picked in the toolbar) better than the
 * site's cut-out portrait does.
 */

function Cover({ bleed, brand }: FolderData) {
  const heroImage = brand.coverPhoto;
  return (
    <div className="w-1/2 h-full relative overflow-hidden" style={{ backgroundColor: INK.navy }}>
      <GridPattern />
      {heroImage && (
        <>
          <img
            src={printImage(heroImage, 1600)}
            alt=""
            // Contained, not cropped: the site's hero is a square cut-out, and
            // cover-cropping it to a portrait panel blew the face up to a
            // blurry close-up. Contained it sits on the grid, top-anchored.
            className="absolute inset-0 w-full h-full object-contain object-top"
          />
          {/* The top of the photo prints clean; the fade is solid navy before
              the contained image ends (~58% down), so its bottom edge never
              shows as a line across the panel. */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(16,21,30,0) 28%, rgba(16,21,30,0.9) 48%, #10151e 56%)" }}
          />
        </>
      )}
      <div className="relative h-full flex flex-col" style={panelPadding(bleed, "right")}>
        {brand.logoOnDark ? (
          <img
            src={printImage(brand.logoOnDark, 400)}
            alt={brand.name}
            className="object-contain self-start"
            style={{ height: "10mm" }}
          />
        ) : (
          <Editable className="text-[15pt] font-semibold" style={{ color: INK.fog50 }}>{brand.name}</Editable>
        )}

        <div className="mt-auto">
          <Eyebrow>Apps · Services · Products</Eyebrow>
          <Editable
            as="h1"
            className="mt-[3.5mm] text-[27pt] font-semibold leading-[1.02] tracking-[-0.035em]"
            style={{ color: INK.fog50 }}
          >
            {brand.heroTitle}
          </Editable>
          <Editable className="mt-[4mm] text-[10pt] leading-[1.45]" style={{ color: INK.fog300 }}>
            {brand.heroSubtitle}
          </Editable>
          <div
            className="mt-[6mm] pt-[3mm] flex items-center justify-between text-[9pt]"
            style={{ color: INK.fog400, borderTop: `0.25mm solid ${INK.hairline}` }}
          >
            <Editable>{brand.siteLabel}</Editable>
            {brand.phone && <Editable>{brand.phone}</Editable>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Outside(props: FolderData) {
  return (
    <>
      <ClosingPanel {...props} />
      <Cover {...props} />
    </>
  );
}

export const showcaseTemplate: FolderTemplate = {
  id: "showcase",
  name: "Showcase",
  description: "Photo-led cover, the picture filling the front with the headline over it. Inside and back as Editorial.",
  Outside,
  Inside: EditorialInside,
  sheetBackground: { outside: INK.navyDeep, inside: INK.navyDeep },
};
