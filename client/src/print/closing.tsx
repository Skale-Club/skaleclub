import { Globe, Mail, MapPin, Phone } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData } from "./types";
import { panelPadding } from "./paper";
import { PanelHeading, ProductCard } from "./cards";
import { Editable, Eyebrow, INK, printImage } from "./primitives";

/**
 * Panel 4, the back cover, shared by every template.
 *
 * It finishes the numbered sequence the inside spread starts: "01 · Apps" and
 * "02 · Services" inside, "03 · Products" here, the NFC pieces from /products.
 * Under them sits the close, set as the site's CTA band (navy-850 with a blue
 * hairline on top): what to do next, how to reach us, and a QR code to the site.
 */

const ICON = { width: "3mm", height: "3mm", color: INK.ctaSoft } as const;

function ContactLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[2mm] min-w-0">
      <span className="shrink-0 flex">{icon}</span>
      <Editable className="text-[8.5pt] leading-tight truncate" style={{ color: INK.fog200 }}>
        {children}
      </Editable>
    </div>
  );
}

export function ClosingPanel({ bleed, brand, products, showPrices }: FolderData) {
  return (
    <div
      className="w-1/2 h-full flex flex-col"
      style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
    >
      {products.length > 0 && (
        <>
          <PanelHeading
            eyebrow="03 · Products"
            title="Things we make for your counter"
            subtitle="NFC pieces your customers tap with their phone."
          />
          <div className={`mt-[4.5mm] flex-1 min-h-0 grid gap-[2.4mm] ${products.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {products.map((product) => (
              <ProductCard key={product.key} product={product} showPrices={showPrices} />
            ))}
          </div>
        </>
      )}

      {/* The close, parked at the bottom. With products above, their grid
          takes the leftover height; without, `mt-auto` turns it into margin. */}
      <div
        className={`${products.length > 0 ? "mt-[5mm]" : "mt-auto"} shrink-0 px-[4.5mm] py-[4.5mm]`}
        style={{ backgroundColor: INK.navyBand, borderTop: "0.3mm solid rgba(143,169,238,0.25)" }}
      >
        <Eyebrow>Next step</Eyebrow>
        <Editable
          as="h2"
          className="mt-[2mm] text-[15pt] font-semibold leading-[1.08] tracking-[-0.02em]"
          style={{ color: INK.fog50 }}
        >
          {brand.ctaText || "Let's automate your business."}
        </Editable>
        <Editable className="mt-[1.8mm] text-[8pt] leading-snug" style={{ color: INK.fog400 }}>
          Book a free 20-minute call. Tell us what slows your team down and we will
          map what can run on its own, with no obligation.
        </Editable>

        <div className="mt-[4mm] flex items-end gap-[4mm]">
          <div className="min-w-0 flex-1 flex flex-col gap-[1.8mm]">
            {brand.phone && <ContactLine icon={<Phone style={ICON} />}>{brand.phone}</ContactLine>}
            {brand.email && <ContactLine icon={<Mail style={ICON} />}>{brand.email}</ContactLine>}
            <ContactLine icon={<Globe style={ICON} />}>{brand.siteLabel}</ContactLine>
            {brand.address && <ContactLine icon={<MapPin style={ICON} />}>{brand.address}</ContactLine>}
          </div>
          <div className="shrink-0 flex flex-col items-center gap-[1.2mm]">
            {/* The QR tile stays white whatever the panel does: a code printed
                light-on-dark does not scan reliably. */}
            <div className="bg-white p-[1.4mm]">
              <QRCode value={brand.siteUrl} size={64} />
            </div>
            <Editable className="text-[5.8pt] uppercase tracking-[0.18em]" style={{ color: INK.fog400 }}>
              Scan to visit
            </Editable>
          </div>
        </div>
      </div>

      <div className="pt-[4mm] shrink-0 flex items-end justify-between gap-[4mm]">
        {brand.socialLinks.length > 0 ? (
          // One wrapped line, not a column: six networks stacked cost a quarter
          // of the panel the products need.
          <Editable className="text-[6.5pt] leading-[1.6]" style={{ color: INK.fog400 }}>
            {brand.socialLinks
              .map((link) => link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))
              .join("  ·  ")}
          </Editable>
        ) : (
          <span />
        )}
        {brand.logoOnDark && (
          <img
            src={printImage(brand.logoOnDark, 400)}
            alt={brand.name}
            className="shrink-0 object-contain"
            style={{ height: "8mm" }}
          />
        )}
      </div>
    </div>
  );
}
