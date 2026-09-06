// Seed hand-written pt-BR translations for the /barbershops-br landing.
// Idempotent: re-running updates every row in place (no duplicates, same ids).
//
// Run: npx tsx --env-file=.env scripts/seed-barbershop-translations.ts
//
// Touches ONLY the `translations` table, and only rows matching
// (source_language = 'en', target_language = 'pt'). The `forms` and `pages`
// rows seeded by scripts/seed-barbershop-landing.ts are never read or written.
//
// Why hand-seed instead of letting the AI translator fill the cache:
//   t() consults the `translations` table BEFORE calling POST /api/translate.
//   A cached row is therefore authoritative and keeps winning even after the
//   provider is fixed, so this hand-written marketing copy is what ships.
//
// NOTE: the form slug `barbershop-leads` is deliberately EXCLUDED from this
// list. It is the `formSlug` prop on the `leadFormCta` section — a lookup key,
// not display text — and must never be translated.
//
// Idempotency mechanism — read this before changing the write path:
//   migrations/0019_add_translations_table.sql declares a UNIQUE index on
//   (source_text, source_language, target_language), which is what the
//   `onConflictDoUpdate` path below targets. That index is NOT present on
//   every deployed database (the production instance was provisioned without
//   it and already carries a handful of duplicate rows from earlier pages), so
//   an unconditional ON CONFLICT raises 42P10 "no unique or exclusion
//   constraint matching the ON CONFLICT specification". This script therefore
//   probes for the index at startup and falls back to an explicit
//   update-or-insert when it is absent. Both paths are idempotent. Creating
//   the missing index is deliberately OUT OF SCOPE here — it would require
//   deleting unrelated duplicate rows first.
import "dotenv/config";
import { pool, db } from "../server/db.js";
import { translations } from "../shared/schema/cms.js";
import { and, eq } from "drizzle-orm";

// ── Config ────────────────────────────────────────────────────────────────

const SOURCE_LANGUAGE = "en";
const TARGET_LANGUAGE = "pt";

// ── Translation pairs (English source → hand-written pt-BR) ────────────────
//
// Every display string on /barbershops-br: the 12 `barbershop-leads` question
// titles, every select option label, every placeholder, plus the hero and CTA
// copy carried on the landing's `heroWebsites` and `leadFormCta` sections.
//
// Strings reused across questions (`2-3`, `4-6`, `7+`, `Other`) appear exactly
// ONCE — the unique index keys on the source string, so one row covers every
// occurrence.

