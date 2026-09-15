import { Phone, Mail, MapPin, Globe } from "lucide-react";
import QRCode from "react-qr-code";
import type { FolderData, FolderTemplate } from "../types";
import { CONTENT_PAD_MM, panelPadding } from "../paper";
import { AppCard, CardGrid, PanelHeading, ServiceListItem, TrustPoints } from "../cards";
import { Editable, ImageFrame, INK, Rule, printImage } from "../primitives";

/**
 * "Editorial" — the default folder.
 *
 * A bi-fold is four panels, and each one has a job:
 *
 *   Panel 1 (outside right)  Cover. Brand, promise, the founder photo.
 *   Panel 2 (inside left)    Every app, as a card with its own artwork.
 *   Panel 3 (inside right)   Every service we perform.
 *   Panel 4 (outside left)   The close: what to do next, and how to reach us.
 *
 * Apps and services get a panel each rather than being mixed into one flowing
 * list. They are different things to buy, and a reader opening the folder
 * should see the line-up split the way the business is actually split.
 */

function ContactRow({
  icon,
  children,
  onDark = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-[3mm]">
      <span
        className="flex items-center justify-center shrink-0 rounded-full text-white"
        style={{ width: "7mm", height: "7mm", backgroundColor: INK.cta }}
      >
        {icon}
      </span>
      <Editable className="text-[10pt]" style={{ color: onDark ? "#DCE4F2" : INK.navy }}>
        {children}
      </Editable>
    </div>
  );
}

const ICON = { width: "3.4mm", height: "3.4mm" } as const;

/** Panel 4 — the close. */
function BackPanel({ bleed, brand, settings }: FolderData) {
  // Reuses the homepage trust badges rather than inventing closing copy: the
  // claims on the folder should be the claims on the site.
  const badges = (settings?.homepageContent?.trustBadges ?? []).slice(0, 3);
  return (
    <div
      className="w-1/2 h-full flex flex-col"
      style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
    >
      <Editable
        className="text-[7.5pt] font-bold uppercase tracking-[0.2em]"
        style={{ color: "#8FA9EE" }}
      >
        Next step
      </Editable>
      <Editable
        as="h2"
        className="mt-[1.5mm] text-[20pt] font-extrabold leading-[1.1] text-white"
      >
        {brand.ctaText || "Let's automate your business."}
      </Editable>
      <Rule className="mt-[3mm]" />
      <Editable className="mt-[3mm] text-[9.5pt] leading-relaxed" style={{ color: "#A9B8D8" }}>
        Book a free 20-minute call. Tell us what slows your team down and we will
        map what can run on its own, with no obligation.
      </Editable>

      <div className="mt-[6mm] flex flex-col gap-[3mm]">
        {brand.phone && (
          <ContactRow icon={<Phone style={ICON} />} onDark>{brand.phone}</ContactRow>
        )}
        {brand.email && (
          <ContactRow icon={<Mail style={ICON} />} onDark>{brand.email}</ContactRow>
        )}
        {brand.address && (
          <ContactRow icon={<MapPin style={ICON} />} onDark>{brand.address}</ContactRow>
        )}
        <ContactRow icon={<Globe style={ICON} />} onDark>{brand.siteLabel}</ContactRow>
      </div>

      <TrustPoints badges={badges} />

      <div
        className="mt-auto shrink-0 rounded-[3mm] px-[5mm] py-[4.5mm] flex items-center gap-[4.5mm]"
        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "0.25mm solid rgba(255,255,255,0.12)" }}
      >
        {/* The QR tile stays white whatever the panel does: a code printed
            light-on-dark does not scan reliably. */}
        <div className="bg-white p-[1.5mm] rounded-[1.5mm] shrink-0">
          <QRCode value={brand.siteUrl} size={62} />
        </div>
        <div className="min-w-0">
          <Editable className="text-[10pt] font-bold leading-tight text-white">
            See everything we build
          </Editable>
          <Editable className="mt-[1mm] text-[8.5pt] leading-snug" style={{ color: "#A9B8D8" }}>
            Point your camera at the code to open {brand.siteLabel}, with pricing
            and examples for every item in this folder.
          </Editable>
        </div>
      </div>

      {brand.socialLinks.length > 0 && (
        <div className="mt-[3mm] shrink-0 flex flex-wrap gap-x-[4mm] gap-y-[1mm] text-[8pt]" style={{ color: INK.muted }}>
          {brand.socialLinks.map((link, i) => (
            <span key={i} className="capitalize">
              {link.platform}: {link.url.replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          ))}
        </div>
      )}

      {brand.logoOnDark && (
        <img
          src={printImage(brand.logoOnDark, 400)}
          alt={brand.name}
          className="mt-[4mm] shrink-0 object-contain self-start"
          style={{ height: "9mm" }}
        />
      )}
    </div>
  );
}

