// Replace the English props stored in the `-br` landing rows with pt-BR copy.
//
// Rows: nfc-keychains-br, barbershops-br, nfc-order-br. The seeds write the
// same English sections to both languages and rely on t() at render time; this
// stores real Portuguese so the -br pages are correct without runtime
// translation (SEO, no AI fallback latency).
//
// How: for each row, deep-walk every section prop and replace a string only
// when it exactly equals a known EN source in LANDING_PT_COPY (so hand edits in
// the admin are never overwritten). Structure, keys, ids, anchorIds, image
// URLs, themes, formSlug and the whatsapp `messages` map are never touched.
// With --apply it also upserts en->pt identity translation rows for the new PT
// strings, so t() short-circuits instead of asking the AI to "translate" text
// that is already Portuguese.
//
// DRY-RUN by default. Run:
//   npx tsx --env-file=.env scripts/patch-landing-pt-copy.ts           (diff only)
//   npx tsx --env-file=.env scripts/patch-landing-pt-copy.ts --apply   (write)
//
// Do NOT re-run the landing seeds afterwards without also re-running this
// script: the seeds write the English sections to the -br rows again.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { pages } from "../shared/schema/pages.js";
import type { PageSection } from "../shared/schema/pages.js";
import { recordRevision } from "../server/storage/revisions.js";
import { logPlannedChange, withSeedGuard } from "./lib/seed-utils.js";
import { upsertTranslations } from "./lib/seed-translations.js";
import { LANDING_PT_COPY } from "./data/landing-pt-copy.js";

const SLUGS = ["nfc-keychains-br", "barbershops-br", "nfc-order-br"] as const;

// Prop keys whose string values are identifiers / URLs / enums, never copy.
const SKIP_KEYS = new Set([
  "type", "id", "anchorId", "theme", "formSlug", "icons", "icon", "kind", "href", "url", "src",
  "image", "imageUrl", "backgroundImageUrl", "secondaryCtaHref", "logo", "video", "poster",
  "number", "align", "variant", "layout", "messages",
]);

const cleanEmDash = (s: string) => s.replace(/ — /g, " | ").replace(/—/g, "|");

// Lookup tolerant of the em-dash cleanup having already run on the stored EN.
const LOOKUP = new Map<string, string>();
for (const [en, pt] of Object.entries(LANDING_PT_COPY)) {
  LOOKUP.set(en, pt);
  LOOKUP.set(cleanEmDash(en), pt);
}

function translateProps(value: unknown, key: string, used: Set<string>, unmatched: Set<string>): unknown {
  if (typeof value === "string") {
    if (SKIP_KEYS.has(key)) return value;
    const pt = LOOKUP.get(value);
    if (pt !== undefined) {
      used.add(pt);
      return pt;
    }
    if (/\s/.test(value) && !/^https?:/.test(value)) unmatched.add(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => translateProps(v, key, used, unmatched));
  if (value && typeof value === "object") {
    if (SKIP_KEYS.has(key)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = translateProps(v, k, used, unmatched);
    return out;
  }
  return value;
}

async function main(apply: boolean) {
  const identityPairs = new Map<string, string>();

  for (const slug of SLUGS) {
    const [row] = await db.select().from(pages).where(eq(pages.slug, slug));
    if (!row) {
      console.warn(`  [skip] page '${slug}' not found`);
      continue;
    }
    const used = new Set<string>();
    const unmatched = new Set<string>();
    const nextSections = (row.sections as PageSection[]).map((s) => ({
      ...s,
      props: translateProps(s.props, "props", used, unmatched) as Record<string, unknown>,
    }));

    const changed = logPlannedChange(`page '${slug}' sections`, row.sections, nextSections, apply, 400);
    if (unmatched.size > 0) {
      console.log(`  ${unmatched.size} string(s) left as-is (no PT entry or already edited):`);
      for (const u of Array.from(unmatched)) console.log(`      ${JSON.stringify(u.length > 100 ? `${u.slice(0, 97)}...` : u)}`);
    }
    for (const pt of Array.from(used)) identityPairs.set(pt, pt);
    if (!apply || !changed) continue;

    await recordRevision("page", row.id, row, "script", "patch-landing-pt-copy");
    await db.update(pages).set({ sections: nextSections, updatedAt: new Date() }).where(eq(pages.slug, slug));
  }

  console.log(`\n  ${identityPairs.size} en->pt identity translation row(s) ${apply ? "upserting" : "would be upserted"}.`);
  if (apply && identityPairs.size > 0) {
    const pairs = Array.from(identityPairs.values()).map((t) => ({ source: t, translated: t }));
    const r = await upsertTranslations(pairs, { sourceLanguage: "en", targetLanguage: "pt" });
    console.log(`  translations: inserted=${r.inserted} updated=${r.updated}`);
  }
}

void withSeedGuard(main);