const PT_TRANSLATIONS: Array<{ source: string; translated: string }> = [
  // ── Contact questions ───────────────────────────────────────────────────
  { source: "What's your name?", translated: "Qual é o seu nome?" },
  { source: "Your full name", translated: "Seu nome completo" },
  { source: "What's your WhatsApp?", translated: "Qual é o seu WhatsApp?" },

  // Identity rows (this one, plus `1`, `2-3`, `4-6`, `7+` below) are
  // DELIBERATE no-op translations: source and target are identical. They are
  // not redundant. Without a cached row, t() treats every render as a cache
  // miss and re-queries the (currently broken) AI provider forever — on every
  // page load, for a string that needs no translation. Seeding an identity row
  // short-circuits that lookup permanently.
  { source: "(555) 123-4567", translated: "(555) 123-4567" },

  { source: "What's your email?", translated: "Qual é o seu e-mail?" },
  { source: "you@yourshop.com", translated: "voce@suabarbearia.com" },

  // ── Shop profile ────────────────────────────────────────────────────────
  { source: "What's the name of your barbershop?", translated: "Qual é o nome da sua barbearia?" },
  { source: "Your shop name", translated: "O nome da sua barbearia" },
  { source: "How many chairs does your shop have?", translated: "Quantas cadeiras a sua barbearia tem?" },

  // Identity rows — see the note above the `(555) 123-4567` entry.
  { source: "1", translated: "1" },
  { source: "2-3", translated: "2-3" },
  { source: "4-6", translated: "4-6" },
  { source: "7+", translated: "7+" },

  { source: "How many barbers work with you?", translated: "Quantos barbeiros trabalham com você?" },
  { source: "Just me", translated: "Só eu" },

  // ── Booking system ──────────────────────────────────────────────────────
  { source: "How do clients book with you today?", translated: "Como os clientes agendam com você hoje?" },
  { source: "WhatsApp only", translated: "Só pelo WhatsApp" },
  { source: "Booking app (Booksy, Agendor, etc.)", translated: "Aplicativo de agendamento (Booksy, Agendor, etc.)" },
  { source: "Walk-ins only", translated: "Só por ordem de chegada" },
  { source: "Phone calls", translated: "Por ligação" },
  { source: "Other", translated: "Outro" },

  // ── Economics ───────────────────────────────────────────────────────────
  { source: "What's your average ticket per client?", translated: "Qual é o seu ticket médio por cliente?" },
  { source: "Under $25", translated: "Menos de US$ 25" },
  { source: "$25-$45", translated: "US$ 25 a US$ 45" },
  { source: "$45-$75", translated: "US$ 45 a US$ 75" },
  { source: "Over $75", translated: "Mais de US$ 75" },
  { source: "How much do you invest in ads per month today?", translated: "Quanto você investe em anúncios por mês hoje?" },
  { source: "Nothing yet", translated: "Ainda não invisto" },
  { source: "Under $300", translated: "Menos de US$ 300" },
  { source: "$300-$1,000", translated: "US$ 300 a US$ 1.000" },
  { source: "Over $1,000", translated: "Mais de US$ 1.000" },

  // ── Challenge ───────────────────────────────────────────────────────────
  { source: "What's your biggest challenge right now?", translated: "Qual é o seu maior desafio hoje?" },
  { source: "Not enough new clients", translated: "Poucos clientes novos" },
  { source: "Clients don't come back", translated: "Os clientes não voltam" },
  { source: "Empty chairs on slow days", translated: "Cadeiras vazias nos dias fracos" },
  { source: "No time to handle marketing", translated: "Falta tempo para cuidar do marketing" },

  // ── Meeting format (tipoVisita — the Xphere booking hook point) ──────────
  { source: "How would you like to meet us?", translated: "Como você prefere falar com a gente?" },
  { source: "In-person visit at my shop", translated: "Visita presencial na minha barbearia" },
  { source: "Online meeting (video call)", translated: "Reunião online (chamada de vídeo)" },

  // ── Free-form ───────────────────────────────────────────────────────────
  { source: "Anything else we should know?", translated: "Mais alguma coisa que a gente deva saber?" },
  { source: "Optional", translated: "Opcional" },

  // ── Landing hero + CTA copy ─────────────────────────────────────────────
  { source: "I want more clients", translated: "Quero mais clientes" },
  {
    source: "Your barbershop deserves a full chair, every day.",
    translated: "Sua barbearia merece cadeira cheia todos os dias.",
  },
  {
    source:
      "We bring new clients into your shop with ads and booking that actually work — set up in days, not months.",
    translated:
      "Levamos clientes novos até a sua barbearia com anúncios e agendamento que realmente funcionam — no ar em dias, não em meses.",
  },
  { source: "Let's fill your chairs", translated: "Vamos encher suas cadeiras" },
  {
    source: "Tell us about your barbershop in 1 minute. We'll reply within 24 hours.",
    translated: "Conte sobre a sua barbearia em 1 minuto. Respondemos em até 24 horas.",
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────

// True only when this database actually carries the UNIQUE index from
// migration 0019. Postgres needs it to infer an arbiter for ON CONFLICT.
async function hasUniqueTranslationIndex(): Promise<boolean> {
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

async function main() {
  console.log(
    `Seeding ${PT_TRANSLATIONS.length} ${SOURCE_LANGUAGE} → ${TARGET_LANGUAGE} translations...`,
  );

  // Snapshot the existing source_text values so we can report inserted vs
  // updated. The write itself is a single upsert either way.
  const existingRows = await db
    .select({ sourceText: translations.sourceText })
    .from(translations)
    .where(
      and(
        eq(translations.sourceLanguage, SOURCE_LANGUAGE),
        eq(translations.targetLanguage, TARGET_LANGUAGE),
      ),
    );
  const existing = new Set(existingRows.map((row) => row.sourceText));

  const canUpsert = await hasUniqueTranslationIndex();
  console.log(
    canUpsert
      ? "  Unique index present - using ON CONFLICT DO UPDATE."
      : "  Unique index absent - falling back to explicit update-or-insert.",
  );

  let inserted = 0;
  let updated = 0;

  for (const pair of PT_TRANSLATIONS) {
    const isNew = !existing.has(pair.source);

    if (canUpsert) {
      await db
        .insert(translations)
        .values({
          sourceText: pair.source,
          sourceLanguage: SOURCE_LANGUAGE,
          targetLanguage: TARGET_LANGUAGE,
          translatedText: pair.translated,
        })
        .onConflictDoUpdate({
          target: [
            translations.sourceText,
            translations.sourceLanguage,
            translations.targetLanguage,
          ],
          set: {
            translatedText: pair.translated,
            updatedAt: new Date(),
          },
        });
    } else if (isNew) {
      await db.insert(translations).values({
        sourceText: pair.source,
        sourceLanguage: SOURCE_LANGUAGE,
        targetLanguage: TARGET_LANGUAGE,
        translatedText: pair.translated,
      });
    } else {
      // Scoped to the three key columns, so any pre-existing duplicate rows
      // for this exact source string converge on the same hand-written value.
      await db
        .update(translations)
        .set({ translatedText: pair.translated, updatedAt: new Date() })
        .where(
          and(
            eq(translations.sourceText, pair.source),
            eq(translations.sourceLanguage, SOURCE_LANGUAGE),
            eq(translations.targetLanguage, TARGET_LANGUAGE),
          ),
        );
    }

    if (isNew) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(
    `Done. ${PT_TRANSLATIONS.length} rows processed - ${inserted} inserted, ${updated} updated.`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
