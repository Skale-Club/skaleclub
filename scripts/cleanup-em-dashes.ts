// Remove em-dashes (U+2014) from stored copy: " — " becomes " | ", a bare "—"
// becomes "|". Project rule: proposals, presentations and landing copy use
// pipes, never em-dashes.
//
// Scope:
//   pages.sections            (all rows, every string leaf except ids/urls/enums)
//   forms.config              (all rows, same rules)
//   company_settings          (every string column and every string inside jsonb columns)
//   translations              translated_text AND source_text. The source is
//                             cleaned too on purpose: t() looks rows up by the
//                             exact source string, and the EN page copy above
//                             is being cleaned, so leaving old sources would
//                             orphan every affected row. A row whose cleaned
//                             source already exists is reported and skipped.
//
// DRY-RUN by default: prints every changed string with its row identifier.
//   npx tsx --env-file=.env scripts/cleanup-em-dashes.ts           (report only)
//   npx tsx --env-file=.env scripts/cleanup-em-dashes.ts --apply   (write)
// Pages, forms and company_settings are snapshotted into content_revisions
// (source 'script') before being changed.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { pages } from "../shared/schema/pages.js";
import { forms } from "../shared/schema/forms.js";
import { companySettings } from "../shared/schema/settings.js";
import { translations } from "../shared/schema/cms.js";
import { recordRevision } from "../server/storage/revisions.js";
import { withSeedGuard } from "./lib/seed-utils.js";

const EM = "—";
const SKIP_KEYS = new Set([
  "type", "id", "anchorId", "theme", "formSlug", "icons", "icon", "kind", "href", "url", "src",
  "image", "imageUrl", "backgroundImageUrl", "secondaryCtaHref", "slug", "logo", "video", "poster", "messages",
]);
const SKIP_COLUMN = /url|email|token|secret|password|slug|phone|apikey|id$/i;

const clean = (s: string) => s.replace(/ — /g, " | ").replace(new RegExp(EM, "g"), "|");

function short(s: string) {
  return s.length > 110 ? `${s.slice(0, 107)}...` : s;
}

/** Deep clean; records each changed string as `path: before -> after`. */
function cleanDeep(value: unknown, path: string, key: string, changes: string[]): unknown {
  if (typeof value === "string") {
    if (SKIP_KEYS.has(key) || !value.includes(EM)) return value;
    const next = clean(value);
    changes.push(`${path}: ${JSON.stringify(short(value))} -> ${JSON.stringify(short(next))}`);
    return next;
  }
  if (Array.isArray(value)) return value.map((v, i) => cleanDeep(v, `${path}[${i}]`, key, changes));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cleanDeep(v, `${path}.${k}`, k, changes);
    return out;
  }
  return value;
}

function report(label: string, changes: string[]) {
  console.log(`  ${label}: ${changes.length} string(s)`);
  for (const c of changes) console.log(`      ${c}`);
}

async function main(apply: boolean) {
  let total = 0;

  console.log("pages.sections");
  for (const row of await db.select().from(pages)) {
    const changes: string[] = [];
    const next = cleanDeep(row.sections, "sections", "sections", changes);
    if (changes.length === 0) continue;
    total += changes.length;
    report(`page '${row.slug}' (id=${row.id})`, changes);
    if (!apply) continue;
    await recordRevision("page", row.id, row, "script", "cleanup-em-dashes");
    await db.update(pages).set({ sections: next as typeof row.sections, updatedAt: new Date() }).where(eq(pages.id, row.id));
  }

  console.log("forms.config");
  for (const row of await db.select().from(forms)) {
    const changes: string[] = [];
    const next = cleanDeep(row.config, "config", "config", changes);
    if (changes.length === 0) continue;
    total += changes.length;
    report(`form '${row.slug}' (id=${row.id})`, changes);
    if (!apply) continue;
    await recordRevision("form", row.id, row, "script", "cleanup-em-dashes");
    await db.update(forms).set({ config: next as typeof row.config, updatedAt: new Date() }).where(eq(forms.id, row.id));
  }

  console.log("company_settings");
  for (const row of await db.select().from(companySettings)) {
    const changes: string[] = [];
    const patch: Record<string, unknown> = {};
    for (const [col, val] of Object.entries(row as Record<string, unknown>)) {
      if (SKIP_COLUMN.test(col)) continue;
      const next = cleanDeep(val, col, col, changes);
      if (JSON.stringify(next) !== JSON.stringify(val)) patch[col] = next;
    }
    if (changes.length === 0) continue;
    total += changes.length;
    report(`company_settings (id=${row.id})`, changes);
    if (!apply) continue;
    await recordRevision("company_settings", row.id, row, "script", "cleanup-em-dashes");
    await db.update(companySettings).set(patch).where(eq(companySettings.id, row.id));
  }

  console.log("translations");
  const all = await db.select().from(translations);
  const existingKeys = new Set(all.map((t) => `${t.sourceLanguage}|${t.targetLanguage}|${t.sourceText}`));
  const tChanges: string[] = [];
  const updates: Array<{ id: number; sourceText: string; translatedText: string }> = [];
  for (const t of all) {
    if (!t.sourceText.includes(EM) && !t.translatedText.includes(EM)) continue;
    const sourceText = clean(t.sourceText);
    const translatedText = clean(t.translatedText);
    if (sourceText !== t.sourceText && existingKeys.has(`${t.sourceLanguage}|${t.targetLanguage}|${sourceText}`)) {
      tChanges.push(`id=${t.id} [${t.sourceLanguage}>${t.targetLanguage}]: SKIPPED, cleaned source already exists: ${JSON.stringify(short(sourceText))}`);
      continue;
    }
    tChanges.push(`id=${t.id} [${t.sourceLanguage}>${t.targetLanguage}]: ${JSON.stringify(short(t.translatedText))} -> ${JSON.stringify(short(translatedText))}${sourceText !== t.sourceText ? " (source cleaned too)" : ""}`);
    updates.push({ id: t.id, sourceText, translatedText });
  }
  total += updates.length;
  report("translations rows", tChanges);
  if (apply) {
    for (const u of updates) {
      await db.update(translations).set({ sourceText: u.sourceText, translatedText: u.translatedText, updatedAt: new Date() }).where(eq(translations.id, u.id));
    }
  }

  console.log(`\nTotal changed strings: ${total}`);
}

void withSeedGuard(main);