/** Panel 1 — the cover. */
function CoverPanel({ bleed, brand }: FolderData) {
  const heroImage = brand.coverPhoto;
  const pad = panelPadding(bleed, "right");

  return (
    <div
      className="w-1/2 h-full flex flex-col relative overflow-hidden"
      style={{ ...pad, backgroundColor: INK.navy }}
    >
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: `${4 + bleed}mm`, backgroundColor: INK.cta }}
      />

      {brand.logoOnDark ? (
        <img
          src={printImage(brand.logoOnDark, 400)}
          alt={brand.name}
          className="object-contain self-start relative shrink-0"
          style={{ height: "11mm", marginTop: "4mm" }}
        />
      ) : (
        <Editable
          className="text-[15pt] font-extrabold text-white relative shrink-0"
          style={{ marginTop: "4mm" }}
        >
          {brand.name}
        </Editable>
      )}

      <div className="mt-[9mm] relative shrink-0">
        <Editable as="h1" className="text-[26pt] font-extrabold leading-[1.08] text-white">
          {brand.heroTitle}
        </Editable>
        <Rule className="mt-[4mm]" width="30mm" />
        <Editable className="mt-[4mm] text-[10.5pt] leading-relaxed" style={{ color: "#A9B8D8" }}>
          {brand.heroSubtitle}
        </Editable>
      </div>

      {/* The founder photo, bled to the panel edges. This is the same image the
          site runs in its hero — the folder should not introduce a different
          face for the business. */}
      {heroImage ? (
        <div
          className="mt-[6mm] flex-1 min-h-0 flex flex-col relative"
          style={{
            marginLeft: `-${CONTENT_PAD_MM}mm`,
            marginRight: `-${CONTENT_PAD_MM + bleed}mm`,
            marginBottom: `-${CONTENT_PAD_MM + bleed}mm`,
          }}
        >
          <ImageFrame
            src={heroImage}
            radius="0"
            tone="navy"
            fill
            className="w-full"
            style={{ minHeight: "60mm" }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 flex items-center justify-between text-[9.5pt]"
            style={{ padding: `4mm ${CONTENT_PAD_MM + bleed}mm ${6 + bleed}mm ${CONTENT_PAD_MM}mm`, color: "#C9D6EE" }}
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
  );
}

function Outside(props: FolderData) {
  return (
    <>
      <BackPanel {...props} />
      <CoverPanel {...props} />
    </>
  );
}

function Inside({ bleed, apps, services, showPrices }: FolderData) {
  // Past eight cards a two-column grid runs out of row height, so the panel
  // goes to three columns and the cards drop their feature chips.
  const denseApps = apps.length > 8;
  const appColumns: 2 | 3 = apps.length > 8 ? 3 : 2;
  // Description lines per row: fewer as the list grows, so every row still fits.
  const descriptionLines = services.length > 9 ? 1 : services.length > 7 ? 2 : services.length > 5 ? 3 : 4;
  // A short list should not be spread across the whole panel.
  const stretchList = services.length >= 5;

  return (
    <>
      {/* Panel 2 — every app */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "left"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Ready-made software" title="Our Apps" />
        {apps.length > 0 ? (
          <CardGrid
            items={apps}
            columns={appColumns}
            renderItem={(item, { wide, span }) => (
              <AppCard key={item.key} item={item} showPrices={showPrices} dense={denseApps} span={wide ? span : 1} />
            )}
          />
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: INK.muted }}>
            Pick apps in the sidebar.
          </p>
        )}
      </div>

      {/* Panel 3 — every service */}
      <div
        className="w-1/2 h-full flex flex-col"
        style={{ ...panelPadding(bleed, "right"), backgroundColor: INK.navyDeep }}
      >
        <PanelHeading eyebrow="Work we do for you" title="Our Services" />
        {services.length > 0 ? (
          // A list, not a grid: panel 2 is scanned by picture, panel 3 is read.
          <div className="mt-[3mm] flex-1 min-h-0 flex flex-col">
            {services.map((item, i) => (
              <ServiceListItem
                key={item.key}
                item={item}
                descriptionLines={descriptionLines}
                last={i === services.length - 1}
                stretch={stretchList}
              />
            ))}
          </div>
        ) : (
          <p className="mt-[4mm] text-[9pt]" style={{ color: "#A9B8D8" }}>
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
  description: "All dark, like the site. Apps as picture cards on one panel, services as a read-through list on the other.",
  Outside,
  Inside,
  sheetBackground: { outside: INK.navyDeep, inside: INK.navyDeep },
};

export { ContactRow };
