// Hand-written pt-BR for the NFC ORDER page (/br/nfc-order) and the
// `nfc-keychain-order` form, including the live-pricing widgets.
// Idempotent: re-running updates every row in place.
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-order-translations.ts
//
// TWO passes, same shape as scripts/seed-nfc-keychains-translations.ts:
//   1. en -> pt  Portuguese for the PT page and the form rendered on it
//   2. pt -> en  IDENTITY rows so the EN page is not "translated" into
//                Portuguese (t() assumes DB content is PT-authored)
// The write path for both lives in scripts/lib/seed-translations.ts.
//
// Why hand-seed: t() reads the `translations` table BEFORE calling
// POST /api/translate, so a cached row is authoritative and keeps winning. The
// AI route currently answers 200 without filling anything, so without these
// rows the PT page renders the English source.
//
// Strings already covered by seed-nfc-keychains-translations.ts ("What's your
// name?", "Instagram", "Optional", ...) are NOT repeated here: the unique index
// keys on the source string, so one row already serves both pages. Repeating
// them with different wording would make the two seeds fight.
//
// Slugs, `formSlug`, option `value`s, `icons` names and the `kind` enum never
// pass through t() and must never be translated.
//
// NOTE — the price-ladder rows at the end mirror what
// scripts/seed-nfc-order-page.ts GENERATES from shared/nfc-pricing.ts. Change
// the tiers and you must re-run both scripts, updating these rows to match the
// new labels, or the PT page falls back to the English ones.
import "dotenv/config";
import { pool } from "../server/db.js";
import { seedEnglishIdentityRows, upsertTranslations, type TranslationPair } from "./lib/seed-translations.js";

