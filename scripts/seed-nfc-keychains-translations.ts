// Seed hand-written pt-BR translations for the NFC keychain PT pages
// (/chaveiros-nfc landing and /precos-chaveiros pricing explainer).
// Idempotent: re-running updates every row in place (no duplicates, same ids).
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-keychains-translations.ts
//
// Touches ONLY the `translations` table, and only rows matching
// (source_language = 'en', target_language = 'pt'). The `forms` and `pages`
// rows seeded by scripts/seed-nfc-keychains-landing.ts are never read or
// written.
//
// Why hand-seed instead of letting the AI translator fill the cache:
//   t() consults the `translations` table BEFORE calling POST /api/translate.
//   A cached row is therefore authoritative and keeps winning even after the
//   provider is fixed, so this hand-written marketing copy is what ships.
//   (Verified 2026-09-06: POST /api/translate answers 200 but fills nothing,
//   so without these rows the PT pages render the English source.)
//
// NOTE: the form slug `nfc-keychain-leads` is deliberately EXCLUDED from this
// list. It is the `formSlug` prop on the `leadFormCta` section — a lookup key,
// not display text — and must never be translated. Likewise the `icons` names
// on the `processStepper` section and the `kind` enum on `pricingTable` lines
// are never passed through t().
//
// Strings shared with scripts/seed-barbershop-translations.ts ("What's your
// name?", "Other", "Optional", ...) are repeated here with IDENTICAL target
// text so the two seeds converge on the same row instead of fighting.
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
//   the missing index is deliberately OUT OF SCOPE here.
import "dotenv/config";
import { pool, db } from "../server/db.js";
import { translations } from "../shared/schema/cms.js";
import { and, eq } from "drizzle-orm";

// ── Config ────────────────────────────────────────────────────────────────

const SOURCE_LANGUAGE = "en";
const TARGET_LANGUAGE = "pt";

// ── Translation pairs (English source → hand-written pt-BR) ────────────────
//
// Every display string on /chaveiros-nfc and /precos-chaveiros: the 11
// `nfc-keychain-leads` question titles, every select option label, every
// placeholder, the shared processStepper copy, the landing hero + CTA, and the
// explainer's contentBlocks / pricingTable / faqAccordion / CTA copy.
//
// Strings reused across sections ("How it works", "Minimum order") appear
// exactly ONCE — the unique index keys on the source string, so one row covers
// every occurrence.
//
// Pricing facts in the PT copy match the EN source exactly: US$ 10 por peça,
// pedido mínimo de 20 peças (US$ 200), taxa de arte de US$ 50 só no primeiro
// pedido, pagamento 100% antecipado. No turnaround time is stated.

