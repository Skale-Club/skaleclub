import { Phone, Mail, MapPin, Globe, Check } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import type { FolderItem } from "../items";
import { balanceByWeight, panelPadding, serviceWeight } from "../paper";
import { Editable, INK, Price, Rule, printImage } from "../primitives";

/**
 * "Catalog" — the density option.
 *
 * When the folder has to carry ten-plus services, imagery stops helping and
 * starts crowding. This template drops to a typographic list with a hairline
 * between entries: more items per panel, still legible at 8pt, and it degrades
 * gracefully when services have no image at all.
 */

function CatalogEntry({ service, showPrices }: { service: FolderItem; showPrices: boolean }) {
  return (
    <div className="py-[2.8mm]" style={{ borderBottom: `0.25mm solid ${INK.rule}` }}>
      <div className="flex items-start justify-between gap-[3mm]">
        <div className="min-w-0">
          <Editable className="text-[10.5pt] font-bold leading-tight" style={{ color: INK.navy }}>
            {service.title}
          </Editable>
          <Editable className="text-[8pt] leading-snug mt-[0.4mm]" style={{ color: INK.muted }}>
            {service.subtitle}
          </Editable>
        </div>
        {showPrices && service.price && (
          <Price price={service.price} label={service.priceLabel} />
        )}
      </div>
      {service.features.length > 0 && (
        <div className="mt-[1.4mm] flex flex-wrap gap-x-[3.5mm] gap-y-[0.6mm]">
          {service.features.map((f, i) => (
            <span key={i} className="flex items-center gap-[1.2mm] text-[7.5pt]" style={{ color: INK.body }}>
              <Check style={{ width: "2.4mm", height: "2.4mm", color: INK.cta }} />
              <Editable>{f}</Editable>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Outside({ bleed, brand, services }: FolderData) {
  const left = panelPadding(bleed, "left");
  const right = panelPadding(bleed, "right");

  return (
    <>
      <div className="w-1/2 h-full flex flex-col" style={{ ...left, backgroundColor: INK.paper }}>
        <Editable as="h2" className="text-[20pt] font-extrabold leading-tight" style={{ color: INK.navy }}>
          Let's talk.
        </Editable>
        <Rule className="mt-[3mm]" />

        <div className="mt-[5mm] flex flex-col gap-[2.5mm] text-[10pt]" style={{ color: INK.navy }}>
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

        {services.length > 0 && (
          <div className="mt-[5mm] pt-[4mm]" style={{ borderTop: `0.3mm solid ${INK.rule}` }}>
            <Editable className="text-[7.5pt] font-bold uppercase tracking-[0.18em]" style={{ color: INK.cta }}>
              In this folder
            </Editable>
            <div className="mt-[2mm] flex flex-col gap-[0.8mm]">
              {services.map((s) => (
                <Editable key={s.key} className="text-[8.5pt]" style={{ color: INK.body }}>
                  {s.title} — {s.subtitle}
                </Editable>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-[4mm]">
          <div className="flex flex-col gap-[2mm]">
            <div className="bg-white p-[1.5mm] rounded-[1.5mm]" style={{ border: `0.3mm solid ${INK.rule}` }}>
              <QRCode value={brand.siteUrl} size={60} />
            </div>
            <Editable className="text-[7pt]" style={{ color: INK.muted }}>
              Scan to visit our site
            </Editable>
          </div>
          {brand.logoOnLight && (
            <img src={printImage(brand.logoOnLight, 400)} alt={brand.name} className="object-contain" style={{ height: "9mm" }} />
          )}
        </div>
      </div>

      <div className="w-1/2 h-full flex flex-col relative" style={{ ...right, backgroundColor: INK.navy }}>
        <div className="absolute top-0 left-0 right-0" style={{ height: `${4 + bleed}mm`, backgroundColor: INK.cta }} />
        {brand.logoOnDark ? (
          <img
            src={printImage(brand.logoOnDark, 400)}
            alt={brand.name}
            className="object-contain self-start relative"
            style={{ height: "11mm", marginTop: "4mm" }}
          />
        ) : (
          <Editable className="text-[15pt] font-extrabold text-white relative" style={{ marginTop: "4mm" }}>
            {brand.name}
          </Editable>
        )}
        <div className="my-auto relative">
          <Editable as="h1" className="text-[25pt] font-extrabold leading-[1.1] text-white">
            {brand.heroTitle}
          </Editable>
          <Rule className="mt-[4mm]" width="30mm" />
          <Editable className="mt-[4mm] text-[10.5pt] leading-relaxed" style={{ color: "#A9B8D8" }}>
            {brand.heroSubtitle}
          </Editable>
        </div>
        <div className="mt-auto flex items-center justify-between text-[9.5pt]" style={{ color: "#A9B8D8" }}>
          <Editable>{brand.siteLabel}</Editable>
          {brand.phone && <Editable>{brand.phone}</Editable>}
        </div>
      </div>
    </>
  );
}

function Inside({ bleed, brand, services, showPrices, settings }: FolderData) {
  const leftPad = panelPadding(bleed, "left");
  const rightPad = panelPadding(bleed, "right");
  const about = (settings?.homepageContent ?? {}).aboutSection ?? {};

  const introWeight = 5.5;
  const { left, right } = balanceByWeight(
    services,
    (s) => serviceWeight(s.features.length),
    introWeight,
  );

  return (
    <>
      <div className="w-1/2 h-full flex flex-col" style={{ ...leftPad, backgroundColor: INK.paper }}>
        <Editable className="text-[8pt] font-bold uppercase tracking-[0.2em]" style={{ color: INK.cta }}>
          {about.label || "Our services"}
        </Editable>
        <Editable as="h2" className="mt-[2mm] text-[17pt] font-extrabold leading-[1.12]" style={{ color: INK.navy }}>
          Built to take the repetitive work off your team.
        </Editable>
        <Editable className="mt-[2mm] text-[8.5pt] leading-relaxed" style={{ color: INK.body }}>
          {about.description ||
            "A portfolio of tools and services made for service businesses: set up fast, priced clearly, and ready to scale with you."}
        </Editable>

        {/* justify-around spreads the hairlines across the panel, so a short
            folder reads as a deliberately airy list instead of a list that ran
            out halfway down the page. */}
        <div
          className="mt-[4mm] flex-1 min-h-0 flex flex-col justify-around"
          style={{ borderTop: `0.3mm solid ${INK.rule}` }}
        >
          {left.map((s) => (
            <CatalogEntry key={s.key} service={s} showPrices={showPrices} />
          ))}
        </div>
        {services.length === 0 && (
          <p className="text-[10pt]" style={{ color: INK.muted }}>
            Pick services in the sidebar.
          </p>
        )}
      </div>

      <div className="w-1/2 h-full flex flex-col" style={{ ...rightPad, backgroundColor: INK.paper }}>
        <div
          className="flex-1 min-h-0 flex flex-col justify-around"
          style={{ borderTop: `0.3mm solid ${INK.rule}` }}
        >
          {right.map((s) => (
            <CatalogEntry key={s.key} service={s} showPrices={showPrices} />
          ))}
        </div>

        <div
          className="mt-[3mm] shrink-0 rounded-[2.5mm] px-[5mm] py-[4mm] flex items-center justify-between gap-[3mm]"
          style={{ backgroundColor: INK.navy }}
        >
          <div className="min-w-0">
            <Editable className="text-[11pt] font-extrabold leading-tight text-white">
              {brand.ctaText || "Let's automate your business."}
            </Editable>
            {brand.phone && (
              <Editable className="mt-[1mm] text-[10pt] font-bold" style={{ color: "#8FA9EE" }}>
                {brand.phone}
              </Editable>
            )}
          </div>
          <div className="bg-white p-[1.2mm] rounded-[1.5mm] shrink-0">
            <QRCode value={brand.siteUrl} size={48} />
          </div>
        </div>
      </div>
    </>
  );
}

export const catalogTemplate: FolderTemplate = {
  id: "catalog",
  name: "Catalog",
  description: "Typographic list, no imagery. Fits ten-plus services per folder while staying legible.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.paper, inside: INK.paper },
};
