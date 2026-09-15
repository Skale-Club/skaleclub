import { Phone, Mail, MapPin, Globe, Check } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import type { FolderItem } from "../items";
import { balanceByWeight, panelPadding, serviceWeight } from "../paper";
import { Chip, CropMarks, Editable, ImageFrame, INK, Price, Rule, printImage } from "../primitives";

/**
 * "Editorial" — a magazine-style folder.
 *
 * Three ideas drive it:
 *  1. The cover is dark and the inside is light, so opening the folder is a
 *     visual event rather than more of the same.
 *  2. The inside has one anchor service printed large with its image, and the
 *     rest as compact rows. Equal-weight cards everywhere is what made the
 *     previous spread read as a price table.
 *  3. Every panel fills its height. Dead vertical space is the clearest tell of
 *     an auto-generated layout.
 */

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[3mm]">
      <span
        className="flex items-center justify-center shrink-0 rounded-full text-white"
        style={{ width: "7mm", height: "7mm", backgroundColor: INK.cta }}
      >
        {icon}
      </span>
      <Editable className="text-[10pt]" style={{ color: INK.navy }}>
        {children}
      </Editable>
    </div>
  );
}

/** The one service printed large, with its image. */
function AnchorCard({
  service,
  showPrices,
  grow = false,
}: {
  service: FolderItem;
  showPrices: boolean;
  /** Absorb the panel's leftover height through the image, not through padding. */
  grow?: boolean;
}) {
  const image = service.imageUrl || service.logoIconUrl;
  return (
    <div
      className={`rounded-[3mm] overflow-hidden flex flex-col ${grow ? "flex-1 min-h-0" : ""}`}
      style={{ backgroundColor: INK.navy }}
    >
      {image && <ImageFrame src={image} ratio="16 / 7" radius="0" tone="cta" fill={grow} />}
      <div className="px-[5mm] py-[4mm] flex flex-col gap-[2mm]">
        <div className="flex items-start justify-between gap-[4mm]">
          <div className="min-w-0">
            <Editable className="text-[13pt] font-extrabold leading-tight text-white">
              {service.title}
            </Editable>
            <Editable className="text-[8.5pt] mt-[0.6mm]" style={{ color: "#A9B8D8" }}>
              {service.subtitle}
            </Editable>
          </div>
          {showPrices && service.price && (
            <Price price={service.price} label={service.priceLabel} color="#8FA9EE" />
          )}
        </div>
        {service.features.length > 0 && (
          <div className="flex flex-wrap gap-[1.5mm] mt-[0.5mm]">
            {service.features.map((f, i) => (
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

/** Compact row: thumbnail, name, price, features. */
function ServiceRow({
  service,
  showPrices,
  grow = false,
}: {
  service: FolderItem;
  showPrices: boolean;
  /** Share the panel's leftover height evenly with its siblings. */
  grow?: boolean;
}) {
  const thumb = service.logoIconUrl || service.imageUrl;
  return (
    <div
      className={`flex gap-[3.5mm] rounded-[2.5mm] px-[4mm] py-[3mm] ${grow ? "flex-1 min-h-0 items-center" : ""}`}
      // Capped: without a ceiling a lone row on a panel inflates into one giant
      // near-empty card. Past the cap the slack becomes a gap before the CTA.
      style={{
        backgroundColor: INK.paper,
        border: `0.3mm solid ${INK.rule}`,
        ...(grow ? { maxHeight: "32mm" } : null),
      }}
    >
      {thumb ? (
        <img
          src={printImage(thumb, 320)}
          alt=""
          className="shrink-0 object-contain"
          style={{ width: "11mm", height: "11mm" }}
        />
      ) : (
        <div
          className="shrink-0 rounded-[1.5mm]"
          style={{ width: "11mm", height: "11mm", backgroundColor: INK.paperTint }}
        />
      )}
      <div className="min-w-0 flex-1">
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
          <div className="mt-[1.5mm] flex flex-wrap gap-x-[3.5mm] gap-y-[0.8mm]">
            {service.features.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-[1.2mm] text-[7.5pt]"
                style={{ color: INK.body }}
              >
                <Check style={{ width: "2.6mm", height: "2.6mm", color: INK.cta }} />
                <Editable>{f}</Editable>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Outside({ bleed, brand, services, settings }: FolderData) {
  const left = panelPadding(bleed, "left");
  const right = panelPadding(bleed, "right");
  const heroImage = settings?.heroImageUrl || settings?.aboutImageUrl || "";

  return (
    <>
      {/* ---- Back cover: contact ---- */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...left, backgroundColor: INK.paper }}
      >
        <Editable as="h2" className="text-[21pt] font-extrabold leading-tight" style={{ color: INK.navy }}>
          Let's talk.
        </Editable>
        <Rule className="mt-[3mm]" />
        <Editable className="mt-[3mm] text-[10pt] leading-relaxed" style={{ color: INK.body }}>
          Tell us what slows your team down. We will show you what can run on its own.
        </Editable>

        <div className="mt-[6mm] flex flex-col gap-[3mm]">
          {brand.phone && (
            <ContactRow icon={<Phone style={{ width: "3.4mm", height: "3.4mm" }} />}>
              {brand.phone}
            </ContactRow>
          )}
          {brand.email && (
            <ContactRow icon={<Mail style={{ width: "3.4mm", height: "3.4mm" }} />}>
              {brand.email}
            </ContactRow>
          )}
          {brand.address && (
            <ContactRow icon={<MapPin style={{ width: "3.4mm", height: "3.4mm" }} />}>
              {brand.address}
            </ContactRow>
          )}
          <ContactRow icon={<Globe style={{ width: "3.4mm", height: "3.4mm" }} />}>
            {brand.siteLabel}
          </ContactRow>
        </div>

        {/* Fills what used to be dead space with something useful: the line-up.
            Grows to consume the panel's slack so the back cover never ends in a
            band of empty paper above the QR code. */}
        {services.length > 0 && (
          <div
            className="mt-[6mm] flex-1 min-h-0 rounded-[3mm] px-[5mm] py-[4.5mm] flex flex-col"
            style={{ backgroundColor: INK.paperTint }}
          >
            <Editable
              className="text-[7.5pt] font-bold uppercase tracking-[0.18em] shrink-0"
              style={{ color: INK.cta }}
            >
              What we build
            </Editable>
            <div className="mt-[3mm] flex-1 flex flex-col justify-around">
              {services.map((s) => (
                <div key={s.key} className="flex items-baseline justify-between gap-[3mm]">
                  <Editable className="text-[9.5pt] font-bold" style={{ color: INK.navy }}>
                    {s.title}
                  </Editable>
                  <Editable className="text-[8pt] text-right" style={{ color: INK.muted }}>
                    {s.subtitle}
                  </Editable>
                </div>
              ))}
            </div>
          </div>
        )}

        {brand.socialLinks.length > 0 && (
          <div className="mt-[3mm] shrink-0 flex flex-wrap gap-x-[4mm] gap-y-[1mm] text-[8pt]" style={{ color: INK.muted }}>
            {brand.socialLinks.map((link, i) => (
              <span key={i} className="capitalize">
                {link.platform}: {link.url.replace(/^https?:\/\/(www\.)?/, "")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-[4mm] shrink-0 flex items-end justify-between gap-[4mm]">
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

      {/* ---- Front cover ---- */}
      <div
        className="w-1/2 h-full flex flex-col relative overflow-hidden"
        style={{ ...right, backgroundColor: INK.navy }}
      >
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: `${4 + bleed}mm`, backgroundColor: INK.cta }}
        />

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

        <div className="mt-[10mm] relative">
          <Editable as="h1" className="text-[27pt] font-extrabold leading-[1.08] text-white">
            {brand.heroTitle}
          </Editable>
          <Rule className="mt-[4mm]" width="30mm" />
          <Editable className="mt-[4mm] text-[11pt] leading-relaxed" style={{ color: "#A9B8D8" }}>
            {brand.heroSubtitle}
          </Editable>
        </div>

        {/* The image anchors the lower half — this is the panel that was empty. */}
        {heroImage ? (
          <div className="mt-auto relative" style={{ marginLeft: `-${10 + bleed}mm`, marginRight: `-${10 + bleed}mm`, marginBottom: `-${10 + bleed}mm` }}>
            <ImageFrame src={heroImage} ratio="16 / 10" radius="0" tone="navy" />
            <div
              className="absolute left-0 right-0 bottom-0 flex items-center justify-between text-[9.5pt]"
              style={{ padding: `4mm ${10 + bleed}mm ${6 + bleed}mm`, color: "#C9D6EE" }}
            >
              <Editable>{brand.siteLabel}</Editable>
              {brand.phone && <Editable>{brand.phone}</Editable>}
            </div>
          </div>
        ) : (
          <div className="mt-auto flex items-center justify-between text-[10pt]" style={{ color: "#A9B8D8" }}>
            <Editable>{brand.siteLabel}</Editable>
            {brand.phone && <Editable>{brand.phone}</Editable>}
          </div>
        )}
      </div>
    </>
  );
}

function Inside({ bleed, brand, services, showPrices, settings }: FolderData) {
  const leftPad = panelPadding(bleed, "left");
  const rightPad = panelPadding(bleed, "right");

  const about = (settings?.homepageContent ?? {}).aboutSection ?? {};
  const [anchor, ...rest] = services;

  // The left panel already carries the intro and the anchor card, so the
  // remaining services are split against that head start, not 50/50.
  const introWeight = 6;
  const anchorWeight = anchor ? serviceWeight((anchor.features ?? []).length, true) : 0;
  const { left: leftRows, right: rightRows } = balanceByWeight(
    rest,
    (s) => serviceWeight(s.features.length),
    introWeight + anchorWeight,
  );

  return (
    <>
      {/* ---- Inside left: intro + anchor ---- */}
      <div className="w-1/2 h-full flex flex-col" style={{ ...leftPad, backgroundColor: INK.paperTint }}>
        <Editable
          className="text-[8pt] font-bold uppercase tracking-[0.2em]"
          style={{ color: INK.cta }}
        >
          {about.label || "Our services"}
        </Editable>
        <Editable
          as="h2"
          className="mt-[2mm] text-[18pt] font-extrabold leading-[1.12]"
          style={{ color: INK.navy }}
        >
          Built to take the repetitive work off your team.
        </Editable>
        <Editable className="mt-[2.5mm] text-[9pt] leading-relaxed" style={{ color: INK.body }}>
          {about.description ||
            "A portfolio of tools and services made for service businesses: set up fast, priced clearly, and ready to scale with you."}
        </Editable>

        {anchor && (
          <div className="mt-[4mm] flex-1 min-h-0 flex flex-col">
            <AnchorCard service={anchor} showPrices={showPrices} grow />
          </div>
        )}

        {leftRows.length > 0 && (
          <div className="mt-[2.5mm] flex flex-col gap-[2.5mm]">
            {leftRows.map((s) => (
              <ServiceRow key={s.key} service={s} showPrices={showPrices} />
            ))}
          </div>
        )}

        {services.length === 0 && (
          <p className="text-[10pt]" style={{ color: INK.muted }}>
            Pick services in the sidebar.
          </p>
        )}
      </div>

      {/* ---- Inside right: remaining services + CTA ---- */}
      <div className="w-1/2 h-full flex flex-col" style={{ ...rightPad, backgroundColor: INK.paperTint }}>
        <div className="flex-1 min-h-0 flex flex-col gap-[2.5mm]">
          {rightRows.map((s) => (
            <ServiceRow key={s.key} service={s} showPrices={showPrices} grow />
          ))}
        </div>

        {/* The inside used to ask for nothing. This is the moment to ask. */}
        <div
          className="mt-[3mm] rounded-[3mm] px-[5mm] py-[4.5mm] text-white shrink-0"
          style={{ backgroundColor: INK.navy }}
        >
          <Editable className="text-[12pt] font-extrabold leading-tight">
            {brand.ctaText || "Let's automate your business."}
          </Editable>
          <Editable className="mt-[1.5mm] text-[8.5pt]" style={{ color: "#A9B8D8" }}>
            Free 20-minute call. We map what can run on its own.
          </Editable>
          <div className="mt-[3mm] flex items-center justify-between gap-[3mm]">
            <div className="flex flex-col gap-[0.8mm]">
              {brand.phone && (
                <Editable className="text-[11pt] font-bold" style={{ color: "#8FA9EE" }}>
                  {brand.phone}
                </Editable>
              )}
              <Editable className="text-[8.5pt]" style={{ color: "#A9B8D8" }}>
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

export const editorialTemplate: FolderTemplate = {
  id: "editorial",
  name: "Editorial",
  description: "Dark cover, light inside. One anchor service with imagery, the rest as compact rows.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.paper, inside: INK.paperTint },
};

/** Re-exported so sibling templates can reuse the row/anchor treatment. */
export { AnchorCard, ServiceRow, ContactRow };