const PT_TRANSLATIONS: Array<{ source: string; translated: string }> = [
  // ── Contact questions ───────────────────────────────────────────────────
  { source: "What's your name?", translated: "Qual é o seu nome?" },
  { source: "Your full name", translated: "Seu nome completo" },
  { source: "What's your WhatsApp?", translated: "Qual é o seu WhatsApp?" },

  // Identity rows (this one and "Instagram" below) are DELIBERATE no-op
  // translations: source and target are identical. Without a cached row, t()
  // treats every render as a cache miss and re-queries the AI provider on
  // every page load for a string that needs no translation. Seeding an
  // identity row short-circuits that lookup permanently.
  { source: "(555) 123-4567", translated: "(555) 123-4567" },

  { source: "What's your email?", translated: "Qual é o seu e-mail?" },
  { source: "you@yourbusiness.com", translated: "voce@suaempresa.com" },

  // ── Business profile ────────────────────────────────────────────────────
  { source: "What's the name of your business?", translated: "Qual é o nome da sua empresa?" },
  { source: "Your business name", translated: "O nome da sua empresa" },
  { source: "What type of business do you have?", translated: "Qual é o tipo do seu negócio?" },
  { source: "Restaurant / food", translated: "Restaurante / alimentação" },
  { source: "Beauty salon / barbershop", translated: "Salão de beleza / barbearia" },
  { source: "Cleaning / home services", translated: "Limpeza / serviços residenciais" },
  { source: "Auto services", translated: "Serviços automotivos" },
  { source: "Retail / store", translated: "Varejo / loja" },
  { source: "Health / fitness", translated: "Saúde / fitness" },
  { source: "Other", translated: "Outro" },

  // ── Quantity (anchored on the 20-piece minimum) ─────────────────────────
  { source: "How many keychains do you need?", translated: "Quantos chaveiros você precisa?" },
  { source: "20 pieces (minimum order)", translated: "20 peças (pedido mínimo)" },
  { source: "21-50 pieces", translated: "21 a 50 peças" },
  { source: "51-100 pieces", translated: "51 a 100 peças" },
  { source: "100+ pieces", translated: "Mais de 100 peças" },
  { source: "Not sure yet", translated: "Ainda não sei" },

  // ── What the tap opens ──────────────────────────────────────────────────
  { source: "What should the tap open?", translated: "O que o toque deve abrir?" },
  { source: "Google review page", translated: "Página de avaliações do Google" },
  { source: "Instagram", translated: "Instagram" },
  { source: "Digital business card (vCard)", translated: "Cartão de visita digital (vCard)" },
  { source: "Menu", translated: "Cardápio" },
  { source: "Website", translated: "Site" },
  { source: "More than one of these", translated: "Mais de uma dessas opções" },

  // ── Logo (signals the first-order art fee) ──────────────────────────────
  { source: "Do you have a logo?", translated: "Você tem uma logo?" },
  { source: "Yes, I have my logo in a file", translated: "Sim, tenho o arquivo da minha logo" },
  { source: "I have a logo but not the file", translated: "Tenho uma logo, mas não tenho o arquivo" },
  { source: "No, I need one created", translated: "Não, preciso criar uma" },

  // ── Urgency (no SLA promised) ───────────────────────────────────────────
  { source: "When do you want them?", translated: "Para quando você precisa?" },
  { source: "As soon as possible", translated: "O mais rápido possível" },
  { source: "Within this month", translated: "Ainda este mês" },
  { source: "Next month", translated: "No mês que vem" },
  { source: "Just researching for now", translated: "Só pesquisando por enquanto" },

  // ── Meeting format (tipoVisita — the Xphere booking hook point) ──────────
  { source: "How would you like to talk to us?", translated: "Como você prefere falar com a gente?" },
  { source: "In-person visit at my business", translated: "Visita presencial na minha empresa" },
  { source: "Online meeting (video call)", translated: "Reunião online (chamada de vídeo)" },
  { source: "WhatsApp only", translated: "Só pelo WhatsApp" },

  // ── Free-form ───────────────────────────────────────────────────────────
  { source: "Anything else we should know?", translated: "Mais alguma coisa que a gente deva saber?" },
  { source: "Optional", translated: "Opcional" },

  // ── processStepper (shared by landing + pricing page) ───────────────────
  { source: "How it works", translated: "Como funciona" },
  { source: "From first message to tapping in 4 steps", translated: "Da primeira mensagem ao primeiro toque em 4 passos" },
  {
    source: "A simple process with no surprises. You approve every step before we move on.",
    translated: "Um processo simples, sem surpresas. Você aprova cada etapa antes de a gente seguir.",
  },
  { source: "Talk to us", translated: "Fale com a gente" },
  {
    source: "Tell us what the tap should open and how many keychains you need. We confirm the details with you on WhatsApp.",
    translated: "Conte o que o toque deve abrir e quantos chaveiros você precisa. A gente confirma os detalhes com você pelo WhatsApp.",
  },
  { source: "We design your art", translated: "Criamos a sua arte" },
  {
    source: "Send us your logo file, or we create the artwork for you. You approve the design before anything is produced.",
    translated: "Envie o arquivo da sua logo, ou a gente cria a arte para você. Você aprova o design antes de qualquer coisa ser produzida.",
  },
  { source: "We print and program", translated: "Imprimimos e programamos" },
  {
    source: "Each keychain is 3D-printed with your design, and the NFC tag inside is programmed with your link and tested.",
    translated: "Cada chaveiro é impresso em 3D com o seu design, e a tag NFC interna é programada com o seu link e testada.",
  },
  { source: "You receive and start tapping", translated: "Você recebe e começa a usar" },
  {
    source: "Your keychains arrive ready to use. Hand them out, put one on the counter, and watch the taps come in.",
    translated: "Seus chaveiros chegam prontos para usar. Distribua, deixe um no balcão e veja os toques chegarem.",
  },

  // ── Landing hero + CTA ──────────────────────────────────────────────────
  {
    source: "One tap. Your customers land exactly where you want them.",
    translated: "Um toque. Seus clientes vão exatamente para onde você quer.",
  },
  {
    source: "Custom 3D-printed NFC keychains with your logo. A customer taps their phone and opens your Google review page, Instagram, digital business card, menu, or website. No app needed.",
    translated: "Chaveiros NFC personalizados, impressos em 3D com a sua logo. O cliente encosta o celular e abre a sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site. Sem precisar de aplicativo.",
  },
  { source: "I want my keychains", translated: "Quero meus chaveiros" },
  { source: "Ready to get your keychains?", translated: "Pronto para ter os seus chaveiros?" },
  {
    source: "Tell us about your business in 1 minute and we will get back to you on WhatsApp.",
    translated: "Conte sobre a sua empresa em 1 minuto e a gente retorna pelo WhatsApp.",
  },

  // ── Pricing page: contentBlocks ─────────────────────────────────────────
  { source: "NFC keychains, explained", translated: "Chaveiros NFC, explicados" },
  {
    source: "What they are, where they work, and what you need to get started.",
    translated: "O que são, onde funcionam e o que você precisa para começar.",
  },
  { source: "What is an NFC keychain?", translated: "O que é um chaveiro NFC?" },
  {
    source: "An NFC keychain is a small 3D-printed keychain with your logo on the outside and a tiny NFC tag inside. When a customer touches the back of their phone to it, the phone opens a link you choose. No app to download, nothing to type.",
    translated: "Um chaveiro NFC é um chaveiro pequeno, impresso em 3D, com a sua logo por fora e uma tag NFC minúscula por dentro. Quando o cliente encosta a parte de trás do celular nele, o celular abre um link escolhido por você. Sem aplicativo para baixar, sem nada para digitar.",
  },
  {
    source: "Modern iPhones and Android phones read NFC tags natively — it is the same technology behind tap-to-pay. You pick what the tap opens:",
    translated: "iPhones e Androids modernos leem tags NFC nativamente — é a mesma tecnologia do pagamento por aproximação. Você escolhe o que o toque abre:",
  },
  {
    source: "Google review page — collect more reviews right at the counter",
    translated: "Página de avaliações do Google — colete mais avaliações direto no balcão",
  },
  { source: "Instagram — new followers in one tap", translated: "Instagram — novos seguidores em um toque" },
  {
    source: "Digital business card (vCard) — your contact saved straight to their phone",
    translated: "Cartão de visita digital (vCard) — seu contato salvo direto no celular do cliente",
  },
  {
    source: "Menu — no more printed menus going out of date",
    translated: "Cardápio — chega de cardápio impresso desatualizado",
  },
  {
    source: "Website — send people directly to your booking or store page",
    translated: "Site — leve as pessoas direto para a sua página de agendamento ou loja",
  },
  { source: "Where businesses use it", translated: "Onde as empresas usam" },
  {
    source: "The keychain works anywhere your customers are within arm's reach of it. Put one at every point of contact:",
    translated: "O chaveiro funciona em qualquer lugar onde o cliente consiga alcançá-lo. Coloque um em cada ponto de contato:",
  },
  { source: "On the counter next to the register", translated: "No balcão, ao lado do caixa" },
  { source: "At the reception desk or in the waiting area", translated: "Na recepção ou na sala de espera" },
  {
    source: "Inside your car or truck if you offer mobile services",
    translated: "Dentro do seu carro ou caminhonete, se você atende a domicílio",
  },
  {
    source: "On your own keyring, so you always have one to hand out",
    translated: "No seu próprio molho de chaves, para sempre ter um à mão",
  },
  {
    source: "On a table tent in a restaurant, salon, or barbershop",
    translated: "Em um display de mesa em restaurante, salão ou barbearia",
  },
  { source: "What you get and what we need from you", translated: "O que você recebe e o que precisamos de você" },
  {
    source: "Every order includes the 3D-printed keychains with your design, the NFC tag inside each one programmed with your link, and a test of every piece before it ships.",
    translated: "Todo pedido inclui os chaveiros impressos em 3D com o seu design, a tag NFC dentro de cada um programada com o seu link e o teste de cada peça antes do envio.",
  },
  {
    source: "To get started, we need your logo as a file (PNG, SVG, or PDF) and the link you want the tap to open. If you do not have a logo file, we create the artwork for you — that is what the first-order art fee covers.",
    translated: "Para começar, precisamos da sua logo em arquivo (PNG, SVG ou PDF) e do link que o toque deve abrir. Se você não tem o arquivo da logo, a gente cria a arte para você — é isso que a taxa de arte do primeiro pedido cobre.",
  },

  // ── Pricing page: pricingTable ──────────────────────────────────────────
  { source: "Pricing", translated: "Preços" },
  { source: "Simple, upfront pricing", translated: "Preço simples e transparente" },
  {
    source: "No hidden fees. You know the total before we start.",
    translated: "Sem taxas escondidas. Você sabe o total antes de a gente começar.",
  },
  { source: "Per keychain", translated: "Por chaveiro" },
  // "Minimum order" is both a line label and the `minimum` kind badge — one row covers both.
  { source: "Minimum order", translated: "Pedido mínimo" },
  { source: "20 pieces × $10", translated: "20 peças × US$ 10" },
  { source: "Art / design fee", translated: "Taxa de arte / design" },
  {
    source: "First order only — waived from your second order onward",
    translated: "Só no primeiro pedido — a partir do segundo, não é cobrada",
  },
  {
    source: "100% payment upfront. Production starts after payment clears.",
    translated: "Pagamento 100% antecipado. A produção começa após a confirmação do pagamento.",
  },
  // Kind badges rendered by PricingTableSection KIND_LABELS. "One-time" is NOT
  // listed here: production already carries a cached row for it ("Única"),
  // shared with other pages, and this seed must not override it.
  { source: "Per unit", translated: "Por unidade" },

  // ── Pricing page: faqAccordion ──────────────────────────────────────────
  { source: "FAQ", translated: "Perguntas frequentes" },
  { source: "Questions people ask before ordering", translated: "Perguntas que as pessoas fazem antes de pedir" },
  {
    source: "Everything you need to decide, without waiting for a reply.",
    translated: "Tudo o que você precisa para decidir, sem esperar resposta.",
  },
  { source: "What exactly is an NFC keychain?", translated: "O que é exatamente um chaveiro NFC?" },
  {
    source: "A 3D-printed keychain with your logo and a small NFC tag inside. When a customer taps their phone on it, the phone opens the link you chose: your Google review page, Instagram, digital business card, menu, or website.",
    translated: "Um chaveiro impresso em 3D com a sua logo e uma pequena tag NFC por dentro. Quando o cliente encosta o celular nele, o celular abre o link que você escolheu: sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site.",
  },
  { source: "Do my customers need to install an app?", translated: "Meus clientes precisam instalar algum aplicativo?" },
  {
    source: "No. Modern iPhones and Android phones read NFC tags natively, the same way they handle tap-to-pay. The customer just holds the phone close to the keychain and a notification opens the link.",
    translated: "Não. iPhones e Androids modernos leem tags NFC nativamente, do mesmo jeito que fazem o pagamento por aproximação. O cliente só aproxima o celular do chaveiro e uma notificação abre o link.",
  },
  { source: "Why is there a minimum order?", translated: "Por que existe um pedido mínimo?" },
  {
    source: "Each order is set up, designed, printed, and programmed as a batch, so very small runs do not make sense for either side. The minimum is 20 pieces, which is $200 at $10 per keychain. Twenty pieces is enough to put one at every point of contact and hand some out to your team.",
    translated: "Cada pedido é configurado, desenhado, impresso e programado em lote, então tiragens muito pequenas não fazem sentido para nenhum dos lados. O mínimo é de 20 peças, o que dá US$ 200 a US$ 10 por chaveiro. Vinte peças são suficientes para colocar um em cada ponto de contato e ainda distribuir para a sua equipe.",
  },
  { source: "What is the $50 art fee, and when is it waived?", translated: "O que é a taxa de arte de US$ 50, e quando ela não é cobrada?" },
  {
    source: "The $50 art / design fee covers preparing your logo for 3D printing and creating the artwork if you do not have a file yet. It is charged once, on your first order only. From your second order onward it is waived, because the artwork is already done.",
    translated: "A taxa de arte / design de US$ 50 cobre a preparação da sua logo para impressão 3D e a criação da arte, caso você ainda não tenha o arquivo. Ela é cobrada uma única vez, só no seu primeiro pedido. A partir do segundo pedido ela não é cobrada, porque a arte já está pronta.",
  },
  { source: "Can I change the link later?", translated: "Posso mudar o link depois?" },
  {
    source: "Yes. We recommend pointing the tag to a link you control, like a short link or a page on your website, so you can redirect it whenever you want without touching the keychain. If you need the tag itself reprogrammed, message us and we will walk you through the options.",
    translated: "Sim. Recomendamos apontar a tag para um link que você controla, como um link curto ou uma página do seu site, para você redirecionar quando quiser sem mexer no chaveiro. Se precisar reprogramar a tag em si, é só mandar mensagem que a gente explica as opções.",
  },
  { source: "Why is payment 100% upfront?", translated: "Por que o pagamento é 100% antecipado?" },
  {
    source: "Every order is custom-made with your logo, so it cannot be resold or reused for another business. Paying in full before production covers the materials and the work, and it lets us start right away. You still approve the design before anything is printed.",
    translated: "Todo pedido é feito sob medida com a sua logo, então não pode ser revendido nem reaproveitado para outra empresa. Pagar integralmente antes da produção cobre os materiais e o trabalho, e permite que a gente comece na hora. Você continua aprovando o design antes de qualquer coisa ser impressa.",
  },
  // Deliberate omission preserved: no turnaround number in either language.
  { source: "How long does it take?", translated: "Quanto tempo leva?" },
  {
    source: "Production starts as soon as your payment clears and the artwork is approved. The exact production and delivery window is confirmed in writing when your order is approved, so you know what to expect before you commit.",
    translated: "A produção começa assim que o seu pagamento é confirmado e a arte é aprovada. O prazo exato de produção e entrega é confirmado por escrito na aprovação do pedido, para você saber o que esperar antes de fechar.",
  },
  { source: "What if I do not have a logo?", translated: "E se eu não tiver uma logo?" },
  {
    // The quoted option label inside must match the `jaTemLogo` option text
    // and its PT translation above ("Não, preciso criar uma") exactly.
    source: "That is fine. Choose \"No, I need one created\" in the form and we create the artwork for you as part of the first-order art fee. If you have a logo but not the file, we can usually work from a clear photo or a screenshot of it.",
    translated: "Sem problema. Escolha \"Não, preciso criar uma\" no formulário e a gente cria a arte para você como parte da taxa de arte do primeiro pedido. Se você tem uma logo mas não tem o arquivo, geralmente conseguimos trabalhar a partir de uma foto nítida ou de um print dela.",
  },

  // ── Pricing page: CTA ───────────────────────────────────────────────────
  { source: "Ready to order?", translated: "Pronto para pedir?" },
  {
    source: "Fill out the form and we will confirm your quantity, artwork, and total with you on WhatsApp.",
    translated: "Preencha o formulário e a gente confirma a quantidade, a arte e o total com você pelo WhatsApp.",
  },
  { source: "I want to order", translated: "Quero pedir" },
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
