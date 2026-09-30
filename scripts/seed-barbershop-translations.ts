// Seed hand-written pt-BR translations for the /barbershops-br landing.
// Idempotent: re-running updates every row in place (no duplicates, same ids).
// DRY-RUN by default: prints what would change. Add --apply to write, same
// convention as every other seed script (scripts/lib/seed-utils.ts).
//
// Run: npx tsx --env-file=.env scripts/seed-barbershop-translations.ts [--apply]
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
// Scope, on purpose: the `translations` table has NO per-page column — a row
// here answers t() for EVERY page that ever renders the same exact English
// string, not just /barbershops-br (e.g. a generic tag like "Reminders" or
// "Analytics" would silently start translating on any other page that
// happens to use that exact word). This list is therefore kept to strings
// that are either specific enough to this landing's copy to be unambiguous
// everywhere (headlines, full sentences), or identity rows for short reused
// tokens ("Google Ads") where translating to itself cannot break anything.
// Generic single-word feature tags that used to live here (Reminders,
// Calendar Sync, Responsive, SEO Optimized, Analytics, ...) were deliberately
// dropped along with the three-item bullet lists that used them — see
// scripts/seed-barbershop-landing.ts.
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
import { parseSeedArgs } from "./lib/seed-utils.js";

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
  { source: "What's your shop address?", translated: "Qual é o endereço da sua barbearia?" },
  { source: "Street, number, city", translated: "Rua, número, cidade" },

  // ── Thank-you booking CTA (LeadThankYou.tsx, quick 260906-g80) ──────────
  { source: "Schedule your visit", translated: "Agendar minha visita" },
  { source: "Pick the day and time that work best for you. It only takes a minute.", translated: "Escolha o dia e o horário que funcionam melhor para você. Leva só um minuto." },

  // ── Free-form ───────────────────────────────────────────────────────────
  { source: "Anything else we should know?", translated: "Mais alguma coisa que a gente deva saber?" },
  { source: "Optional", translated: "Opcional" },

  // ── Landing hero + CTA copy (2026-09-30 content: hero phone demo, the
  // "more money / more time" feature grids, the NFC block and the pricing
  // block copied from the live catalog; revised 2026-09-30 to drop ad-cliché
  // phrasing and three-item lists per review) ─────────────────────────────
  {
    source: "More time in your day. More money in your pocket.",
    translated: "Mais tempo no seu dia. Mais dinheiro no seu bolso.",
  },
  { source: "We work with barbershops.", translated: "Trabalhamos com barbearias." },
  { source: "Get more clients", translated: "Quero mais clientes" },
  {
    source: "Hear it working: (224) 551-6131",
    translated: "Ouça funcionando: (224) 551-6131",
  },
  {
    source: "An AI answers that line for a barbershop. It gives prices and hours. Then it books the cut.",
    translated: "Uma IA atende esse número para uma barbearia. Ela informa preço e horário. Depois agenda o corte.",
  },
  { source: "Let's fill your chairs", translated: "Vamos encher suas cadeiras" },
  {
    source: "Tell us about your shop in a minute. Or call (224) 551-6131 first to hear the AI answer the phone.",
    translated: "Conte sobre a sua barbearia em um minuto. Ou ligue primeiro para (224) 551-6131 para ouvir a IA atendendo o telefone.",
  },

  // ── "More money" feature grid ────────────────────────────────────────────
  { source: "More money", translated: "Mais dinheiro" },
  { source: "More money in your pocket", translated: "Mais dinheiro no seu bolso" },
  { source: "Where the extra money actually comes from.", translated: "De onde vem o dinheiro extra." },
  { source: "Your own website", translated: "Seu próprio site" },
  {
    source: "It takes bookings and the clients stay yours, not a marketplace's.",
    translated: "Ele recebe agendamentos e os clientes ficam seus, não de uma plataforma de terceiros.",
  },
  { source: "Ads that bring people in", translated: "Anúncios que trazem gente nova" },
  {
    source: "Google and Instagram ads that fill your calendar with new clients.",
    translated: "Anúncios no Google e no Instagram que enchem sua agenda com clientes novos.",
  },

  // ── "More time" feature grid ─────────────────────────────────────────────
  { source: "More time", translated: "Mais tempo" },
  { source: "More time in your day", translated: "Mais tempo no seu dia" },
  { source: "Where the extra time in your day comes from.", translated: "De onde vem o tempo extra no seu dia." },
  { source: "Calls and texts get answered", translated: "Ligações e mensagens são atendidas" },
  {
    source: "An AI answers calls and texts any time of day and books the appointment.",
    translated: "Uma IA atende ligações e mensagens a qualquer hora do dia e agenda o horário.",
  },
  { source: "Fewer no-shows", translated: "Menos faltas" },
  {
    source: "Reminders go out on their own and cut down on no-shows.",
    translated: "Os lembretes são enviados automaticamente e reduzem as faltas.",
  },
  { source: "Social media", translated: "Redes sociais" },
  {
    source: "Posts get made and scheduled for you every week.",
    translated: "As postagens são feitas e agendadas para você toda semana.",
  },

  // ── "NFC for your shop" feature grid ─────────────────────────────────────
  { source: "NFC for your shop", translated: "NFC para a sua barbearia" },
  { source: "For your counter", translated: "Para o seu balcão" },
  {
    source: "Three things we 3D print for barbershops, made to order.",
    translated: "Três itens que imprimimos em 3D para barbearias, feitos sob encomenda.",
  },
  { source: "Review plaque", translated: "Placa de avaliação" },
  {
    source: "A plaque for your counter. Tap a phone on it and it opens your Google review page.",
    translated: "Uma placa para o seu balcão. O cliente encosta o celular e ela abre a página de avaliação no Google.",
  },
  { source: "Custom keychains", translated: "Chaveiros personalizados" },
  {
    source: "NFC keychains with your barbershop's own branding. The tap opens the link you choose.",
    translated: "Chaveiros NFC com a marca da sua barbearia. O toque abre o link que você escolher.",
  },
  { source: "Keychain display", translated: "Display de chaveiros" },
  {
    source: "A display for your counter so you can sell the keychains yourself. Extra money for the shop.",
    translated: "Um display para o balcão para você mesmo vender os chaveiros. Uma renda extra para a barbearia.",
  },

  // ── Pricing block (copied from the live catalog — see seed-barbershop-landing.ts).
  // Only the strings the page still shows after the review's "remove the
  // three-item bullet lists" note: the Xkedule/Xsites/Xareable feature tags
  // (Calendar Sync, Reminders, Responsive, Analytics, ...) were cut from the
  // page along with their bullets and are deliberately NOT seeded here. ───
  { source: "Pricing", translated: "Preços" },
  { source: "What you can get", translated: "O que você pode ter" },
  { source: "Same prices we charge everyone.", translated: "Os mesmos preços que cobramos de todo mundo." },

  { source: "Xkedule: $89 a month", translated: "Xkedule: US$ 89 por mês" },
  { source: "Your site that books for you.", translated: "Seu site que agenda para você." },
  {
    source: "A booking page with AI that answers messages and calls. It books the appointment when the customer is ready.",
    translated: "Uma página de agendamento com IA que responde mensagens e ligações. Ela agenda o horário quando o cliente está pronto.",
  },

  { source: "Xsites: $299 starting", translated: "Xsites: a partir de US$ 299" },
  { source: "A professional website for your shop.", translated: "Um site profissional para a sua barbearia." },
  {
    source: "A clean site built for service businesses. Start with the essentials and add pages and features as you grow.",
    translated: "Um site limpo, feito para negócios de serviço. Comece com o essencial e vá adicionando páginas e recursos conforme cresce.",
  },

  { source: "Xareable: $49 a month", translated: "Xareable: US$ 49 por mês" },
  { source: "We post for you.", translated: "A gente posta para você." },
  {
    source: "Create and publish posts with AI from one place. Post by hand or put it on a schedule and stay active every week.",
    translated: "Crie e publique posts com IA em um só lugar. Publique na hora ou deixe agendado e fique ativo toda semana.",
  },

  { source: "Ads that fill the calendar: talk to us", translated: "Anúncios que enchem a agenda: fale com a gente" },
  {
    source: "Google Ads, Facebook and Instagram Ads, TikTok Ads, retargeting campaigns, and campaign optimization.",
    translated: "Google Ads, anúncios no Facebook e Instagram, anúncios no TikTok, campanhas de retargeting e otimização de campanha.",
  },
  // The bullets that used to repeat these same four terms ("Google Ads",
  // "Meta & TikTok Ads", "Retargeting campaigns", "Campaign optimization")
  // were removed from the page (the paragraph above already says all of
  // it) — dropped here too, same reasoning as the other dead rows above.

  // ── Reviews section (props.title/subtitle — see seed-barbershop-landing.ts
  // for why these are no longer left as `props: {}`) ──────────────────────
  { source: "What people say", translated: "O que as pessoas dizem" },
  {
    source: "Real reviews from businesses we've worked with.",
    translated: "Avaliações reais de negócios com quem já trabalhamos.",
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

async function main(apply: boolean) {
  console.log(
    apply
      ? `Writing ${PT_TRANSLATIONS.length} ${SOURCE_LANGUAGE} → ${TARGET_LANGUAGE} translations...`
      : `DRY RUN: would write ${PT_TRANSLATIONS.length} ${SOURCE_LANGUAGE} → ${TARGET_LANGUAGE} translations. Re-run with --apply to write.`,
  );

  // Snapshot the existing rows (source_text + current translated_text) so a
  // dry run can report inserted/updated/unchanged without writing anything.
  const existingRows = await db
    .select({ sourceText: translations.sourceText, translatedText: translations.translatedText })
    .from(translations)
    .where(
      and(
        eq(translations.sourceLanguage, SOURCE_LANGUAGE),
        eq(translations.targetLanguage, TARGET_LANGUAGE),
      ),
    );
  const existing = new Map(existingRows.map((row) => [row.sourceText, row.translatedText]));

  const canUpsert = apply ? await hasUniqueTranslationIndex() : false;
  if (apply) {
    console.log(
      canUpsert
        ? "  Unique index present - using ON CONFLICT DO UPDATE."
        : "  Unique index absent - falling back to explicit update-or-insert.",
    );
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const pair of PT_TRANSLATIONS) {
    const previous = existing.get(pair.source);
    const isNew = previous === undefined;
    const isUnchanged = !isNew && previous === pair.translated;

    if (!apply) {
      if (isNew) console.log(`  [would insert] "${pair.source}"`);
      else if (!isUnchanged) console.log(`  [would update] "${pair.source}": "${previous}" -> "${pair.translated}"`);
      if (isNew) inserted++;
      else if (isUnchanged) unchanged++;
      else updated++;
      continue;
    }

    if (isUnchanged) {
      unchanged++;
      continue;
    }

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

    if (isNew) inserted++;
    else updated++;
  }

  console.log(
    `${apply ? "Done" : "Dry run complete"}. ${PT_TRANSLATIONS.length} rows - ${inserted} ${apply ? "inserted" : "to insert"}, ${updated} ${apply ? "updated" : "to update"}, ${unchanged} unchanged.`,
  );
  await pool.end();
}

main(parseSeedArgs().apply).catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
