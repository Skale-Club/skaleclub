// Seed the nfc-keychain-leads form + the NFC keychain landing / pricing pages.
// Idempotent: re-running updates all rows in place (same row ids preserved).
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts
//
// Creates / updates (5 rows):
//   1. forms   WHERE slug = 'nfc-keychain-leads'
//   2. pages   WHERE slug = 'nfc-keychains'    (landing,  EN, language='en')
//   3. pages   WHERE slug = 'chaveiros-nfc'    (landing,  PT, language='pt')
//   4. pages   WHERE slug = 'nfc-pricing'      (explainer, EN, language='en')
//   5. pages   WHERE slug = 'precos-chaveiros' (explainer, PT, language='pt')
//
// The landing pair shares LANDING_SECTIONS [heroWebsites, trustBadges,
// processStepper, reviews, leadFormCta]. The explainer pair shares
// PRICING_SECTIONS [contentBlocks, pricingTable, processStepper, faqAccordion,
// leadFormCta]. Copy is t()-based so the pages.language column drives EN vs
// PT; each pair carries a reciprocal alternateSlug for hreflang.
//
// Pricing facts used in copy (the ONLY real numbers — nothing else is claimed):
//   $10 per piece · minimum order 20 pieces ($200) · $50 one-time art fee on
//   the first order only · 100% payment upfront before production starts.
// No turnaround time is stated anywhere: the "how long does it take?" FAQ
// deliberately says the window is confirmed in writing at order approval.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";
import { forms } from "../shared/schema/forms.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

// ── Config ────────────────────────────────────────────────────────────────

const FORM_SLUG = "nfc-keychain-leads";
const FORM_NAME = "NFC Keychain Leads";
const FORM_DESCRIPTION =
  "Leads for the NFC keychain landing / pricing pages — business owners ordering custom 3D-printed NFC keychains.";

// ── Form questions (ENGLISH source copy) ──────────────────────────────────
//
// ID → storage mapping notes:
// - ALL copy here MUST be authored in English. English is the t() SOURCE
//   language: LeadFormModal renders t(question.title), which passes English
//   through untouched on the EN pages and auto-translates it on the PT ones.
//   Authoring Portuguese here would leak PT copy onto /nfc-keychains.
// - IDs `nome`, `email`, `telefone` map to native form_leads columns.
// - `tipoNegocio` ALSO maps to a native column (form_leads.tipo_negocio). It is
//   listed in shared/form.ts KNOWN_FIELD_IDS, so LeadFormModal.persistProgress
//   filters it OUT of customAnswers and sends it as a top-level payload field.
//   formLeadProgressSchema caps `tipoNegocio` at 120 chars — keep its option
//   `value` strings short kebab-case.
// - `observacoes` falls through to customAnswers even though a same-named
//   native column exists: it is NOT in KNOWN_FIELD_IDS and persistProgress
//   never sets it. Same behavior as the barbershop seed.
// - Every remaining ID (nomeEmpresa, quantidadeEstimada, objetivoChaveiro,
//   jaTemLogo, prazoDesejado, tipoVisita) falls through into
//   form_leads.customAnswers (jsonb).
// - `points` is 0 for every option — this form is NOT scored; all leads route
//   as `novo` regardless of answers.
// - Question 2 uses the `phoneCountry` type (Plan 44-03), which renders the
//   inline country selector + phone input as a single field, overrides
//   payload.telefone with the international number, and stashes
//   customAnswers.countryCode.