const PT_TRANSLATIONS: TranslationPair[] = [
  // ── Order form: questions new to this form ──────────────────────────────
  { source: "Have you ordered from us before?", translated: "Você já fez algum pedido conosco?" },
  { source: "Yes, I'm already a customer", translated: "Sim, já sou cliente" },
  { source: "No, this is my first order", translated: "Não, é o meu primeiro pedido" },
  { source: "I'm not sure", translated: "Não tenho certeza" },
  { source: "Which keychain do you want?", translated: "Qual chaveiro você quer?" },
  { source: "How many do you need?", translated: "Quantos você precisa?" },
  { source: "Send us your logo", translated: "Envie a sua logo" },
  {
    source:
      "First order includes a one-time $50 art fee to prepare your logo for 3D printing. It is waived from your second order onward.",
    translated:
      "O primeiro pedido inclui uma taxa única de US$ 50 de arte para preparar a sua logo para impressão 3D. A partir do segundo pedido ela não é cobrada.",
  },
  { source: "Where should we ship them?", translated: "Para onde devemos enviar?" },
  { source: "Street, number, city, state and ZIP code", translated: "Rua, número, cidade, estado e CEP" },

  // ── Keychain catalogue (shared/nfc-pricing.ts) ──────────────────────────
  // Placeholder catalogue: revisit when the real types are defined.
  { source: "Standard", translated: "Padrão" },
  { source: "3D-printed in a single color with your logo.", translated: "Impresso em 3D numa cor só com a sua logo." },

  // ── Live price panel and quantity slider ────────────────────────────────
  { source: "Estimated total", translated: "Total estimado" },
  { source: "pieces", translated: "peças" },
  { source: "piece", translated: "peça" },
  { source: "from", translated: "a partir de" },
  { source: "Art fee (first order only)", translated: "Taxa de arte (só no primeiro pedido)" },
  { source: "Take", translated: "Leve" },
  { source: "for the same price", translated: "pelo mesmo preço" },
  {
    source: "Estimate only — we confirm the final total with you before anything is produced.",
    translated: "Apenas uma estimativa — confirmamos o total final com você antes de produzir qualquer coisa.",
  },
  { source: "Quantity", translated: "Quantidade" },
  { source: "Fewer pieces", translated: "Menos peças" },
  { source: "More pieces", translated: "Mais peças" },

  // ── File upload ─────────────────────────────────────────────────────────
  { source: "Choose a file", translated: "Escolher arquivo" },
  { source: "Accepted formats", translated: "Formatos aceitos" },
  { source: "Maximum file size", translated: "Tamanho máximo do arquivo" },
  { source: "up to", translated: "até" },
  { source: "Uploading...", translated: "Enviando..." },
  { source: "File uploaded", translated: "Arquivo enviado" },
  { source: "Remove file", translated: "Remover arquivo" },
  { source: "Could not upload the file. Please try again.", translated: "Não foi possível enviar o arquivo. Tente novamente." },
  { source: "Please upload a file", translated: "Envie um arquivo" },

  // ── Page: hero ──────────────────────────────────────────────────────────
  { source: "Order your NFC keychains", translated: "Peça os seus chaveiros NFC" },
  {
    source:
      "Choose how many you need, send us your logo, and we confirm every detail with you before anything is produced.",
    translated:
      "Escolha quantos você precisa, envie a sua logo e confirmamos cada detalhe com você antes de produzir qualquer coisa.",
  },
  { source: "Start my order", translated: "Fazer meu pedido" },
  { source: "See how they work", translated: "Veja como funcionam" },

  // ── Page: pricing ───────────────────────────────────────────────────────
  { source: "Pricing", translated: "Preços" },
  { source: "The more you order, the less each one costs", translated: "Quanto mais você pede, menos custa cada um" },
  { source: "The form adds this up for you as you choose the quantity.", translated: "O formulário calcula isso para você conforme escolhe a quantidade." },
  {
    source: "100% payment upfront, after we confirm your order. Production starts once payment clears.",
    translated: "Pagamento 100% antecipado, depois que confirmarmos o seu pedido. A produção começa quando o pagamento é compensado.",
  },

  // ── Page: process stepper ───────────────────────────────────────────────
  { source: "What happens next", translated: "O que acontece depois" },
  { source: "From your order to keychains in hand", translated: "Do seu pedido aos chaveiros na mão" },
  {
    source: "Sending the form does not charge you anything. You approve every step before we move on.",
    translated: "Enviar o formulário não cobra nada de você. Você aprova cada etapa antes de seguirmos.",
  },
  { source: "You send the order", translated: "Você envia o pedido" },
  {
    source:
      "Quantity, what the tap should open, your logo and where to ship. It takes about a minute, and you can stop and come back — your answers are saved.",
    translated:
      "Quantidade, o que o toque deve abrir, a sua logo e para onde enviar. Leva cerca de um minuto, e você pode parar e voltar depois — as respostas ficam salvas.",
  },
  { source: "We call you", translated: "Nós ligamos para você" },
  {
    source:
      "We review whether we can produce what you asked for and call you on WhatsApp to confirm the quantity, the artwork and the final total.",
    translated:
      "Avaliamos se conseguimos produzir o que você pediu e ligamos no WhatsApp para confirmar a quantidade, a arte e o total final.",
  },
  { source: "You approve the art", translated: "Você aprova a arte" },
  {
    source:
      "We prepare your logo for 3D printing and send you the design. Nothing goes into production until you say yes.",
    translated:
      "Preparamos a sua logo para impressão 3D e enviamos o desenho. Nada vai para produção até você dizer sim.",
  },
  { source: "We produce and ship", translated: "Produzimos e enviamos" },
  {
    source:
      "Each keychain is printed with your design, the NFC tag inside is programmed with your link and tested, then shipped to your address.",
    translated:
      "Cada chaveiro é impresso com o seu desenho, a tag NFC de dentro é programada com o seu link e testada, e então enviamos para o seu endereço.",
  },

  // ── Page: what we need ──────────────────────────────────────────────────
  { source: "Before you start", translated: "Antes de começar" },
  { source: "What we need from you", translated: "O que precisamos de você" },
  { source: "Two things, and the form asks for both.", translated: "Duas coisas, e o formulário pede as duas." },
  { source: "Your logo", translated: "A sua logo" },
  {
    source: "Upload it as a PNG, JPG, WEBP or PDF. The sharper the file, the better the print comes out.",
    translated: "Envie em PNG, JPG, WEBP ou PDF. Quanto melhor a qualidade do arquivo, melhor sai a impressão.",
  },
  {
    source:
      "No logo file? Upload the best version you have — a clear photo or a screenshot usually works, and the first-order art fee covers preparing it for 3D printing. If you have no logo at all, we create the artwork for you.",
    translated:
      "Não tem o arquivo da logo? Envie a melhor versão que tiver — uma foto nítida ou um print normalmente resolve, e a taxa de arte do primeiro pedido cobre a preparação para impressão 3D. Se você não tem logo nenhuma, criamos a arte para você.",
  },
  { source: "The link the tap should open", translated: "O link que o toque deve abrir" },
  {
    source:
      "Your Google review page, Instagram, digital business card, menu or website. You pick it in the form, and we set it up with you on the call.",
    translated:
      "A sua página de avaliações do Google, Instagram, cartão de visita digital, cardápio ou site. Você escolhe no formulário e configuramos junto com você na ligação.",
  },
  {
    source: "Point the tag at a link you control, like a page on your own site",
    translated: "Aponte a tag para um link que você controla, como uma página do seu próprio site",
  },
  {
    source: "That way you can redirect it later without touching the keychains",
    translated: "Assim você pode redirecionar depois sem precisar mexer nos chaveiros",
  },

  // ── Page: FAQ ───────────────────────────────────────────────────────────
  { source: "What people ask before sending an order", translated: "O que as pessoas perguntam antes de enviar um pedido" },
  { source: "Short answers, so you can decide without waiting for a reply.", translated: "Respostas curtas, para você decidir sem esperar retorno." },
  { source: "Does sending this form place an order?", translated: "Enviar este formulário já fecha o pedido?" },
  {
    source:
      "No. It sends us an order request. We check that we can produce what you asked for and call you to confirm everything. Nothing is charged on this page.",
    translated:
      "Não. Ele envia uma solicitação de pedido. Verificamos se conseguimos produzir o que você pediu e ligamos para confirmar tudo. Nada é cobrado nesta página.",
  },
  { source: "Is the price I see here final?", translated: "O preço que aparece aqui é o final?" },
  {
    source:
      "It is an estimate built from the quantity and the type of keychain you picked. We confirm the final total with you before anything is produced, so there are no surprises.",
    translated:
      "É uma estimativa calculada a partir da quantidade e do tipo de chaveiro que você escolheu. Confirmamos o total final com você antes de produzir qualquer coisa, então não tem surpresa.",
  },
  { source: "When do I pay?", translated: "Quando eu pago?" },
  {
    source:
      "After we confirm your order on the call. Payment is 100% upfront, and production starts once it clears and you have approved the artwork.",
    translated:
      "Depois que confirmarmos o seu pedido na ligação. O pagamento é 100% antecipado, e a produção começa quando ele é compensado e você aprova a arte.",
  },
  { source: "Can I change the quantity after sending the form?", translated: "Posso mudar a quantidade depois de enviar o formulário?" },
  {
    source:
      "Yes, right up until you approve the artwork. Tell us on the call and we re-quote at the price for the new quantity.",
    translated:
      "Pode, até o momento em que você aprova a arte. É só falar na ligação que refazemos o orçamento com o preço da nova quantidade.",
  },
  { source: "Why is the minimum 20 pieces?", translated: "Por que o mínimo é 20 peças?" },
  {
    source:
      "Every order is set up, designed, printed and programmed as a batch, so a very small run does not make sense for either side. Twenty is enough to put one at every point of contact and still hand some out.",
    translated:
      "Cada pedido é configurado, desenhado, impresso e programado em lote, então uma tiragem muito pequena não faz sentido para nenhum dos lados. Vinte já dá para deixar um em cada ponto de contato e ainda distribuir alguns.",
  },

  // ── Page: closing CTA ───────────────────────────────────────────────────
  { source: "Ready to order?", translated: "Pronto para pedir?" },
  {
    source: "About a minute to fill in. We confirm everything with you on WhatsApp before producing anything.",
    translated: "Cerca de um minuto para preencher. Confirmamos tudo com você no WhatsApp antes de produzir qualquer coisa.",
  },

  // ── Thank-you page (order variant) ──────────────────────────────────────
  {
    source:
      "Your order request was received. We will review the quantity, artwork and shipping address, then call you on WhatsApp to confirm everything before production starts.",
    translated:
      "Recebemos a sua solicitação de pedido. Vamos revisar a quantidade, a arte e o endereço de entrega e ligar no WhatsApp para confirmar tudo antes de começar a produção.",
  },
  { source: "Keep your WhatsApp handy — we call to confirm before producing anything.", translated: "Deixe o WhatsApp à mão — ligamos para confirmar antes de produzir qualquer coisa." },
  { source: "We review your order and check the artwork you sent.", translated: "Revisamos o seu pedido e conferimos a arte que você enviou." },
  { source: "We call you on WhatsApp to confirm quantity, artwork and the final total.", translated: "Ligamos no WhatsApp para confirmar quantidade, arte e o total final." },
  { source: "After your approval and payment, production starts.", translated: "Depois da sua aprovação e do pagamento, a produção começa." },
  { source: "Review pricing and details", translated: "Ver preços e detalhes" },

  // ── Generated price ladder ──────────────────────────────────────────────
  // Mirrors what seed-nfc-order-page.ts derives from NFC_VOLUME_TIERS today
  // (20/50/100 at $10/$9/$8, max 200). Re-derive these rows whenever the
  // tiers change — see the note at the top of this file.
  { source: "20-49 pieces", translated: "20 a 49 peças" },
  { source: "50-99 pieces", translated: "50 a 99 peças" },
  { source: "100-200 pieces", translated: "100 a 200 peças" },
  { source: "$10.00 each", translated: "US$ 10,00 cada" },
  { source: "$9.00 each", translated: "US$ 9,00 cada" },
  { source: "$8.00 each", translated: "US$ 8,00 cada" },
  { source: "20 pieces", translated: "20 peças" },
  { source: "$200.00", translated: "US$ 200,00" },
  { source: "$50.00", translated: "US$ 50,00" },
  // "Minimum order", "Art / design fee" and the "Per unit" / "One-time" kind
  // badges are already seeded by seed-nfc-keychains-translations.ts for
  // /nfc-pricing. One row per source string serves both pages, so repeating
  // them here would only let the two seeds overwrite each other.
];

async function main() {
  console.log(`Seeding ${PT_TRANSLATIONS.length} en → pt rows for the NFC order page...`);
  const ptResult = await upsertTranslations(PT_TRANSLATIONS, { sourceLanguage: "en", targetLanguage: "pt" });
  console.log(`  ${ptResult.inserted} inserted, ${ptResult.updated} updated.`);

  const englishStrings = PT_TRANSLATIONS.map((pair) => pair.source);
  console.log(`Seeding ${new Set(englishStrings).size} pt → en identity rows (EN-page protection)...`);
  const enResult = await seedEnglishIdentityRows(englishStrings);
  console.log(`  ${enResult.inserted} inserted, ${enResult.updated} updated.`);
}

main()
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
