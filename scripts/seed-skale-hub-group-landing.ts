// Seed the existing Skale Hub WhatsApp group landing into the managed
// landing_pages table. Idempotent: re-running updates the row in place.
// Run: npx tsx scripts/seed-skale-hub-group-landing.ts
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { landingPages, type LandingSection } from "../shared/schema/landings.js";

const SLUG = "grupo";
const NAME = "Skale Hub WhatsApp Group";

async function seed() {
  console.log(`Seeding managed landing: slug='${SLUG}'`);

  // v1: all defaults baked into WhatsAppGroupSection — empty props bag is fine.
  const sections: LandingSection[] = [
    { type: "whatsappGroup", props: {} },
  ];

  const existing = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.slug, SLUG));

  if (existing.length > 0) {
    const [row] = await db
      .update(landingPages)
      .set({
        name: NAME,
        sections,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(landingPages.slug, SLUG))
      .returning();
    console.log(`Updated existing landing (id=${row.id}).`);
  } else {
    const [row] = await db
      .insert(landingPages)
      .values({
        slug: SLUG,
        name: NAME,
        sections,
        isActive: true,
      })
      .returning();
    console.log(`Inserted new landing (id=${row.id}).`);
  }

  await pool.end();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
