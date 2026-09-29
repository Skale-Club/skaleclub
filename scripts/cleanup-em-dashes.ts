// Remove em-dashes (U+2014) from stored copy: " — " and a bare "—" both become
// " | ". Project rule: proposals, presentations and landing copy use pipes,
// never em-dashes.
//
// Scope:
//   pages.sections            (all rows; identifier/url/enum keys and their subtrees are skipped)
//   forms.config              (all rows; ONLY title/label/placeholder/text/description/helpText are cleaned)
//   company_settings          (every string column and every string inside jsonb columns)
//   translations              translated_text is cleaned in place. source_text is
//                             NEVER rewritten: when a source contains an em-dash a
//                             NEW row with the cleaned source is inserted (unless
//                             it already exists) and the original row is kept, so
//                             both the old and the cleaned page copy keep resolving.
//
// DRY-RUN by default: prints every changed string with its row identifier.
//   npx tsx --env-file=.env scripts/cleanup-em-dashes.ts           (report only)
//   npx tsx --env-file=.env scripts/cleanup-em-dashes.ts --apply   (write)
// Before --apply writes anything, every affected row is dumped to
// scripts/backups/em-dash-<timestamp>.json. Pages, forms and company_settings
// are also snapshotted into content_revisions (source 'script'); if a snapshot
// cannot be recorded the script aborts.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { pages } from "../shared/schema/pages.js";
import { forms } from "../shared/schema/forms.js";
import { companySettings } from "../shared/schema/settings.js";
import { translations } from "../shared/schema/cms.js";
import { recordRevisionOrThrow } from "../server/storage/revisions.js";
import { withSeedGuard } from "./lib/seed-utils.js";

const EM = "—";
const SKIP_KEYS = new Set([
  "type", "id", "anchorId", "theme", "formSlug", "icons", "icon", "kind", "href", "url", "src",
  "image", "imageUrl", "backgroundImageUrl", "secondaryCtaHref", "slug", "key", "logo", "video", "poster", "messages",
  "value", "showWhen", "equals", "notEquals", "questionId", "ghlFieldId", "typeQuestionId", "quantityQuestionId",
]);
const FORM_TEXT_KEYS = new Set(["title", "label", "placeholder", "text", "description", "helpText"]);
const SKIP_COLUMN = /url|email|token|secret|password|slug|phone|apikey|id$/i;

const clean = (s: string) => s.replace(/\s*—\s*/g, " | ");

function short(s: string) {
  return s.length > 110 ? `${s.slice(0, 107)}...` : s;
}

/** Deep clean; records each changed string as `path: before -> after`. Skip keys prune whole subtrees. */
function cleanDeep(value: unknown, p: string, key: string, changes: string[], only?: Set<string>): unknown {
  if (SKIP_KEYS.has(key)) return value;
  if (typeof value === "string") {
    if (!value.includes(EM)) return value;
    if (only && !only.has(key)) return value;
    const next = clean(value);
    changes.push(`${p}: ${JSON.stringify(short(value))} -> ${JSON.stringify(short(next))}`);
    return next;
  }
  if (Array.isArray(value)) return value.map((v, i) => cleanDeep(v, `${p}[${i}]`, key, changes, only));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cleanDeep(v, `${p}.${k}`, k, changes, only);
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
  const backup: Record<string, unknown[]> = { pages: [], forms: [], company_settings: [], translations: [] };
  const writes: Array<() => Promise<void>> = [];

  console.log("pages.sections");
  for (const row of await db.select().from(pages)) {
    const changes: string[] = [];
    const next = cleanDeep(row.sections, "sections", "sections", changes);
    if (changes.length === 0) continue;
    total += changes.length;
    report(`page '${row.slug}' (id=${row.id})`, changes);
    backup.pages.push(row);
    writes.push(async () => {
      await recordRevisionOrThrow("page", row.id, row, "script", "cleanup-em-dashes");
      await db.update(pages).set({ sections: next as typeof row.sections, updatedAt: new Date() }).where(eq(pages.id, row.id));
    });
  }

  console.log("forms.config");
  for (const row of await db.select().from(forms)) {
    const changes: string[] = [];
    const next = cleanDeep(row.config, "config", "config", changes, FORM_TEXT_KEYS);
    if (changes.length === 0) continue;
    total += changes.length;
    report(`form '${row.slug}' (id=${row.id})`, changes);
    backup.forms.push(row);
    writes.push(async () => {
      await recordRevisionOrThrow("form", row.id, row, "script", "cleanup-em-dashes");
      await db.update(forms).set({ config: next as typeof row.config, updatedAt: new Date() }).where(eq(forms.id, row.id));
    });
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
    backup.company_settings.push(row);
    writes.push(async () => {
      await recordRevisionOrThrow("company_settings", row.id, row, "script", "cleanup-em-dashes");
      await db.update(companySettings).set(patch).where(eq(companySettings.id, row.id));
    });
  }

  console.log("translations");
  const all = await db.select().from(translations);
  const existingKeys = new Set(all.map((t) => `${t.sourceLanguage}|${t.targetLanguage}|${t.sourceText}`));
  const tChanges: string[] = [];
  for (const t of all) {
    if (!t.sourceText.includes(EM) && !t.translatedText.includes(EM)) continue;
    const cleanedSource = clean(t.sourceText);
    const cleanedTranslated = clean(t.translatedText);
    const sourceChanged = cleanedSource !== t.sourceText;
    const key = `${t.sourceLanguage}|${t.targetLanguage}|${cleanedSource}`;
    const willInsert = sourceChanged && !existingKeys.has(key);
    if (sourceChanged) existingKeys.add(key); // planned keys count too, to avoid collisions
    tChanges.push(
      `id=${t.id} [${t.sourceLanguage}>${t.targetLanguage}]: translated ${JSON.stringify(short(t.translatedText))} -> ${JSON.stringify(short(cleanedTranslated))}` +
        (sourceChanged ? (willInsert ? " | NEW row with cleaned source" : " | cleaned source already exists, no insert") : ""),
    );
    backup.translations.push(t);
    total++;
    writes.push(async () => {
      if (cleanedTranslated !== t.translatedText) {
        await db.update(translations).set({ translatedText: cleanedTranslated, updatedAt: new Date() }).where(eq(translations.id, t.id));
      }
      if (willInsert) {
        await db.insert(translations).values({
          sourceText: cleanedSource,
          sourceLanguage: t.sourceLanguage,
          targetLanguage: t.targetLanguage,
          translatedText: cleanedTranslated,
        });
      }
    });
  }
  report("translations rows", tChanges);

  if (apply && writes.length > 0) {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `em-dash-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");
    console.log(`\n  Backup of every affected row written to ${file}`);
    for (const w of writes) await w();
  }

  console.log(`\nTotal changed strings/rows: ${total}`);
}

void withSeedGuard(main);
