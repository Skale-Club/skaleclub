import { Phone, Mail, MapPin, Globe } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import type { FolderItem } from "../items";
import { panelPadding } from "../paper";
import { Chip, Editable, ImageFrame, INK, Price, Rule, printImage } from "../primitives";

/**
 * "Showcase" — image-forward, inverted against Editorial.
 *
 * The cover is light and quiet; the inside is a dark gallery where every service
 * is a picture card. Use it when the products photograph well and the pitch is
 * visual rather than price-led. The inside spread is treated as one continuous
 * surface: the grid crosses the fold instead of restarting on each panel.
 */

function GalleryCard({
  service,
  showPrices,
  large = false,
}: {
  service: FolderItem;
  showPrices: boolean;
  large?: boolean;
}) {
  const image = service.imageUrl || service.logoIconUrl;
  return (
    <div
      className="rounded-[2.5mm] overflow-hidden flex flex-col h-full"
      style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "0.3mm solid rgba(255,255,255,0.10)" }}
    >
      <ImageFrame src={image} ratio={large ? "16 / 8" : "16 / 9"} radius="0" tone="cta" fill />
      <div className="px-[3.5mm] py-[3mm] flex flex-col gap-[1.5mm] flex-1">
        <div className="flex items-start justify-between gap-[2.5mm]">
          <div className="min-w-0">
            <Editable
              className={`${large ? "text-[12pt]" : "text-[10pt]"} font-extrabold leading-tight text-white`}
            >
              {service.title}
            </Editable>
            <Editable className="text-[7.5pt] leading-snug mt-[0.4mm]" style={{ color: "#A9B8D8" }}>
              {service.subtitle}
            </Editable>
          </div>
          {showPrices && service.price && (
            <Price price={service.price} label={service.priceLabel} color="#8FA9EE" />
          )}
        </div>
        {service.features.length > 0 && (
          <div className="flex flex-wrap gap-[1.2mm] mt-auto pt-[1mm]">
            {service.features.slice(0, large ? 4 : 3).map((f, i) => (
              <Chip key={i} onDark>
                {f}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Outside({ bleed, brand, settings }: FolderData) {
  const left = panelPadding(bleed, "left");
  const right = panelPadding(bleed, "right");
  const heroImage = settings?.heroImageUrl || settings?.aboutImageUrl || "";

  return (
    <>
      {/* Back cover — quiet, contact-led */}
      <div className="w-1/2 h-full flex flex-col" style={{ ...left, backgroundColor: INK.paperTint }}>
        <Editable as="h2" className="text-[20pt] font-extrabold leading-tight" style={{ color: INK.navy }}>
          Let's talk.
        </Editable>
        <Rule className="mt-[3mm]" />
        <Editable className="mt-[3mm] text-[9.5pt] leading-relaxed" style={{ color: INK.body }}>
          Tell us what slows your team down. We will show you what can run on its own.
        </Editable>

        <div className="mt-[6mm] flex flex-col gap-[2.5mm] text-[10pt]" style={{ color: INK.navy }}>
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

        <div className="mt-auto flex items-end justify-between gap-[4mm]">
          <div className="flex flex-col gap-[2mm]">
            <div className="bg-white p-[1.5mm] rounded-[1.5mm]" style={{ border: `0.3mm solid ${INK.rule}` }}>
              <QRCode value={brand.siteUrl} size={64} />
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

      {/* Front cover — full-bleed image with the headline set over it */}
      <div className="w-1/2 h-full relative overflow-hidden" style={{ backgroundColor: INK.navy }}>
        {heroImage && (
          <>
            <img
              src={printImage(heroImage, 1600)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(6,14,29,0.55) 0%, rgba(6,14,29,0.80) 55%, rgba(6,14,29,0.95) 100%)" }}
            />
          </>
        )}
        <div className="relative h-full flex flex-col" style={right}>
          {brand.logoOnDark ? (
            <img
              src={printImage(brand.logoOnDark, 400)}
              alt={brand.name}
              className="object-contain self-start"
              style={{ height: "11mm" }}
            />
          ) : (
            <Editable className="text-[15pt] font-extrabold text-white">{brand.name}</Editable>
          )}

          <div className="mt-auto">
            <Editable as="h1" className="text-[26pt] font-extrabold leading-[1.08] text-white">
              {brand.heroTitle}
            </Editable>
            <Rule className="mt-[4mm]" width="30mm" />
            <Editable className="mt-[4mm] text-[10.5pt] leading-relaxed" style={{ color: "#C9D6EE" }}>
              {brand.heroSubtitle}
            </Editable>
            <div className="mt-[6mm] flex items-center justify-between text-[9.5pt]" style={{ color: "#A9B8D8" }}>
              <Editable>{brand.siteLabel}</Editable>
              {brand.phone && <Editable>{brand.phone}</Editable>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Inside({ bleed, brand, services, showPrices, settings }: FolderData) {
  const leftPad = panelPadding(bleed, "left");
  const rightPad = panelPadding(bleed, "right");
  const about = (settings?.homepageContent ?? {}).aboutSection ?? {};

  // The header occupies the top-left; the gallery flows from there across both
  // panels. Left panel holds the header plus 2 cards, right holds the rest.
  const [hero, ...rest] = services;
  const leftCards = rest.slice(0, 2);
  const rightCards = rest.slice(2);

  return (
    <>
      <div className="w-1/2 h-full flex flex-col" style={{ ...leftPad, backgroundColor: INK.navyDeep }}>
        <Editable className="text-[8pt] font-bold uppercase tracking-[0.2em]" style={{ color: "#8FA9EE" }}>
          {about.label || "Our services"}
        </Editable>
        <Editable as="h2" className="mt-[2mm] text-[17pt] font-extrabold leading-[1.12] text-white">
          Built to take the repetitive work off your team.
        </Editable>
        <Editable className="mt-[2.5mm] text-[8.5pt] leading-relaxed" style={{ color: "#A9B8D8" }}>
          {about.description ||
            "A portfolio of tools and services made for service businesses: set up fast, priced clearly, and ready to scale with you."}
        </Editable>

        {hero && (
          <div className="mt-[4mm] flex-1 min-h-0">
            <GalleryCard service={hero} showPrices={showPrices} large />
          </div>
        )}
        {leftCards.length > 0 && (
          <div className="mt-[2.5mm] shrink-0 grid grid-cols-2 gap-[2.5mm]">
            {leftCards.map((s) => (
              <GalleryCard key={s.key} service={s} showPrices={showPrices} />
            ))}
          </div>
        )}
        {services.length === 0 && (
          <p className="text-[10pt]" style={{ color: "#A9B8D8" }}>
            Pick services in the sidebar.
          </p>
        )}
      </div>

      <div className="w-1/2 h-full flex flex-col" style={{ ...rightPad, backgroundColor: INK.navyDeep }}>
        {rightCards.length > 0 && (
          // auto-rows-fr stretches the rows to fill the panel; an odd final card
          // spans both columns instead of leaving a hole beside itself.
          <div className="grid grid-cols-2 gap-[2.5mm] flex-1 min-h-0 auto-rows-fr">
            {rightCards.map((s, i) => (
              <div
                key={s.key}
                className={
                  i === rightCards.length - 1 && rightCards.length % 2 === 1
                    ? "col-span-2 min-h-0"
                    : "min-h-0"
                }
              >
                <GalleryCard service={s} showPrices={showPrices} />
              </div>
            ))}
          </div>
        )}

        <div
          className="mt-[3mm] shrink-0 rounded-[2.5mm] px-[5mm] py-[4.5mm]"
          style={{ backgroundColor: INK.cta }}
        >
          <Editable className="text-[12pt] font-extrabold leading-tight text-white">
            {brand.ctaText || "Let's automate your business."}
          </Editable>
          <Editable className="mt-[1.5mm] text-[8.5pt]" style={{ color: "#E3EAFB" }}>
            Free 20-minute call. We map what can run on its own.
          </Editable>
          <div className="mt-[3mm] flex items-center justify-between gap-[3mm]">
            <div className="flex flex-col gap-[0.8mm] text-white">
              {brand.phone && (
                <Editable className="text-[11pt] font-bold">{brand.phone}</Editable>
              )}
              <Editable className="text-[8.5pt]" style={{ color: "#E3EAFB" }}>
                {brand.siteLabel}
              </Editable>
            </div>
            <div className="bg-white p-[1.2mm] rounded-[1.5mm] shrink-0">
              <QRCode value={brand.siteUrl} size={52} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const showcaseTemplate: FolderTemplate = {
  id: "showcase",
  name: "Showcase",
  description: "Light cover with a full-bleed photo, dark gallery inside. Best when the products photograph well.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.paperTint, inside: INK.navyDeep },
};
