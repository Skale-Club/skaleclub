import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import type { OurServicesCard } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Adds "3D Printing" to the homepage "Our Services" section.
 *
 * These cards live in `company_settings.homepage_content.ourServicesSection`
 * (admin-managed) rather than in the `portfolio_services` table, which holds the
 * six X-branded products. 3D printing is a service we perform, not a subscription
 * product, so it belongs here alongside Paid Advertising and Branding.
 *
 * Idempotent: re-running updates the existing card in place instead of appending
 * a duplicate. Run with `npx tsx scripts/add-3d-printing-service.ts`.
 *
 * The card's image is produced by `npm run gen:service-images`, which writes
 * `client/public/service-images/3d-printing.jpg`. Run that first if the file is
 * not there yet, or the card renders with an empty image frame.
 */

const CARD: Omit<OurServicesCard, "order"> = {
  enabled: true,
  imageUrl: "/service-images/3d-printing.jpg",
  title: "3D Printing",
  subtitle: "Custom parts and branded pieces",
  description:
    "Custom 3D-printed pieces for your business: branded NFC keychains, display stands, " +
    "signage parts, prototypes and replacement parts. We prepare the file from your logo or " +
    "drawing, print it, and test every piece before it ships.",
  features: ["Branded keychains", "Prototypes", "Custom parts"],
};

async function main() {
  const rows = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  if (rows.length === 0) {
    console.error("No company_settings row with id=1. Seed the database first.");
    process.exitCode = 1;
    return;
  }

  const current = rows[0];
  const homepageContent = current.homepageContent ?? {};
  const section = homepageContent.ourServicesSection ?? {};
  const cards: OurServicesCard[] = [...(section.cards ?? [])];

  const existingIndex = cards.findIndex(
    (c) => c.title.trim().toLowerCase() === CARD.title.toLowerCase(),
  );

  if (existingIndex >= 0) {
    cards[existingIndex] = { ...cards[existingIndex], ...CARD };
    console.log(`Updated existing "${CARD.title}" card (position ${existingIndex + 1}).`);
  } else {
    const nextOrder = cards.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
    cards.push({ ...CARD, order: nextOrder });
    console.log(`Appended "${CARD.title}" card at order ${nextOrder}.`);
  }

  await db
    .update(companySettings)
    .set({
      homepageContent: {
        ...homepageContent,
        ourServicesSection: { ...section, cards },
      },
    })
    .where(eq(companySettings.id, 1));

  console.log(`Done. "Our Services" now has ${cards.length} cards:`);
  for (const c of [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    console.log(`  ${c.order}. ${c.title}${c.enabled === false ? " (disabled)" : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
