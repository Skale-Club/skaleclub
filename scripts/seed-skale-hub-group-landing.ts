// Seed the existing Skale Hub WhatsApp group landing into the managed
// pages table. Idempotent: re-running updates the row in place.
// DRY-RUN by default: prints a diff. Add --apply to write (the old row is
// snapshotted into content_revisions first).
// Run: npx tsx scripts/seed-skale-hub-group-landing.ts [--apply]
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";
import { logPlannedChange, withSeedGuard } from "./lib/seed-utils.js";
import { recordRevisionOrThrow } from "../server/storage/revisions.js";

const SLUG = "grupo";
const NAME = "Skale Hub WhatsApp Group";

async function seed(apply: boolean) {
  console.log(`Seeding managed landing: slug='${SLUG}'`);

  // v1: all defaults baked into WhatsAppGroupSection - empty props bag is fine.
  const sections: PageSection[] = [{ type: "whatsappGroup", props: {} }];
  const desired = { name: NAME, sections, isActive: true };

  const [existing] = await db.select().from(pages).where(eq(pages.slug, SLUG));
  const before = existing ? { name: existing.name, sections: existing.sections, isActive: existing.isActive } : undefined;
  const changed = logPlannedChange(`page '${SLUG}'`, before, desired, apply);
  if (!apply || !changed) return;

  if (existing) {
    await recordRevisionOrThrow("page", existing.id, existing, "seed", "seed script overwrite");
    await db.update(pages).set({ ...desired, updatedAt: new Date() }).where(eq(pages.slug, SLUG));
  } else {
    await db.insert(pages).values({ slug: SLUG, ...desired });
  }
}

void withSeedGuard(seed);
