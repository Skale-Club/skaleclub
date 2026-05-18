// Seed the website-leads form + the /websites managed landing.
// Idempotent: re-running updates both rows in place (same row ids preserved).
//
// Run: npx tsx --env-file=.env scripts/seed-websites-landing.ts
//
// Creates / updates two rows:
//   1. forms          WHERE slug = 'website-leads'
//   2. landing_pages  WHERE slug = 'websites'
//
// After running, visiting http://localhost:1000/websites renders the landing
// composed of [heroWebsites, trustBadges, processStepper, reviews, leadFormCta].
import "dotenv/config";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { landingPages, type LandingSection } from "../shared/schema/landings.js";
import { forms } from "../shared/schema/forms.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

// ── Config ────────────────────────────────────────────────────────────────

const FORM_SLUG = "website-leads";
const FORM_NAME = "Website Leads";
const FORM_DESCRIPTION =
  "Leads for the /websites landing — businesses looking to commission a website.";

const LANDING_SLUG = "websites";
const LANDING_NAME = "Sites que vendem";

// ── Form questions (pt-BR copy per 44-CONTEXT.md decisions) ───────────────
//
// Notes:
// - IDs `nome`, `email`, `telefone` map to native form_leads columns.
// - Other IDs (nomeProjeto, tipoProjeto, orcamento, prazo, observacoes) fall
//   through into form_leads.customAnswers (jsonb).
// - `points` is 0 for every option — this form is NOT scored; all leads route
//   as `novo` regardless of answers.
// - Question 2 uses the new `phoneCountry` type (Plan 44-03) which renders
//   the inline country selector + phone input in a single field. The country
//   selector is therefore NOT a separate step — the CONTEXT lists 9 logical
//   questions, but the form ships 8 visible steps because Country+Phone are
//   fused into one phoneCountry field (matches SkaleHubGroup pattern per
//   44-CONTEXT decisions line 79).

const WEBSITE_LEADS_QUESTIONS: FormQuestion[] = [
  {
    id: "nome",
    order: 1,
    title: "Qual é o seu nome?",
    type: "text",
    required: true,
    placeholder: "Seu nome completo",
  },
  {
    id: "telefone",
    order: 2,
    title: "Qual é o seu WhatsApp?",
    type: "phoneCountry", // ← new field type from 44-03 (inline country + phone)
    required: true,
    placeholder: "(11) 99999-9999",
  },
  {
    id: "email",
    order: 3,
    title: "Qual é o seu e-mail?",
    type: "email",
    required: true,
    placeholder: "voce@empresa.com",
  },
  {
    id: "nomeProjeto", // → customAnswers.nomeProjeto
    order: 4,
    title: "Qual é o nome do seu negócio ou projeto?",
    type: "text",
    required: false,
    placeholder: "Opcional",
  },
  {
    id: "tipoProjeto", // → customAnswers.tipoProjeto
    order: 5,
    title: "Que tipo de site você precisa?",
    type: "select",
    required: true,
    options: [
      { value: "landing-page",       label: "Landing page (página única de captura)", points: 0 },
      { value: "site-institucional", label: "Site institucional (multi-página)",       points: 0 },
      { value: "ecommerce",          label: "E-commerce (loja online)",                points: 0 },
      { value: "web-app",            label: "Aplicação web (sistema sob medida)",      points: 0 },
      { value: "outro",              label: "Outro",                                   points: 0 },
    ],
  },
  {
    id: "orcamento", // → customAnswers.orcamento
    order: 6,
    title: "Qual é o orçamento previsto?",
    type: "select",
    required: true,
    options: [
      { value: "ate-5k",   label: "Menos de R$ 5.000",      points: 0 },
      { value: "5k-15k",   label: "R$ 5.000 a R$ 15.000",   points: 0 },
      { value: "15k-50k",  label: "R$ 15.000 a R$ 50.000",  points: 0 },
      { value: "50k-mais", label: "Mais de R$ 50.000",      points: 0 },
      { value: "aberto",   label: "Em aberto / a definir",  points: 0 },
    ],
  },
  {
    id: "prazo", // → customAnswers.prazo
    order: 7,
    title: "Qual é o prazo desejado?",
    type: "select",
    required: true,
    options: [
      { value: "asap",       label: "O quanto antes",      points: 0 },
      { value: "1-3-meses",  label: "1 a 3 meses",          points: 0 },
      { value: "3-6-meses",  label: "3 a 6 meses",          points: 0 },
      { value: "sem-pressa", label: "Sem pressa",           points: 0 },
    ],
  },
  {
    id: "observacoes", // → customAnswers.observacoes
    order: 8,
    title: "Algo mais que devamos saber sobre o projeto?",
    type: "text",
    required: false,
    placeholder: "Opcional — links de referência, exemplos, etc.",
  },
];

const WEBSITE_LEADS_CONFIG: FormConfig = {
  questions: WEBSITE_LEADS_QUESTIONS,
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 }, // not scored — all leads land as `novo`
};

// ── Landing sections (in render order) ─────────────────────────────────────

const LANDING_SECTIONS: LandingSection[] = [
  { type: "heroWebsites",   props: {} }, // pt-BR defaults from 44-01
  { type: "trustBadges",    props: {} }, // adapter from 43-03 — reads /api/company-settings
  { type: "processStepper", props: {} }, // pt-BR defaults from 44-02
  { type: "reviews",        props: {} }, // adapter from 43-03 — reads /api/company-settings
  {
    type: "leadFormCta",
    props: {
      formSlug:   FORM_SLUG,
      heading:    "Vamos conversar sobre seu site",
      subheading: "Conte sobre o seu projeto em 1 minuto. Respondemos em até 24 horas com uma proposta.",
      ctaLabel:   "Quero meu site",
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
        config:      WEBSITE_LEADS_CONFIG,
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
        config:      WEBSITE_LEADS_CONFIG,
        isActive:    true,
        isDefault:   false,
      })
      .returning();
    console.log(`  Inserted new form (id=${row.id}).`);
    return row;
  }
}

async function upsertLanding() {
  console.log(`Seeding landing: slug='${LANDING_SLUG}'`);
  const existing = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.slug, LANDING_SLUG));

  if (existing.length > 0) {
    const [row] = await db
      .update(landingPages)
      .set({
        name:      LANDING_NAME,
        sections:  LANDING_SECTIONS,
        isActive:  true,
        updatedAt: new Date(),
      })
      .where(eq(landingPages.slug, LANDING_SLUG))
      .returning();
    console.log(`  Updated existing landing (id=${row.id}).`);
    return row;
  } else {
    const [row] = await db
      .insert(landingPages)
      .values({
        slug:     LANDING_SLUG,
        name:     LANDING_NAME,
        sections: LANDING_SECTIONS,
        isActive: true,
      })
      .returning();
    console.log(`  Inserted new landing (id=${row.id}).`);
    return row;
  }
}

async function main() {
  await upsertForm();
  await upsertLanding();
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
