// Seed the barbershop-leads form + the /barbershops managed landing.
// Idempotent: re-running updates all rows in place (same row ids preserved).
//
// Run: npx tsx --env-file=.env scripts/seed-barbershop-landing.ts
//
// Creates / updates:
//   1. forms   WHERE slug = 'barbershop-leads'
//   2. pages   WHERE slug = 'barbershops'    (EN mother, language='en')
//   3. pages   WHERE slug = 'barbershops-br' (PT,        language='pt')
//
// Both landings share the SAME sections [heroWebsites, trustBadges,
// processStepper, reviews, leadFormCta]; copy is t()-based so the language
// column drives EN vs PT. After running, /barbershops renders in English and
// /barbershops-br in Portuguese.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";
import { forms } from "../shared/schema/forms.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

// ── Config ────────────────────────────────────────────────────────────────

const FORM_SLUG = "barbershop-leads";
const FORM_NAME = "Barbershop Leads";
const FORM_DESCRIPTION =
  "Leads for the /barbershops landing — barbershop owners looking to fill their chairs.";

// Bilingual pair: EN mother at /barbershops, PT at /barbershops-br. Same
// sections; only the language + alternateSlug differ.
const LANDING_EN = { slug: "barbershops",    name: "Barbershops (EN)", language: "en" as const, alternateSlug: "barbershops-br" };
const LANDING_PT = { slug: "barbershops-br", name: "Barbershops (PT)", language: "pt" as const, alternateSlug: "barbershops" };

// ── Form questions (ENGLISH source copy) ──────────────────────────────────
//
// Notes:
// - ALL copy here MUST be authored in English. English is the t() SOURCE
//   language: LeadFormModal renders t(question.title), which passes English
//   through untouched on the EN landing and auto-translates it on the PT one.
//   Authoring Portuguese here would leak PT copy onto /barbershops.
// - IDs `nome`, `email`, `telefone` map to native form_leads columns.
// - `principalDesafio` ALSO maps to a native form_leads.principal_desafio
//   column (shared/schema/forms.ts:55) — benign; the answer simply lands in a
//   dedicated column instead of customAnswers.
// - All other IDs (nomeBarbearia, numeroCadeiras, numeroBarbeiros,
//   sistemaAgendamento, ticketMedio, investimentoAnuncios, tipoVisita,
//   enderecoBarbearia, observacoes) fall through into form_leads.customAnswers
//   (jsonb). `enderecoBarbearia` is a conditional field shown only when
//   tipoVisita = presencial.
// - `points` is 0 for every option — this form is NOT scored; all leads route
//   as `novo` regardless of answers.
// - Question 2 uses the `phoneCountry` type (Plan 44-03) which renders the
//   inline country selector + phone input as a single field.

