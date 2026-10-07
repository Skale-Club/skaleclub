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
// tokens (brand names, prices) where translating to itself or to the US$
// convention cannot break anything.
// 2026-10-07: the pricing block now does seed a few short tokens ("$89", "$299",
// "$49" -> "US$ n", "/month" -> "/mês", "Website", "Starting price",
// "Questions", and the brand names Xkedule/Xsites/Xareable as identity rows).
// They are the same on every page of the live site, so a shared row is
// consistent with it. Generic feature tags that used to live here (Reminders,
// Calendar Sync, Responsive, SEO Optimized, Analytics, ...) stay out; see
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
// Every display string on /barbershops-br: the 7 `barbershop-leads` question
// titles, every select option label, every placeholder, plus the copy of every
// landing section (hero, problem grid, how it works, photo cards, pricing, NFC
// link, reviews, FAQ, closing form). Pairs for the five questions dropped on
// 2026-10-07 (barbers, booking system, average ticket, ad budget, notes) are no
// longer seeded; rows already in the table are left alone.
//
// Strings reused across questions (`2-3`, `4-6`, `Other`) appear exactly
// ONCE: the unique index keys on the source string, so one row covers every
// occurrence.
//
// The same landing pairs live in scripts/data/landing-pt-copy.ts (that file is
// what seedPage() bakes into the `-br` row). Keep both in step. Do NOT add
// formSlug, processStepper icon names, enum values or URLs here.

