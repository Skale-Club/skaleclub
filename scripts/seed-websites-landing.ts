// Seed the website-leads form + the /websites managed landing.
// Idempotent: re-running updates both rows in place (same row ids preserved).
//
// Run: npx tsx --env-file=.env scripts/seed-websites-landing.ts
//
// Creates / updates:
//   1. forms          WHERE slug = 'website-leads'
//   2. landing_pages  WHERE slug = 'websites'    (EN mother, language='en')
//   3. landing_pages  WHERE slug = 'websites-br' (PT,        language='pt')
//
// Both landings share the SAME sections [heroWebsites, trustBadges,
// processStepper, reviews, leadFormCta]; copy is t()-based so the language
// column drives EN vs PT. After running, /websites renders in English and
// /websites-br in Portuguese.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";
import { forms } from "../shared/schema/forms.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

// ── Config ────────────────────────────────────────────────────────────────

const FORM_SLUG = "website-leads";
const FORM_NAME = "Website Leads";
const FORM_DESCRIPTION =
  "Leads for the /websites landing — businesses looking to commission a website.";

// Bilingual pair: EN mother at /websites, PT at /websites-br. Same sections;
// only the language + alternateSlug differ.
const LANDING_EN = { slug: "websites",    name: "Websites (EN)", language: "en" as const, alternateSlug: "websites-br" };
const LANDING_PT = { slug: "websites-br", name: "Websites (PT)", language: "pt" as const, alternateSlug: "websites" };

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

// Sections are IDENTICAL for both languages. All copy is t()-based now (EN
// source defaults + PT in translations.ts), so language is driven solely by the
// landing_pages.language column — no per-language copy duplicated here.
const LANDING_SECTIONS: PageSection[] = [
  { type: "heroWebsites",   props: {} }, // copy via t() (HeroWebsitesSection defaults)
  { type: "trustBadges",    props: {} }, // adapter — reads /api/company-settings (t()-based)
  { type: "processStepper", props: {} }, // copy via t() (ProcessStepperSection defaults)
  { type: "reviews",        props: {} }, // adapter — reads /api/company-settings (t()-based)
  { type: "leadFormCta",    props: { formSlug: FORM_SLUG } }, // copy via t() (LeadFormCtaAdapter defaults)
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