const BARBERSHOP_LEADS_QUESTIONS: FormQuestion[] = [
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
    placeholder: "you@yourshop.com",
  },
  {
    id: "nomeBarbearia", // → customAnswers.nomeBarbearia
    order: 4,
    title: "What's the name of your barbershop?",
    type: "text",
    required: true,
    placeholder: "Your shop name",
  },
  {
    id: "numeroCadeiras", // → customAnswers.numeroCadeiras
    order: 5,
    title: "How many chairs does your shop have?",
    type: "select",
    required: true,
    options: [
      { value: "1",      label: "1",   points: 0 },
      { value: "2-3",    label: "2-3", points: 0 },
      { value: "4-6",    label: "4-6", points: 0 },
      { value: "7-plus", label: "7+",  points: 0 },
    ],
  },
  {
    id: "numeroBarbeiros", // → customAnswers.numeroBarbeiros
    order: 6,
    title: "How many barbers work with you?",
    type: "select",
    required: true,
    options: [
      { value: "just-me", label: "Just me", points: 0 },
      { value: "2-3",     label: "2-3",     points: 0 },
      { value: "4-6",     label: "4-6",     points: 0 },
      { value: "7-plus",  label: "7+",      points: 0 },
    ],
  },
  {
    id: "sistemaAgendamento", // → customAnswers.sistemaAgendamento
    order: 7,
    title: "How do clients book with you today?",
    type: "select",
    required: true,
    options: [
      { value: "whatsapp-only", label: "WhatsApp only",                       points: 0 },
      { value: "booking-app",   label: "Booking app (Booksy, Agendor, etc.)", points: 0 },
      { value: "walk-ins-only", label: "Walk-ins only",                       points: 0 },
      { value: "phone-calls",   label: "Phone calls",                         points: 0 },
      { value: "other",         label: "Other",                               points: 0 },
    ],
  },
  {
    id: "ticketMedio", // → customAnswers.ticketMedio
    order: 8,
    title: "What's your average ticket per client?",
    type: "select",
    required: true,
    options: [
      { value: "under-25", label: "Under $25", points: 0 },
      { value: "25-45",    label: "$25-$45",   points: 0 },
      { value: "45-75",    label: "$45-$75",   points: 0 },
      { value: "over-75",  label: "Over $75",  points: 0 },
    ],
  },
  {
    id: "investimentoAnuncios", // → customAnswers.investimentoAnuncios
    order: 9,
    title: "How much do you invest in ads per month today?",
    type: "select",
    required: true,
    options: [
      { value: "nothing-yet", label: "Nothing yet", points: 0 },
      { value: "under-300",   label: "Under $300",  points: 0 },
      { value: "300-1000",    label: "$300-$1,000", points: 0 },
      { value: "over-1000",   label: "Over $1,000", points: 0 },
    ],
  },
  {
    id: "principalDesafio", // → native form_leads.principal_desafio column
    order: 10,
    title: "What's your biggest challenge right now?",
    type: "select",
    required: true,
    options: [
      { value: "not-enough-clients",    label: "Not enough new clients",      points: 0 },
      { value: "clients-dont-return",   label: "Clients don't come back",     points: 0 },
      { value: "empty-chairs",          label: "Empty chairs on slow days",   points: 0 },
      { value: "no-time-for-marketing", label: "No time to handle marketing", points: 0 },
      { value: "other",                 label: "Other",                       points: 0 },
    ],
  },
  // ── Xphere booking integration hook point ────────────────────────────────
  // tipoVisita captures the MEETING FORMAT only. Date/slot picking happens on
  // Xphere's side: since quick 260906-g80 the post-submit redirect consumes
  // this answer (via the admin-configured in-person/online event slugs in
  // Admin -> Integrations -> CRM -> Xphere) and sends the lead to the matching
  // https://xphere.app/book/... page from the thank-you CTA. Do NOT add a
  // date/time question here — no such form question type exists.
  {
    id: "tipoVisita", // → customAnswers.tipoVisita
    order: 11,
    title: "How would you like to meet us?",
    type: "select",
    required: true,
    options: [
      { value: "presencial", label: "In-person visit at my shop",  points: 0 },
      { value: "online",     label: "Online meeting (video call)", points: 0 },
    ],
    conditionalField: {
      showWhen: "presencial",
      id: "enderecoBarbearia", // → customAnswers.enderecoBarbearia
      title: "What's your shop address?",
      placeholder: "Street, number, city",
    },
  },
  {
    id: "observacoes", // → customAnswers.observacoes
    order: 12,
    title: "Anything else we should know?",
    type: "text",
    required: false,
    placeholder: "Optional",
  },
];

const BARBERSHOP_LEADS_CONFIG: FormConfig = {
  questions: BARBERSHOP_LEADS_QUESTIONS,
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 }, // not scored — all leads land as `novo`
};

// ── Landing sections (in render order) ─────────────────────────────────────

// Sections are IDENTICAL for both languages — the pages.language column drives
// EN vs PT through t(). Unlike the /websites seed, the hero and CTA carry
// explicit English copy props here (barbershop-specific messaging) rather than
// falling back to the shared component defaults.
// No bgVideoUrl: the /websites video asset is specific to that page.
const LANDING_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "Your barbershop deserves a full chair, every day.",
      subheadline: "We bring new clients into your shop with ads and booking that actually work — set up in days, not months.",
      ctaLabel: "I want more clients",
    },
  },
  { type: "trustBadges",    props: {} }, // adapter — reads /api/company-settings (t()-based)
  { type: "processStepper", props: {} }, // copy via t() (ProcessStepperSection defaults)
  { type: "reviews",        props: {} }, // adapter — reads /api/company-settings (t()-based)
  {
    type: "leadFormCta",
    props: {
      formSlug: FORM_SLUG,
      heading: "Let's fill your chairs",
      subheading: "Tell us about your barbershop in 1 minute. We'll reply within 24 hours.",
      ctaLabel: "I want more clients",
    },
  },
];

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
        config:      BARBERSHOP_LEADS_CONFIG,
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
        config:      BARBERSHOP_LEADS_CONFIG,
        isActive:    true,
        isDefault:   false,
      })
      .returning();
    console.log(`  Inserted new form (id=${row.id}).`);
    return row;
  }
}

type LandingSpec = { slug: string; name: string; language: "en" | "pt"; alternateSlug: string };

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
        sections:      LANDING_SECTIONS,
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
        sections:      LANDING_SECTIONS,
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
