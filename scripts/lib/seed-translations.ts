// Shared write path for hand-written translation seeds.
//
// Lifted from scripts/seed-nfc-keychains-translations.ts so a new page seed
// does not have to re-derive it. That script is deliberately left untouched —
// it works, and its comments document the reasoning in full. Read them before
// changing anything here.
//
// Idempotency, in short: migrations/0019 declares a UNIQUE index on
// (source_text, source_language, target_language), but not every deployed
// database has it — production was provisioned without it and carries a few
// duplicate rows. An unconditional ON CONFLICT therefore raises 42P10, so this
// probes for the index and falls back to update-or-insert. Both paths are
// idempotent; creating the missing index is out of scope.

import { and, eq } from "drizzle-orm";
import { pool, db } from "../../server/db.js";
import { translations } from "../../shared/schema/cms.js";

export type TranslationPair = { source: string; translated: string };

export async function hasUniqueTranslationIndex(): Promise<boolean> {
  const { rows } = await pool.query<{ present: boolean }>(`
    SELECT EXISTS (
      SELECT 1
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename  = 'translations'
         AND indexdef ILIKE '%UNIQUE%'
         AND indexdef ILIKE '%source_text%'
         AND indexdef ILIKE '%source_language%'
         AND indexdef ILIKE '%target_language%'
    ) AS present
  `);
  return rows[0]?.present === true;
}

/**
 * Write one direction's rows. Returns how many were new vs. overwritten.
 *
 * The update branch is scoped to the three key columns, so pre-existing
 * duplicates for a source string all converge on the same hand-written value.
 */
export async function upsertTranslations(
  pairs: TranslationPair[],
  { sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string },
): Promise<{ inserted: number; updated: number }> {
  const existingRows = await db
    .select({ sourceText: translations.sourceText })
    .from(translations)
    .where(
      and(
        eq(translations.sourceLanguage, sourceLanguage),
        eq(translations.targetLanguage, targetLanguage),
      ),
    );
  const existing = new Set(existingRows.map((row) => row.sourceText));
  const canUpsert = await hasUniqueTranslationIndex();

  let inserted = 0;
  let updated = 0;

  for (const pair of pairs) {
    const isNew = !existing.has(pair.source);
    const values = {
      sourceText: pair.source,
      sourceLanguage,
      targetLanguage,
      translatedText: pair.translated,
    };

    if (canUpsert) {
      await db
        .insert(translations)
        .values(values)
        .onConflictDoUpdate({
          target: [translations.sourceText, translations.sourceLanguage, translations.targetLanguage],
          set: { translatedText: pair.translated, updatedAt: new Date() },
        });
    } else if (isNew) {
      await db.insert(translations).values(values);
    } else {
      await db
        .update(translations)
        .set({ translatedText: pair.translated, updatedAt: new Date() })
        .where(
          and(
            eq(translations.sourceText, pair.source),
            eq(translations.sourceLanguage, sourceLanguage),
            eq(translations.targetLanguage, targetLanguage),
          ),
        );
    }

    if (isNew) inserted++;
    else updated++;
  }

  return { inserted, updated };
}

/**
 * pt -> en identity rows, which stop the English pages being "translated".
 *
 * t() assumes DB-backed content is authored in Portuguese, so on an EN page it
 * asks the translator to turn each string from pt into en. Our page props are
 * already English, and the cache is consulted before the AI — so an identity
 * row (English in, same English out) permanently short-circuits that lookup.
 *
 * Scope this to the English strings of the pages being seeded. Other pages have
 * legitimate pt -> en rows that must not be flattened to identity.
 */
export async function seedEnglishIdentityRows(englishStrings: string[]) {
  const unique = Array.from(new Set(englishStrings));
  return upsertTranslations(
    unique.map((text) => ({ source: text, translated: text })),
    { sourceLanguage: "pt", targetLanguage: "en" },
  );
}