const PT_TRANSLATIONS: Array<{ source: string; translated: string }> = [
  // ── Contact questions ───────────────────────────────────────────────────
  { source: "What's your name?", translated: "Qual é o seu nome?" },
  { source: "Your full name", translated: "Seu nome completo" },
  { source: "What's your WhatsApp?", translated: "Qual é o seu WhatsApp?" },

  // Identity rows (this one, plus `1`, `2-3`, `4-6`, `7+` below, and the brand
  // names Xkedule/Xsites/Xareable in the pricing block) are
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

  { source: "Other", translated: "Outro" },

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

  // ── Landing copy (2026-10-07 rewrite: dark hero, problem grid, how-it-works,
  // photo cards, pricing, NFC link, reviews, FAQ, closing form). Same pairs as
  // scripts/data/landing-pt-copy.ts; keep the two files in step. ───────────
  // ── Hero
  { source: "For barbershops", translated: "Para barbearias" },
  { source: "Your phone gets answered while you cut.", translated: "Seu telefone é atendido enquanto você corta." },
  { source: "An AI picks up the call and books the cut. You keep working.", translated: "Uma IA atende a ligação e agenda o corte. Você continua trabalhando." },
  { source: "Barber chair in a barbershop with a Google review plaque on the counter", translated: "Cadeira de barbeiro em uma barbearia, com uma placa de avaliação do Google no balcão" },
  { source: "Get more clients", translated: "Quero mais clientes" },
  { source: "Hear it working: (224) 551-6131", translated: "Ouça funcionando: (224) 551-6131" },
  { source: "That line is answered by an AI set up as a barbershop. Ask it a price, then book a cut.", translated: "Esse número é atendido por uma IA configurada como barbearia. Pergunte um preço e depois agende um corte." },
  // ── The problem
  { source: "The problem", translated: "O problema" },
  { source: "Where a barbershop loses money", translated: "Onde uma barbearia perde dinheiro" },
  { source: "The phone rings mid-cut", translated: "O telefone toca no meio do corte" },
  { source: "You can't pick up with the clippers in your hand, so the client calls the next shop.", translated: "Você não consegue atender com a máquina na mão, então o cliente liga para a próxima barbearia." },
  { source: "No-shows", translated: "Faltas" },
  { source: "Someone books Saturday at 10 and never shows up. That chair earned nothing.", translated: "Alguém marca para sábado às 10h e não aparece. Aquela cadeira não rendeu nada." },
  { source: "Slow weekdays", translated: "Dias fracos na semana" },
  { source: "Friday is packed and Tuesday afternoon sits empty.", translated: "A sexta fica lotada e a terça à tarde fica vazia." },
  { source: "Clients who belong to the app", translated: "Clientes que pertencem ao aplicativo" },
  { source: "Book through a marketplace and your client sees every other shop nearby too.", translated: "Quando o cliente agenda por um aplicativo, ele também vê todas as outras barbearias da região." },
  // ── How it works (eyebrow "How it works" already exists for the keychain landing)
  { source: "What happens when a client calls", translated: "O que acontece quando um cliente liga" },
  { source: "Call (224) 551-6131 and try it.", translated: "Ligue para (224) 551-6131 e teste." },
  { source: "The client calls", translated: "O cliente liga" },
  { source: "At 9pm or in the middle of a fade, the call gets picked up.", translated: "Às 9 da noite ou no meio de um degradê, a ligação é atendida." },
  { source: "The AI answers", translated: "A IA atende" },
  { source: "It knows your prices and your hours.", translated: "Ela conhece os seus preços e os seus horários." },
  { source: "The cut gets booked", translated: "O corte é agendado" },
  { source: "The appointment goes straight into your calendar.", translated: "O horário vai direto para a sua agenda." },
  { source: "A reminder goes out", translated: "O lembrete é enviado" },
  { source: "The client gets a reminder before the visit, so fewer chairs sit empty.", translated: "O cliente recebe um lembrete antes da visita, e menos cadeiras ficam vazias." },
  // ── What you get
  { source: "What you get", translated: "O que você recebe" },
  { source: "What we set up for your shop", translated: "O que a gente configura para a sua barbearia" },
  { source: "A booking page for your shop", translated: "Uma página de agendamento para a sua barbearia" },
  { source: "Clients pick a time and book on a page with your shop's name.", translated: "O cliente escolhe um horário e agenda em uma página com o nome da sua barbearia." },
  { source: "Booking page built with Xkedule", translated: "Página de agendamento feita com o Xkedule" },
  { source: "Calls and texts answered", translated: "Ligações e mensagens atendidas" },
  { source: "The AI replies any time of day and books the appointment.", translated: "A IA responde a qualquer hora do dia e agenda o horário." },
  { source: "Xkedule dashboard listing recent appointments", translated: "Painel do Xkedule com a lista de agendamentos recentes" },
  { source: "Posts every week", translated: "Posts toda semana" },
  { source: "Make posts with AI and schedule them, so your Instagram doesn't go quiet.", translated: "Faça posts com IA e agende, para o seu Instagram não ficar parado." },
  { source: "Xareable home page", translated: "Página inicial do Xareable" },
  { source: "More Google reviews", translated: "Mais avaliações no Google" },
  { source: "A plaque on your counter. Clients tap their phone and land on your review page.", translated: "Uma placa no seu balcão. O cliente encosta o celular e cai na sua página de avaliação." },
  { source: "NFC Google review plaque on a counter", translated: "Placa NFC de avaliação do Google sobre um balcão" },
  // ── Pricing (prices are the live catalog; PT keeps the US$ convention). Brand names are identity rows.
  { source: "Pricing", translated: "Preços" },
  { source: "What it costs", translated: "Quanto custa" },
  { source: "Same prices we charge everyone. Start with one.", translated: "Os mesmos preços que cobramos de todo mundo. Comece por um." },
  { source: "Xkedule", translated: "Xkedule" },
  { source: "Booking and AI receptionist", translated: "Agendamento e recepcionista com IA" },
  { source: "$89", translated: "US$ 89" },
  { source: "/month", translated: "/mês" },
  { source: "Online booking with calendar sync", translated: "Agendamento online com sincronização de agenda" },
  { source: "Appointment reminders", translated: "Lembretes de agendamento" },
  { source: "Xsites", translated: "Xsites" },
  { source: "Website", translated: "Site" },
  { source: "$299", translated: "US$ 299" },
  { source: "Starting price", translated: "Preço inicial" },
  { source: "A professional site for your shop", translated: "Um site profissional para a sua barbearia" },
  { source: "Add pages as you grow", translated: "Adicione páginas conforme você cresce" },
  { source: "Xareable", translated: "Xareable" },
  { source: "Social posts", translated: "Posts para redes sociais" },
  { source: "$49", translated: "US$ 49" },
  { source: "Posts made with AI", translated: "Posts feitos com IA" },
  { source: "Post by hand or on a schedule", translated: "Poste na hora ou deixe agendado" },
  { source: "Google and Instagram ads are priced around your budget, so we quote them after we talk.", translated: "Os anúncios no Google e no Instagram são cobrados de acordo com o seu orçamento, então passamos o valor depois que conversarmos." },
  // ── NFC link
  { source: "We also make NFC keychains with your shop's logo.", translated: "A gente também faz chaveiros NFC com a logo da sua barbearia." },
  { source: "See the keychains", translated: "Ver os chaveiros" },
  // ── Reviews
  { source: "What clients say", translated: "O que os clientes dizem" },
  { source: "Reviews from businesses we've worked with.", translated: "Avaliações de negócios com quem já trabalhamos." },
  // ── FAQ
  { source: "Questions", translated: "Dúvidas" },
  { source: "Before you call", translated: "Antes de ligar" },
  { source: "Short answers before you call or fill out the form.", translated: "Respostas curtas antes de ligar ou preencher o formulário." },
  { source: "Do I have to buy everything?", translated: "Preciso comprar tudo?" },
  { source: "No. Each product has its own price and you can start with one.", translated: "Não. Cada produto tem o seu preço e você pode começar por um só." },
  { source: "Do the clients stay mine?", translated: "Os clientes continuam sendo meus?" },
  { source: "Yes. They book on your own page, not on a marketplace.", translated: "Sim. Eles agendam na sua própria página, e não em uma plataforma." },
  { source: "Can you come to my shop?", translated: "Vocês podem ir até a minha barbearia?" },
  { source: "You can ask for an in-person visit in the form, or pick a video call.", translated: "Você pode pedir uma visita presencial no formulário ou escolher uma chamada de vídeo." },
  { source: "How much do the ads cost?", translated: "Quanto custam os anúncios?" },
  { source: "It depends on how much you want to spend each month. We quote it after we talk about your shop.", translated: "Depende de quanto você quer investir por mês. Passamos o valor depois de conversar sobre a sua barbearia." },
  // ── Closing lead form
  { source: "Let's fill your chairs", translated: "Vamos encher suas cadeiras" },
  { source: "Tell us about your shop. It takes a minute.", translated: "Conte sobre a sua barbearia. Leva um minuto." },
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
