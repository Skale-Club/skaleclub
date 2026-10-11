// Seed the barbershop-leads form + the /barbershops managed landing.
// Idempotent: re-running updates all rows in place (same row ids preserved).
// DRY-RUN by default: prints a diff. Add --apply to write (old rows are
// snapshotted into content_revisions first).
//
// Run: npx tsx --env-file=.env scripts/seed-barbershop-landing.ts [--apply]
//
// Creates / updates:
//   1. forms   WHERE slug = 'barbershop-leads'
//   2. pages   WHERE slug = 'barbershops'    (EN mother, language='en')
//   3. pages   WHERE slug = 'barbershops-br' (PT,        language='pt')
//
// Both landings share the SAME sections [heroWebsites, featureGrid x3,
// ourServices, about, reviews, leadFormCta]; copy is t()-based so the language
// column drives EN vs PT. seedPage() bakes the curated pt-BR copy from
// scripts/data/landing-pt-copy.ts straight into the '-br' row automatically
// (see scripts/lib/pt-copy.ts) — no extra script to run for that. Also run
// scripts/seed-barbershop-translations.ts once; it writes the SAME hand-
// written pairs into the `translations` table so t() never falls back to a
// live AI round-trip for this copy anywhere else it might be reused. After
// running, /barbershops renders in English and /barbershops-br in Portuguese.
//
// Content brief (2026-09-30): one page, one ask (call the demo number or send
// the lead form), built entirely from registered section types — no new page
// component. The service carousel selects existing cards from the two live
// catalogs, with Xkedule first, so the landing does not duplicate prices,
// images, links, or product descriptions. The NFC block
// covers the three real 3D-printed products (review plaque, custom
// keychains, keychain display), each linking to its own page under
// /products/ (scripts/seed-products-landing.ts) — not a generic "NFC tag" —
// and is deliberately its own section rather than a dedicated page.
// Per the site owner: never say "tech", "technology", "small company", or
// claim to be local — the copy below sells time/money/a full chair, not a
// technology category. The `reviews` section is given its own title/subtitle
// props for exactly that reason: left as `props: {}` it falls back to
// company-settings' homepage copy, which mentions "technology".
// Text rule: no em dash, no "frase de efeito" (ad-cliché taglines), no
// three-parallel-items sentences, no three-item bullet lists — write like a
// business owner, not a copywriter.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { seedForm, seedPage, withSeedGuard } from "./lib/seed-utils.js";
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
// EN vs PT through t(). Copy here is barbershop-specific (not the shared
// component defaults). No bgVideoUrl: the /websites video asset is specific
// to that page.
//
// Service carousel: the local section stores only the selection and order.
// Product cards are read from /api/portfolio-services and service cards from
// company-settings, using the same CatalogCard/CatalogDetail components as the
// homepage. Changes made in the existing catalog administration flow through
// here automatically without reseeding this landing.
export const LANDING_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "More time in your day. More money in your pocket.",
      subheadline: "More clients on your calendar. Less time on the phone.",
      ctaLabel: "Get more clients",
      secondaryCtaLabel: "Hear it working: (224) 551-6131",
      secondaryCtaHref: "tel:+12245516131",
      secondaryCtaNote: "An AI answers that line for a barbershop. It gives prices and hours. Then it books the cut.",
      backgroundImageUrl: "/barbershops/hero-barbershop.webp",
      backgroundImageAlt: "Barber cutting a client's hair in a busy modern barbershop.",
    },
  },
  {
    type: "featureGrid",
    props: {
      eyebrow: "More money",
      heading: "More money in your pocket",
      subheading: "Where the extra money actually comes from.",
      imageUrl: "/barbershops/full-chairs-v2.webp",
      imageAlt: "A barber welcoming a customer into a busy neighborhood barbershop.",
      imagePosition: "right",
      imageWidth: 1280,
      imageHeight: 720,
      items: [
        {
          icon: "Globe",
          title: "Your own website",
          description: "It takes bookings and the clients stay yours, not a marketplace's.",
        },
        {
          icon: "Instagram",
          title: "Ads that bring people in",
          description: "Google and Instagram ads that fill your calendar with new clients.",
        },
      ],
    },
  },
  {
    type: "featureGrid",
    props: {
      eyebrow: "More time",
      heading: "More time in your day",
      subheading: "Where the extra time in your day comes from.",
      imageUrl: "/barbershops/barber-automation-v3.webp",
      imageAlt: "Google review and Instagram NFC stands on a barbershop counter while a barber serves a client.",
      imagePosition: "left",
      imageWidth: 1280,
      imageHeight: 720,
      items: [
        {
          icon: "Smartphone",
          title: "Calls and texts get answered",
          description: "An AI answers calls and texts any time of day and books the appointment.",
        },
        {
          icon: "MessageCircle",
          title: "Fewer no-shows",
          description: "Reminders go out on their own and cut down on no-shows.",
        },
        {
          icon: "ConciergeBell",
          title: "Social media",
          description: "Posts get made and scheduled for you every week.",
        },
      ],
      theme: "dark",
    },
  },
  {
    type: "ourServices",
    props: {
      eyebrow: "Services for barbershops",
      title: "What your barbershop needs to grow",
      subtitle: "Start with Xkedule for calls and bookings. Add a website, ads or weekly content when you need them.",
      items: [
        { source: "product", slug: "scheduling-system" },
        { source: "product", slug: "websites" },
        { source: "service", title: "Paid Advertising" },
        { source: "product", slug: "xareable" },
      ],
    },
  },
  {
    type: "featureGrid",
    props: {
      eyebrow: "NFC for your shop",
      heading: "For your counter",
      subheading: "Three things we 3D print for barbershops, made to order.",
      items: [
        {
          icon: "Nfc",
          title: "NFC stands and table plates",
          description: "Choose a counter stand or a flat table plate. One tap opens Google reviews or Instagram.",
          imageUrl: "/barbershops/products/nfc-google-plate-v4.webp",
          imageAlt: "Google review NFC table plate on a barbershop counter.",
          imageWidth: 960,
          imageHeight: 720,
          href: "/products/nfc-review-plaque",
        },
        {
          icon: "KeyRound",
          title: "Custom keychains",
          description: "NFC keychains with your barbershop's own branding. The tap opens the link you choose.",
          imageUrl: "/barbershops/products/custom-keychains.webp",
          imageAlt: "Three custom 3D-printed keychains, including a barbershop design.",
          imageWidth: 960,
          imageHeight: 720,
          href: "/products/nfc-keychains",
        },
        {
          icon: "Store",
          title: "Keychain display",
          description: "A display for your counter so you can sell the keychains yourself. Extra money for the shop.",
          imageUrl: "/barbershops/products/keychain-display.webp",
          imageAlt: "Counter display designed to hold keychains for sale.",
          imageWidth: 960,
          imageHeight: 720,
          href: "/products/nfc-keychains",
        },
      ],
    },
  },
  {
    type: "about",
    props: {
      tone: "light",
    },
  },
  {
    type: "reviews",
    props: {
      title: "What people say",
      subtitle: "Real reviews from businesses we've worked with.",
    },
  },
  {
    type: "leadFormCta",
    props: {
      formSlug: FORM_SLUG,
      heading: "Let's fill your chairs",
      subheading: "Tell us about your shop in a minute. Or call (224) 551-6131 first to hear the AI answer the phone.",
      ctaLabel: "Get more clients",
    },
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────

async function main(apply: boolean) {
  await seedForm(
    { slug: FORM_SLUG, name: FORM_NAME, description: FORM_DESCRIPTION, config: BARBERSHOP_LEADS_CONFIG, isActive: true, isDefault: false },
    apply,
  );
  for (const spec of [LANDING_EN, LANDING_PT]) {
    await seedPage({ ...spec, sections: LANDING_SECTIONS }, apply);
  }
}

// Only seed when run directly: importing LANDING_SECTIONS (patch scripts) must
// not open a connection or write anything.
const runDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (runDirectly) void withSeedGuard(main);
else console.log("[seed-barbershop-landing] imported, not run directly: nothing executed");
