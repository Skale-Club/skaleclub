import { Phone, Mail, MapPin, Globe, Check } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import type { FolderItem } from "../items";
import { panelPadding } from "../paper";
import { PanelHeading } from "../cards";
import { CoverPanel } from "./editorial";
import { Editable, INK, Price, Rule, printImage } from "../primitives";

/**
 * "Catalog" — the density option.
 *
 * When the folder has to carry ten-plus services, imagery stops helping and
 * starts crowding. This template drops to a typographic list with a hairline
 * between entries: more items per panel, still legible at 8pt, and it degrades
 * gracefully when services have no image at all.
 */

function CatalogEntry({
  item,
  showPrices,
  descriptionLines = 2,
}: {
  item: FolderItem;
  showPrices: boolean;
  descriptionLines?: number;
}) {
  return (
    <div className="py-[2.8mm]" style={{ borderBottom: "0.2mm solid rgba(255,255,255,0.12)" }}>
      <div className="flex items-start justify-between gap-[3mm]">
        <div className="min-w-0">
          <Editable className="text-[10.5pt] font-bold leading-tight text-white">
            {item.title}
          </Editable>
          {item.subtitle && (
            <Editable className="text-[8pt] leading-snug mt-[0.4mm]" style={{ color: INK.cta }}>
              {item.subtitle}
            </Editable>
          )}
        </div>
        {showPrices && item.price && (
          <Price price={item.price} label={item.priceLabel} color="#8FA9EE" />
        )}
      </div>

      {item.description && (
        <Editable
          className="text-[7.5pt] leading-[1.35] mt-[1mm] overflow-hidden"
          style={{
            color: "#A9B8D8",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: descriptionLines,
          }}
        >
          {item.description}
        </Editable>
      )}

      {item.features.length > 0 && (
        <div className="mt-[1.4mm] flex flex-wrap gap-x-[3.5mm] gap-y-[0.6mm]">
          {item.features.slice(0, 3).map((f, i) => (
            // #8FA9EE, not INK.body: the light-surface body colour is close to
            // unreadable on the navy panel this template now prints on.
            <span key={i} className="flex items-center gap-[1.2mm] text-[7.5pt]" style={{ color: "#8FA9EE" }}>
              <Check style={{ width: "2.4mm", height: "2.4mm", color: INK.cta }} />
              <Editable>{f}</Editable>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Outside(props: FolderData) {
  const { bleed, brand, apps, services } = props;
  const everything = [...apps, ...services];
  const left = panelPadding(bleed, "left");

  return (
    <>
      <div className="w-1/2 h-full flex flex-col" style={{ ...left, backgroundColor: INK.navyDeep }}>
        <Editable as="h2" className="text-[20pt] font-extrabold leading-tight text-white">
          Let's talk.
        </Editable>
        <Rule className="mt-[3mm]" />

        <div className="mt-[5mm] flex flex-col gap-[2.5mm] text-[10pt]" style={{ color: "#DCE4F2" }}>
          {brand.phone && (
            <div className="flex items-center gap-[2.5mm]">
              <Phone style={{ width: "3.6mm", height: "3.6mm", color: INK.cta }} />
              <Editable>{brand.phone}</Editable>
            </div>
          )}
          {brand.email && (
            <div className="flex items-center gap-[2.5mm]">
              <Mail style={{ width: "3.6mm", height: "3.6mm", color: INK.cta }} />
              <Editable>{brand.email}</Editable>
            </div>
          )}
          {brand.address && (
            <div className="flex items-center gap-[2.5mm]">
              <MapPin style={{ width: "3.6mm", height: "3.6mm", color: INK.cta }} />
              <Editable>{brand.address}</Editable>
            </div>
          )}
          <div className="flex items-center gap-[2.5mm]">
            <Globe style={{ width: "3.6mm", height: "3.6mm", color: INK.cta }} />
            <Editable>{brand.siteLabel}</Editable>
          </div>
        </div>

        {everything.length > 0 && (
          <div className="mt-[5mm] pt-[4mm]" style={{ borderTop: "0.3mm solid rgba(255,255,255,0.14)" }}>
            <Editable className="text-[7.5pt] font-bold uppercase tracking-[0.18em]" style={{ color: INK.cta }}>
              In this folder
            </Editable>
            <div className="mt-[2mm] flex flex-col gap-[0.8mm]">
              {everything.map((item) => (
                <Editable key={item.key} className="text-[8.5pt]" style={{ color: "#A9B8D8" }}>
                  {item.subtitle ? `${item.title} — ${item.subtitle}` : item.title}
                </Editable>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-[4mm]">
          <div className="flex flex-col gap-[2mm]">
            <div className="bg-white p-[1.5mm] rounded-[1.5mm]">
              <QRCode value={brand.siteUrl} size={60} />
            </div>
            <Editable className="text-[7pt]" style={{ color: INK.muted }}>
              Scan to visit our site
            </Editable>
          </div>
          {brand.logoOnDark && (
            <img src={printImage(brand.logoOnDark, 400)} alt={brand.name} className="object-contain" style={{ height: "9mm" }} />
          )}
        </div>
      </div>

      {/* The cover is the one panel this template does not strip down: the
          founder photo is the brand, whatever the inside looks like. */}
      <CoverPanel {...props} />
    </>
  );
}

function Inside({ bleed, apps, services, showPrices }: FolderData) {
  return (
    <>
      {/* Panel 2 — every app */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Ready-made software" title="Our Apps" />
        <div
          className="mt-[3.5mm] flex-1 min-h-0 flex flex-col justify-around"
          style={{ borderTop: "0.3mm solid rgba(255,255,255,0.14)" }}
        >
          {apps.map((item) => (
            <CatalogEntry
              key={item.key}
              item={item}
              showPrices={showPrices}
              descriptionLines={apps.length > 6 ? 1 : 2}
            />
          ))}
        </div>
      </div>

      {/* Panel 3 — every service */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Work we do for you" title="Our Services" />
        <div
          className="mt-[3.5mm] flex-1 min-h-0 flex flex-col justify-around"
          style={{ borderTop: "0.3mm solid rgba(255,255,255,0.14)" }}
        >
          {services.map((item) => (
            <CatalogEntry
              key={item.key}
              item={item}
              showPrices={false}
              descriptionLines={services.length > 7 ? 1 : 2}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export const catalogTemplate: FolderTemplate = {
  id: "catalog",
  name: "Catalog",
  description: "Typographic list, no imagery. For when the line-up is long and photos would only crowd it.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.navyDeep, inside: INK.navyDeep },
};