const NFC_KEYCHAIN_LEADS_QUESTIONS: FormQuestion[] = [
  {
    id: "nome",
    order: 1,
    title: "What's your name?",
    type: "text",
    required: true,
    placeholder: "Your full name",
  },
  {
    id: "telefone",
    order: 2,
    title: "What's your WhatsApp?",
    type: "phoneCountry", // ← inline country selector + phone input (44-03)
    required: true,
    placeholder: "(555) 123-4567",
  },
  {
    id: "email",
    order: 3,
    title: "What's your email?",
    type: "email",
    required: true,
    placeholder: "you@yourbusiness.com",
  },
  {
    id: "nomeEmpresa", // → customAnswers.nomeEmpresa
    order: 4,
    title: "What's the name of your business?",
    type: "text",
    required: true,
    placeholder: "Your business name",
  },
  {
    id: "tipoNegocio", // → native form_leads.tipo_negocio column (KNOWN_FIELD_IDS)
    order: 5,
    title: "What type of business do you have?",
    type: "select",
    required: true,
    options: [
      { value: "restaurant-food",        label: "Restaurant / food",          points: 0 },
      { value: "beauty-barbershop",      label: "Beauty salon / barbershop",  points: 0 },
      { value: "cleaning-home-services", label: "Cleaning / home services",   points: 0 },
      { value: "auto-services",          label: "Auto services",              points: 0 },
      { value: "retail-store",           label: "Retail / store",             points: 0 },
      { value: "health-fitness",         label: "Health / fitness",           points: 0 },
      { value: "other",                  label: "Other",                      points: 0 },
    ],
  },
  {
    id: "quantidadeEstimada", // → customAnswers.quantidadeEstimada
    order: 6,
    title: "How many keychains do you need?",
    type: "select",
    required: true,
    // Options are anchored on the 20-piece minimum order.
    options: [
      { value: "20",       label: "20 pieces (minimum order)", points: 0 },
      { value: "21-50",    label: "21-50 pieces",              points: 0 },
      { value: "51-100",   label: "51-100 pieces",             points: 0 },
      { value: "100-plus", label: "100+ pieces",               points: 0 },
      { value: "not-sure", label: "Not sure yet",              points: 0 },
    ],
  },
  {
    id: "objetivoChaveiro", // → customAnswers.objetivoChaveiro
    order: 7,
    title: "What should the tap open?",
    type: "select",
    required: true,
    options: [
      { value: "google-reviews", label: "Google review page",            points: 0 },
      { value: "instagram",      label: "Instagram",                     points: 0 },
      { value: "vcard",          label: "Digital business card (vCard)", points: 0 },
      { value: "menu",           label: "Menu",                          points: 0 },
      { value: "website",        label: "Website",                       points: 0 },
      { value: "multiple",       label: "More than one of these",        points: 0 },
    ],
  },
  {
    id: "jaTemLogo", // → customAnswers.jaTemLogo
    order: 8,
    title: "Do you have a logo?",
    type: "select",
    required: true,
    // Signals whether the $50 first-order art / design fee applies (and how
    // much design work is needed). The fee is NOT stated in the labels — the
    // pricing page explains it.
    options: [
      { value: "has-file",   label: "Yes, I have my logo in a file",   points: 0 },
      { value: "no-file",    label: "I have a logo but not the file",  points: 0 },
      { value: "needs-logo", label: "No, I need one created",          points: 0 },
    ],
  },
  {
    id: "prazoDesejado", // → customAnswers.prazoDesejado
    order: 9,
    title: "When do you want them?",
    type: "select",
    required: true,
    // Urgency only — no SLA is promised anywhere in this form or its pages.
    options: [
      { value: "asap",        label: "As soon as possible",      points: 0 },
      { value: "this-month",  label: "Within this month",        points: 0 },
      { value: "next-month",  label: "Next month",               points: 0 },
      { value: "researching", label: "Just researching for now", points: 0 },
    ],
  },
  // ── Xphere booking integration hook point ────────────────────────────────
  // tipoVisita captures the MEETING FORMAT only. Actual date/slot picking is a
  // deliberate follow-up: Xphere (the separate ops platform at
  // C:\Users\Vanildo\Dev\xphere) owns Calendly-style scheduling, and this
  // answer is the branch point where the free-slots picker will be injected
  // later. Do NOT add a date/time question here — no such form question type
  // exists.
  {
    id: "tipoVisita", // → customAnswers.tipoVisita
    order: 10,
    title: "How would you like to talk to us?",
    type: "select",
    required: true,
    options: [
      { value: "presencial", label: "In-person visit at my business", points: 0 },
      { value: "online",     label: "Online meeting (video call)",    points: 0 },
      { value: "whatsapp",   label: "WhatsApp only",                  points: 0 },
    ],
  },
  {
    id: "observacoes", // → customAnswers.observacoes (NOT the native column — see notes above)
    order: 11,
    title: "Anything else we should know?",
    type: "text",
    required: false,
    placeholder: "Optional",
  },
];

