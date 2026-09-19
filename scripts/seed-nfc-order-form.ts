// Seed the NFC keychain ORDER form (slug `nfc-keychain-order`).
// Idempotent: re-running updates the row in place (same id, same leads).
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-order-form.ts
//
// This is NOT the ad-landing lead form (`nfc-keychain-leads`, seeded by
// scripts/seed-nfc-keychains-landing.ts). That one captures interest; this one
// captures an ORDER: what, how many, where to ship, and the logo to evaluate.
// It still takes no payment — the team reviews every order and calls back, so
// the price shown is an estimate and production starts only after approval.
//
// Question order, and why:
//   1. telefone       — first, so an abandoned form still leaves someone to call
//   2. pedidoAnterior — drives the art-fee disclaimer on the logo step
//   3. nome
//   4. nomeEmpresa
//   5. tipoChaveiro   — before quantity: the type sets the per-unit price
//   6. quantidade     — slider + live quote
//   7. logo           — art-fee disclaimer lands here, informed by Q2
//   8. objetivoChaveiro
//   9. enderecoEnvio
//  10. observacoes    — optional, last
//
// ID -> storage mapping: `nome` and `telefone` are native form_leads columns.
// Every other id falls through to form_leads.custom_answers (jsonb), alongside
// the price snapshot the server freezes there on completion (nfcTotal,
// nfcUnitPrice, nfcPricingVersion, ...).
//
// Copy is authored in ENGLISH: it is the t() source language, so the PT pages
// translate it and the EN pages pass it through untouched.
//
// Pricing lives in shared/nfc-pricing.ts — never in this file. The slider
// range, the volume tiers, the keychain catalogue and the $50 art fee are all
// read from there at render time, so tuning price never means reseeding.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { forms } from "../shared/schema/forms.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

const FORM_SLUG = "nfc-keychain-order";
const FORM_NAME = "NFC Keychain Order";
const FORM_DESCRIPTION =
  "Order request for custom NFC keychains — quantity, type, logo and shipping. Priced live, reviewed by the team before production.";

const QUESTIONS: FormQuestion[] = [
  {
    id: "telefone",
    order: 1,
    title: "What's your WhatsApp?",
    type: "phoneCountry",
    required: true,
    placeholder: "(555) 123-4567",
  },
  {
    id: "pedidoAnterior",
    order: 2,
    title: "Have you ordered from us before?",
    type: "select",
    required: true,
    // `yes` is what FormConfig.pricing.returningValue matches to drop the art
    // fee from the estimate. The server double-checks against past orders.
    options: [
      { value: "yes", label: "Yes, I'm already a customer", points: 0 },
      { value: "no", label: "No, this is my first order", points: 0 },
      { value: "not-sure", label: "I'm not sure", points: 0 },
    ],
  },
  {
    id: "nome",
    order: 3,
    title: "What's your name?",
    type: "text",
    required: true,
    placeholder: "Your full name",
  },
  {
    id: "nomeEmpresa",
    order: 4,
    title: "What's the name of your business?",
    type: "text",
    required: true,
    placeholder: "Your business name",
  },
  {
    id: "tipoChaveiro",
    order: 5,
    title: "Which keychain do you want?",
    // Options come from NFC_KEYCHAIN_TYPES, not from this config. While the
    // catalogue holds one active type the step auto-selects it and reads as a
    // confirmation; it becomes a real choice the moment a second type is added.
    type: "productPicker",
    required: true,
  },
  {
    id: "quantidade",
    order: 6,
    title: "How many do you need?",
    type: "quantitySlider",
    required: true,
  },
  {
    id: "logo",
    order: 7,
    title: "Send us your logo",
    type: "fileUpload",
    required: true,
    upload: {
      extensions: ["png", "jpg", "jpeg", "webp", "pdf"],
      // 3 MB fits the public JSON body cap once base64 inflates the file.
      maxSizeMb: 3,
    },
    note: {
      text: "First order includes a one-time $50 art fee to prepare your logo for 3D printing. It is waived from your second order onward.",
      when: { questionId: "pedidoAnterior", notEquals: "yes" },
    },
  },
  {
    id: "objetivoChaveiro",
    order: 8,
    title: "What should the tap open?",
    type: "select",
    required: true,
    options: [
      { value: "google-reviews", label: "Google review page", points: 0 },
      { value: "instagram", label: "Instagram", points: 0 },
      { value: "vcard", label: "Digital business card (vCard)", points: 0 },
      { value: "menu", label: "Menu", points: 0 },
      { value: "website", label: "Website", points: 0 },
      { value: "multiple", label: "More than one of these", points: 0 },
    ],
  },
  {
    id: "enderecoEnvio",
    order: 9,
    title: "Where should we ship them?",
    type: "textarea",
    required: true,
    placeholder: "Street, number, city, state and ZIP code",
  },
  {
    id: "observacoes",
    order: 10,
    title: "Anything else we should know?",
    type: "textarea",
    required: false,
    placeholder: "Optional",
  },
];

const CONFIG: FormConfig = {
  questions: QUESTIONS,
  // Unscored: an order is not a lead to qualify, so every submission lands as
  // `novo` with no classification and goes straight to the team.
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 },
  pricing: {
    model: "nfc-keychain",
    typeQuestionId: "tipoChaveiro",
    quantityQuestionId: "quantidade",
    returningQuestionId: "pedidoAnterior",
    returningValue: "yes",
  },
};

async function seed() {
  console.log(`Seeding form: slug='${FORM_SLUG}'`);
  const existing = await db.select().from(forms).where(eq(forms.slug, FORM_SLUG));

  if (existing.length > 0) {
    const [row] = await db
      .update(forms)
      .set({ name: FORM_NAME, description: FORM_DESCRIPTION, config: CONFIG, isActive: true })
      .where(eq(forms.slug, FORM_SLUG))
      .returning();
    console.log(`  updated form id=${row.id} (${QUESTIONS.length} questions)`);
    return;
  }

  const [row] = await db
    .insert(forms)
    .values({
      slug: FORM_SLUG,
      name: FORM_NAME,
      description: FORM_DESCRIPTION,
      // Never the default form: the default is what unslugged lead capture
      // falls back to, and an order form is the wrong thing to land there.
      isDefault: false,
      isActive: true,
      config: CONFIG,
    })
    .returning();
  console.log(`  created form id=${row.id} (${QUESTIONS.length} questions)`);
}

seed()
  .then(() => console.log(`Done. The form is live at /f/${FORM_SLUG}`))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
