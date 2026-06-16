// Seed the existing Skale Hub WhatsApp group landing into the managed
// landing_pages table. Idempotent: re-running updates the row in place.
// Run: npx tsx scripts/seed-skale-hub-group-landing.ts
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";

const SLUG = "grupo";
const NAME = "Skale Hub WhatsApp Group";

async function seed() {
  console.log(`Seeding managed landing: slug='${SLUG}'`);

  // v1: all defaults baked into WhatsAppGroupSection — empty props bag is fine.
  const sections: PageSection[] = [
    { type: "whatsappGroup", props: {} },
  ];

  const existing = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, SLUG));

  if (existing.length > 0) {
    const [row] = await db
      .update(pages)
      .set({
        name: NAME,
        sections,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(pages.slug, SLUG))
      .returning();
    console.log(`Updated existing landing (id=${row.id}).`);
  } else {
    const [row] = await db
      .insert(pages)
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