const NFC_KEYCHAIN_LEADS_CONFIG: FormConfig = {
  questions: NFC_KEYCHAIN_LEADS_QUESTIONS,
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 }, // not scored — all leads land as `novo`
};

// ── Landing sections (in render order) ─────────────────────────────────────

// Shared processStepper props for this product. Used by BOTH the landing and
// the pricing page so the two never drift apart. `icons` must be names from
// the processStepperIconNames allowlist in ProcessStepperSection.tsx.
// Step descriptions contain NO day/week counts — turnaround is never claimed.
const NFC_STEPPER_PROPS = {
  eyebrow:    "How it works",
  heading:    "From first message to tapping in 4 steps",
  subheading: "A simple process with no surprises. You approve every step before we move on.",
  steps: [
    {
      title:       "Talk to us",
      description: "Tell us what the tap should open and how many keychains you need. We confirm the details with you on WhatsApp.",
    },
    {
      title:       "We design your art",
      description: "Send us your logo file, or we create the artwork for you. You approve the design before anything is produced.",
    },
    {
      title:       "We print and program",
      description: "Each keychain is 3D-printed with your design, and the NFC tag inside is programmed with your link and tested.",
    },
    {
      title:       "You receive and start tapping",
      description: "Your keychains arrive ready to use. Hand them out, put one on the counter, and watch the taps come in.",
    },
  ],
  icons: ["MessageCircle", "PenTool", "Factory", "Truck"],
};

// Sections are IDENTICAL for both languages — the pages.language column drives
// EN vs PT through t(). The hero and CTA carry explicit English copy props
// (NFC-keychain-specific messaging). No pricing in the hero: the ad landing
// captures the lead; the pricing page (sent by WhatsApp automation) closes.
// No bgVideoUrl: the /websites video asset is specific to that page.
const LANDING_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "One tap. Your customers land exactly where you want them.",
      subheadline: "Custom 3D-printed NFC keychains with your logo. A customer taps their phone and opens your Google review page, Instagram, digital business card, menu, or website. No app needed.",
      ctaLabel: "I want my keychains",
    },
  },
  { type: "trustBadges",    props: {} },                // adapter — reads /api/company-settings (t()-based)
  { type: "processStepper", props: NFC_STEPPER_PROPS }, // custom steps + icons for this product
  { type: "reviews",        props: {} },                // adapter — real reviews only, from /api/company-settings
  {
    type: "leadFormCta",
    props: {
      formSlug: FORM_SLUG,
      heading: "Ready to get your keychains?",
      subheading: "Tell us about your business in 1 minute and we will get back to you on WhatsApp.",
      ctaLabel: "I want my keychains",
    },
  },
];

// ── Pricing / explainer sections (in render order) ─────────────────────────

