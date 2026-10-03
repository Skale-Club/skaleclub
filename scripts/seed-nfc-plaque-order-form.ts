// Seed the NFC counter plaque ORDER form (slug `nfc-plaque-order`).
// Idempotent: re-running updates the row in place (same id, same leads).
//
// DRY-RUN by default: prints a diff. Add --apply to write (the old row is
// snapshotted into content_revisions first; config runs validateFormConfig).
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-plaque-order-form.ts [--apply]
//
// Modelled on the keychain order form (scripts/seed-nfc-order-form.ts): same
// widgets, same server finalisation (server/lib/nfc-order.ts freezes the quote
// onto the lead and fires the `nfc_plaque_order` Telegram alert). No payment
// is taken: the team confirms on WhatsApp before producing anything.
//
// Differences from the keychain form, and why:
//   - No "have you ordered before?" step: plaques have no art fee (the custom
//     first-plaque price already covers the artwork).
//   - The logo is optional, and required only for the custom plaque
//     (`requiredWhen`): the standard plaques carry our ready-made design.
//   - "What should the tap open?" becomes the link itself (optional): the
//     operator needs it to set up the Xpot tag (standard) or the chip (custom).
//
// Pricing lives in shared/nfc-plaque-pricing.ts (models, 1..10 range, $49 /
// 2 for $79 standard, $89 + $49 custom) and is read at render time through
// shared/order-catalog.ts, so tuning price never means reseeding.
//
// Copy is authored in ENGLISH (the t() source language); the PT strings are in
// scripts/seed-nfc-plaque-order-translations.ts.
import "dotenv/config";
import { seedForm, withSeedGuard } from "./lib/seed-utils.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

const PLAQUE_ORDER_FORM_SLUG = "nfc-plaque-order";
const FORM_NAME = "NFC Plaque Order";
const FORM_DESCRIPTION =
  "Order request for NFC counter plaques: model, quantity, link, logo and shipping. Priced live, reviewed by the team before production.";

const TYPE_QUESTION_ID = "tipoPlaca";

const PLAQUE_ORDER_QUESTIONS: FormQuestion[] = [
  // First, so an abandoned form still leaves someone to call.
  { id: "telefone", order: 1, title: "What's your WhatsApp?", type: "phoneCountry", required: true, placeholder: "(555) 123-4567" },
  { id: "nome", order: 2, title: "What's your name?", type: "text", required: true, placeholder: "Your full name" },
  { id: "nomeEmpresa", order: 3, title: "What's the name of your business?", type: "text", required: true, placeholder: "Your business name" },
  // Before quantity: the model sets the price rule.
  { id: TYPE_QUESTION_ID, order: 4, title: "Which plaque do you want?", type: "productPicker", required: true },
  { id: "quantidade", order: 5, title: "How many plaques do you need?", type: "quantitySlider", required: true },
  {
    id: "linkDestino",
    order: 6,
    title: "Where should the tap and the QR send people?",
    type: "text",
    required: false,
    placeholder: "Your Google review link or Instagram profile. Not sure? Leave it blank and we find it.",
  },
  {
    id: "logo",
    order: 7,
    title: "Send us your logo",
    type: "fileUpload",
    required: false,
    requiredWhen: { questionId: TYPE_QUESTION_ID, equals: "custom" },
    upload: {
      extensions: ["png", "jpg", "jpeg", "webp", "pdf"],
      // 3 MB fits the public JSON body cap once base64 inflates the file.
      maxSizeMb: 3,
    },
    note: {
      text: "Standard plaques use our ready-made design, so no logo is needed. Tap Next to skip this step.",
      when: { questionId: TYPE_QUESTION_ID, notEquals: "custom" },
    },
  },
  { id: "enderecoEnvio", order: 8, title: "Where should we ship them?", type: "textarea", required: true, placeholder: "Street, number, city, state and ZIP code" },
  { id: "observacoes", order: 9, title: "Anything else we should know?", type: "textarea", required: false, placeholder: "Optional" },
];

const CONFIG: FormConfig = {
  questions: PLAQUE_ORDER_QUESTIONS,
  // Unscored: an order is not a lead to qualify.
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 },
  pricing: {
    model: "nfc-plaque",
    typeQuestionId: TYPE_QUESTION_ID,
    quantityQuestionId: "quantidade",
  },
};

async function seed(apply: boolean) {
  console.log(`Seeding form: slug='${PLAQUE_ORDER_FORM_SLUG}'`);
  // Never the default form: an order form is the wrong fallback for lead capture.
  await seedForm(
    { slug: PLAQUE_ORDER_FORM_SLUG, name: FORM_NAME, description: FORM_DESCRIPTION, config: CONFIG, isActive: true, isDefault: false },
    apply,
  );
  if (apply) console.log(`The form is live at /f/${PLAQUE_ORDER_FORM_SLUG}`);
}

void withSeedGuard(seed);
