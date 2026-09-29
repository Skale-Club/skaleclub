// Seed tech company content into company_settings.
// DRY-RUN by default: prints a diff. Add --apply to write (the old row is
// snapshotted into content_revisions first).
//
// Run: npx tsx --env-file=.env scripts/seed-tech-content.ts [--apply]
import "dotenv/config";
import { db } from "../server/db.js";
import { companySettings } from "../shared/schema.js";
import { DEFAULT_COMPANY_SETTINGS_SEED } from "../shared/defaults/cms.js";
import { recordRevision } from "../server/storage/revisions.js";
import { diffJson, logPlannedChange, withSeedGuard } from "./lib/seed-utils.js";

async function seedTechContent(apply: boolean) {
  console.log("Seeding tech company content...\n");

  const [existing] = await db.select().from(companySettings).limit(1);

  if (!existing) {
    logPlannedChange("company_settings (new row)", undefined, DEFAULT_COMPANY_SETTINGS_SEED, apply);
    if (apply) await db.insert(companySettings).values(DEFAULT_COMPANY_SETTINGS_SEED);
    return;
  }

  // Only the keys the seed sets are compared; other columns are untouched.
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_COMPANY_SETTINGS_SEED)) before[k] = (existing as Record<string, unknown>)[k];
  const changed = diffJson(before, DEFAULT_COMPANY_SETTINGS_SEED).length > 0;
  logPlannedChange("company_settings", before, DEFAULT_COMPANY_SETTINGS_SEED, apply);
  if (!apply || !changed) return;

  await recordRevision("company_settings", existing.id, existing, "seed", "seed-tech-content overwrite");
  await db.update(companySettings).set(DEFAULT_COMPANY_SETTINGS_SEED);
}

void withSeedGuard(seedTechContent);