// This page is sent to a lead by WhatsApp automation and must close price,
// process, timeline, and objections with no human present. Every number here
// is from the confirmed pricing block at the top of this file.
const PRICING_SECTIONS: PageSection[] = [
  {
    type: "contentBlocks",
    props: {
      eyebrow:    "How it works",
      heading:    "NFC keychains, explained",
      subheading: "What they are, where they work, and what you need to get started.",
      blocks: [
        {
          heading: "What is an NFC keychain?",
          paragraphs: [
            "An NFC keychain is a small 3D-printed keychain with your logo on the outside and a tiny NFC tag inside. When a customer touches the back of their phone to it, the phone opens a link you choose. No app to download, nothing to type.",
            "Modern iPhones and Android phones read NFC tags natively — it is the same technology behind tap-to-pay. You pick what the tap opens:",
          ],
          bullets: [
            "Google review page — collect more reviews right at the counter",
            "Instagram — new followers in one tap",
            "Digital business card (vCard) — your contact saved straight to their phone",
            "Menu — no more printed menus going out of date",
            "Website — send people directly to your booking or store page",
          ],
        },
        {
          heading: "Where businesses use it",
          paragraphs: [
            "The keychain works anywhere your customers are within arm's reach of it. Put one at every point of contact:",
          ],
          bullets: [
            "On the counter next to the register",
            "At the reception desk or in the waiting area",
            "Inside your car or truck if you offer mobile services",
            "On your own keyring, so you always have one to hand out",
            "On a table tent in a restaurant, salon, or barbershop",
          ],
        },
        {
          heading: "What you get and what we need from you",
          paragraphs: [
            "Every order includes the 3D-printed keychains with your design, the NFC tag inside each one programmed with your link, and a test of every piece before it ships.",
            "To get started, we need your logo as a file (PNG, SVG, or PDF) and the link you want the tap to open. If you do not have a logo file, we create the artwork for you — that is what the first-order art fee covers.",
          ],
        },
      ],
    },
  },
  {
    type: "pricingTable",
    props: {
      eyebrow:    "Pricing",
      heading:    "Simple, upfront pricing",
      subheading: "No hidden fees. You know the total before we start.",
      lines: [
        { label: "Per keychain",     price: "$10",  kind: "per-unit" },
        { label: "Minimum order",    price: "$200", note: "20 pieces × $10", kind: "minimum" },
        { label: "Art / design fee", price: "$50",  note: "First order only — waived from your second order onward", kind: "one-time" },
      ],
      footnote: "100% payment upfront. Production starts after payment clears.",
    },
  },
  { type: "processStepper", props: NFC_STEPPER_PROPS }, // same steps + icons as the landing
  {
    type: "faqAccordion",
    props: {
      eyebrow:    "FAQ",
      heading:    "Questions people ask before ordering",
      subheading: "Everything you need to decide, without waiting for a reply.",
      items: [
        {
          question: "What exactly is an NFC keychain?",
          answer:   "A 3D-printed keychain with your logo and a small NFC tag inside. When a customer taps their phone on it, the phone opens the link you chose: your Google review page, Instagram, digital business card, menu, or website.",
        },
        {
          question: "Do my customers need to install an app?",
          answer:   "No. Modern iPhones and Android phones read NFC tags natively, the same way they handle tap-to-pay. The customer just holds the phone close to the keychain and a notification opens the link.",
        },
        {
          question: "Why is there a minimum order?",
          answer:   "Each order is set up, designed, printed, and programmed as a batch, so very small runs do not make sense for either side. The minimum is 20 pieces, which is $200 at $10 per keychain. Twenty pieces is enough to put one at every point of contact and hand some out to your team.",
        },
        {
          question: "What is the $50 art fee, and when is it waived?",
          answer:   "The $50 art / design fee covers preparing your logo for 3D printing and creating the artwork if you do not have a file yet. It is charged once, on your first order only. From your second order onward it is waived, because the artwork is already done.",
        },
        {
          question: "Can I change the link later?",
          answer:   "Yes. We recommend pointing the tag to a link you control, like a short link or a page on your website, so you can redirect it whenever you want without touching the keychain. If you need the tag itself reprogrammed, message us and we will walk you through the options.",
        },
        {
          question: "Why is payment 100% upfront?",
          answer:   "Every order is custom-made with your logo, so it cannot be resold or reused for another business. Paying in full before production covers the materials and the work, and it lets us start right away. You still approve the design before anything is printed.",
        },
        {
          // Deliberate omission: NO number here. If a published SLA is wanted
          // later, edit this answer in the admin page editor — no code change.
          question: "How long does it take?",
          answer:   "Production starts as soon as your payment clears and the artwork is approved. The exact production and delivery window is confirmed in writing when your order is approved, so you know what to expect before you commit.",
        },
        {
          question: "What if I do not have a logo?",
          answer:   "That is fine. Choose \"No, I need one created\" in the form and we create the artwork for you as part of the first-order art fee. If you have a logo but not the file, we can usually work from a clear photo or a screenshot of it.",
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      formSlug: FORM_SLUG,
      heading: "Ready to order?",
      subheading: "Fill out the form and we will confirm your quantity, artwork, and total with you on WhatsApp.",
      ctaLabel: "I want to order",
    },
  },
];

// ── Page specs ─────────────────────────────────────────────────────────────

type LandingSpec = {
  slug: string;
  name: string;
  language: "en" | "pt";
  alternateSlug: string;
  sections: PageSection[];
};

// Two bilingual pairs. Same sections within each pair; only the language +
// alternateSlug differ (reciprocal alternateSlug drives hreflang).
const LANDING_EN: LandingSpec = { slug: "nfc-keychains",    name: "NFC Keychains (EN)", language: "en", alternateSlug: "chaveiros-nfc",    sections: LANDING_SECTIONS };
const LANDING_PT: LandingSpec = { slug: "chaveiros-nfc",    name: "NFC Keychains (PT)", language: "pt", alternateSlug: "nfc-keychains",    sections: LANDING_SECTIONS };
const PRICING_EN: LandingSpec = { slug: "nfc-pricing",      name: "NFC Pricing (EN)",   language: "en", alternateSlug: "precos-chaveiros", sections: PRICING_SECTIONS };
const PRICING_PT: LandingSpec = { slug: "precos-chaveiros", name: "NFC Pricing (PT)",   language: "pt", alternateSlug: "nfc-pricing",      sections: PRICING_SECTIONS };

// ── Seed runner ───────────────────────────────────────────────────────────

async function upsertForm() {
  console.log(`Seeding form: slug='${FORM_SLUG}'`);
  const existing = await db.select().from(forms).where(eq(forms.slug, FORM_SLUG));

  if (existing.length > 0) {
    const [row] = await db
      .update(forms)
      .set({
        name:        FORM_NAME,
        description: FORM_DESCRIPTION,
        config:      NFC_KEYCHAIN_LEADS_CONFIG,
        isActive:    true,
        isDefault:   false,
        updatedAt:   new Date(),
      })
      .where(eq(forms.slug, FORM_SLUG))
      .returning();
    console.log(`  Updated existing form (id=${row.id}).`);
    return row;
  } else {
    const [row] = await db
      .insert(forms)
      .values({
        slug:        FORM_SLUG,
        name:        FORM_NAME,
        description: FORM_DESCRIPTION,
        config:      NFC_KEYCHAIN_LEADS_CONFIG,
        isActive:    true,
        isDefault:   false,
      })
      .returning();
    console.log(`  Inserted new form (id=${row.id}).`);
    return row;
  }
}

async function upsertLanding(spec: LandingSpec) {
  console.log(`Seeding landing: slug='${spec.slug}' (${spec.language})`);
  const existing = await db
    .select()
    .from(pages)
    .where(eq(pages.slug, spec.slug));

  if (existing.length > 0) {
    const [row] = await db
      .update(pages)
      .set({
        name:          spec.name,
        sections:      spec.sections,
        isActive:      true,
        language:      spec.language,
        alternateSlug: spec.alternateSlug,
        updatedAt:     new Date(),
      })
      .where(eq(pages.slug, spec.slug))
      .returning();
    console.log(`  Updated existing landing (id=${row.id}).`);
    return row;
  } else {
    const [row] = await db
      .insert(pages)
      .values({
        slug:          spec.slug,
        name:          spec.name,
        sections:      spec.sections,
        isActive:      true,
        language:      spec.language,
        alternateSlug: spec.alternateSlug,
      })
      .returning();
    console.log(`  Inserted new landing (id=${row.id}).`);
    return row;
  }
}

async function main() {
  await upsertForm();
  await upsertLanding(LANDING_EN);
  await upsertLanding(LANDING_PT);
  await upsertLanding(PRICING_EN);
  await upsertLanding(PRICING_PT);
  console.log("Done.");
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
