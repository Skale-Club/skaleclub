import { Phone, Mail, MapPin, Globe } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import { panelPadding } from "../paper";
import { Editable, ImageFrame, INK, Rule, printImage } from "../primitives";
import { AppCard, CardGrid, PanelHeading, ServiceCard } from "../cards";

/**
 * "Showcase" — image-forward, inverted against Editorial.
 *
 * The cover is light and quiet; the inside is a dark gallery where every service
 * is a picture card. Use it when the products photograph well and the pitch is
 * visual rather than price-led. The inside spread is treated as one continuous
 * surface: the grid crosses the fold instead of restarting on each panel.
 */

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

function Inside({ bleed, apps, services, showPrices }: FolderData) {
  const denseApps = apps.length > 8;
  const denseServices = services.length > 8;

  return (
    <>
      {/* Panel 2 — every app */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Ready-made software" title="Our Apps" onDark />
        {apps.length > 0 ? (
          <CardGrid>
            {apps.map((item) => (
              <AppCard key={item.key} item={item} showPrices={showPrices} dense={denseApps} onDark />
            ))}
          </CardGrid>
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: "#A9B8D8" }}>
            Pick apps in the sidebar.
          </p>
        )}
      </div>

      {/* Panel 3 — every service */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Work we do for you" title="Our Services" onDark />
        {services.length > 0 ? (
          <CardGrid>
            {services.map((item) => (
              <ServiceCard key={item.key} item={item} dense={denseServices} onDark />
            ))}
          </CardGrid>
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: "#A9B8D8" }}>
            Pick services in the sidebar.
          </p>
        )}
      </div>
    </>
  );
}

export const showcaseTemplate: FolderTemplate = {
  id: "showcase",
  name: "Showcase",
  description: "Light close, cover photo bled edge to edge, dark spread. Best when the artwork carries the pitch.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.paperTint, inside: INK.navyDeep },
};
