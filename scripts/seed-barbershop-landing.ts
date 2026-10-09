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
// Both landings share the SAME sections [heroWebsites (dark), featureGrid x2,
// processStepper, pricingPlans, linkCallout, reviews, faqAccordion,
// leadFormCta]; copy is t()-based so the language column drives EN vs PT.
// seedPage() bakes the curated pt-BR copy from scripts/data/landing-pt-copy.ts
// straight into the '-br' row automatically (see scripts/lib/pt-copy.ts), so
// no extra script is needed for that. Also run
// scripts/seed-barbershop-translations.ts once; it writes the SAME hand-
// written pairs into the `translations` table so t() never falls back to a
// live AI round-trip for this copy anywhere else it might be reused. After
// running, /barbershops renders in English and /barbershops-br in Portuguese.
// Finally run scripts/patch-landing-pt-copy.ts --apply: it upserts the en->pt
// identity rows for the Portuguese strings stored in the '-br' row.
//
// Content brief (2026-10-07): one page, one ask (call the demo number or send
// the lead form), built entirely from registered section types, with no new
// page component. Order: dark hero with the shop photo, "where a barbershop
// loses money", "what happens when a client calls", "what we set up" photo
// cards, pricing, a quiet NFC link, reviews, FAQ, closing lead form.
//
// Prices: Xkedule $89 a month, Xsites $299 starting and Xareable $49 a month
// are the live catalog numbers (curl https://skale.club/api/portfolio-services,
// checked 2026-09-30). Ads have no price on purpose: "we quote after we talk".
// This page is a snapshot, not a live read: if the numbers change in admin,
// re-copy them here and re-run this script.
//
// Per the site owner: never say "tech", "technology", "small company", or
// claim to be local. The `reviews` section is given its own title/subtitle
// props for exactly that reason: left as `props: {}` it falls back to
// company-settings' homepage copy, which mentions "technology".
// Text rule: no em dash or en dash, no "frase de efeito" (ad-cliche taglines),
// no three-parallel-items sentences, no three-item bullet lists. Write like a
// business owner, not a copywriter. Do not invent facts (contract terms, setup
// times, client counts, integrations).
//
// Hero CTA: HeroWebsitesSection always renders the form button as the primary
// (filled) pill and a tel: link only as the secondary (ghost) pill, so the
// demo line is the secondary CTA here, with the note under it.
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
// - All other IDs (nomeBarbearia, numeroCadeiras, tipoVisita,
//   enderecoBarbearia) fall through into form_leads.customAnswers (jsonb).
//   `enderecoBarbearia` is a conditional field shown only when
//   tipoVisita = presencial.
// - 2026-10-07: trimmed from 12 to 7 questions. numeroBarbeiros,
//   sistemaAgendamento, ticketMedio, investimentoAnuncios and observacoes were
//   dropped. Old leads keep those answers in customAnswers; the admin lead
//   dialog lists any answer without a configured question as a raw id/value
//   row (LeadDetailDialog.tsx extraCustomAnswers), so nothing is hidden.
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
    type: "phoneCountry", // inline country selector + phone input (44-03)
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
    id: "principalDesafio", // → native form_leads.principal_desafio column
    order: 6,
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
  // https://xphere.app/book/... page from the thank-you CTA. Do NOT remove it
  // and do NOT add a date/time question here: no such form question type exists.
  {
    id: "tipoVisita", // → customAnswers.tipoVisita
    order: 7,
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
];

const BARBERSHOP_LEADS_CONFIG: FormConfig = {
  questions: BARBERSHOP_LEADS_QUESTIONS,
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 }, // not scored — all leads land as `novo`
};

// ── Landing sections (in render order) ─────────────────────────────────────

// Sections are IDENTICAL for both languages: the pages.language column drives
// EN vs PT through t(). Copy is barbershop-specific (not the shared component
// defaults). Every image is a real file in client/public and is used once on
// the page. No bgVideoUrl: the /websites video asset is specific to that page.
const SCENES = "/industry-scenes";
const CATALOG = "/product-assets/catalog-2026-09";

export const LANDING_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      theme: "dark",
      eyebrow: "For barbershops",
      headline: "Your phone gets answered while you cut.",
      subheadline: "An AI picks up the call and books the cut. You keep working.",
      // Also the poster of the hero video. The video itself (bgVideoUrl) is
      // uploaded in Admin -> Pages -> Hero background video, per page (EN and
      // PT separately). Re-running this seed replaces the sections and drops
      // that video unless you add its bgVideoUrl here.
      backgroundImageUrl: `${SCENES}/barbershop.webp`,
      backgroundImageAlt: "Barber chair in a barbershop with a Google review plaque on the counter",
      ctaLabel: "Get more clients",
      secondaryCtaLabel: "Hear it working: (224) 551-6131",
      secondaryCtaHref: "tel:+12245516131",
      secondaryCtaNote: "That line is answered by an AI set up as a barbershop. Ask it a price, then book a cut.",
    },
  },
  {
    type: "featureGrid",
    props: {
      theme: "light",
      eyebrow: "The problem",
      heading: "Where a barbershop loses money",
      items: [
        {
          icon: "PhoneMissed",
          title: "The phone rings mid-cut",
          description: "You can't pick up with the clippers in your hand, so the client calls the next shop.",
        },
        {
          icon: "CalendarX",
          title: "No-shows",
          description: "Someone books Saturday at 10 and never shows up. That chair earned nothing.",
        },
        {
          icon: "CalendarClock",
          title: "Slow weekdays",
          description: "Friday is packed and Tuesday afternoon sits empty.",
        },
        {
          icon: "Smartphone",
          title: "Clients who belong to the app",
          description: "Book through a marketplace and your client sees every other shop nearby too.",
        },
      ],
    },
  },
  {
    type: "processStepper",
    props: {
      theme: "dark",
      eyebrow: "How it works",
      heading: "What happens when a client calls",
      subheading: "Call (224) 551-6131 and try it.",
      steps: [
        {
          title: "The client calls",
          description: "At 9pm or in the middle of a fade, the call gets picked up.",
        },
        {
          title: "The AI answers",
          description: "It knows your prices and your hours.",
        },
        {
          title: "The cut gets booked",
          description: "The appointment goes straight into your calendar.",
        },
        {
          title: "A reminder goes out",
          description: "The client gets a reminder before the visit, so fewer chairs sit empty.",
        },
      ],
      // Closed allowlist (processStepperIconNames): never an icon name outside it.
      icons: ["PhoneCall", "Bot", "CalendarCheck", "Bell"],
    },
  },
  {
    type: "featureGrid",
    props: {
      theme: "light",
      eyebrow: "What you get",
      heading: "What we set up for your shop",
      items: [
        {
          icon: "Globe",
          title: "A booking page for your shop",
          description: "Clients pick a time and book on a page with your shop's name.",
          imageUrl: `${CATALOG}/scheduling-system-home.webp`,
          imageAlt: "Booking page built with Xkedule",
        },
        {
          icon: "MessageCircle",
          title: "Calls and texts answered",
          description: "The AI replies any time of day and books the appointment.",
          imageUrl: `${CATALOG}/scheduling-system-dashboard.webp`,
          imageAlt: "Xkedule dashboard listing recent appointments",
        },
        {
          icon: "Instagram",
          title: "Posts every week",
          description: "Make posts with AI and schedule them, so your Instagram doesn't go quiet.",
          imageUrl: `${CATALOG}/xareable-home.webp`,
          imageAlt: "Xareable home page",
        },
        {
          icon: "Star",
          title: "More Google reviews",
          description: "A plaque on your counter. Clients tap their phone and land on your review page.",
          imageUrl: `${SCENES}/counter-plaque-v2.webp`,
          imageAlt: "NFC Google review plaque on a counter",
          href: "/products/nfc-review-plaque",
        },
      ],
    },
  },
  {
    // Prices are the live catalog: Xkedule $89 a month, Xsites $299 starting,
    // Xareable $49 a month. No plan images: the section above already shows
    // the Xkedule and Xareable screens.
    type: "pricingPlans",
    props: {
      theme: "dark",
      eyebrow: "Pricing",
      heading: "What it costs",
      subheading: "Same prices we charge everyone. Start with one.",
      ctaLabel: "Get more clients",
      plans: [
        {
          name: "Xkedule",
          title: "Booking and AI receptionist",
          price: "$89",
          priceUnit: "/month",
          highlight: true,
          features: ["Online booking with calendar sync", "Appointment reminders"],
        },
        {
          name: "Xsites",
          title: "Website",
          price: "$299",
          priceNote: "Starting price",
          features: ["A professional site for your shop", "Add pages as you grow"],
        },
        {
          name: "Xareable",
          title: "Social posts",
          price: "$49",
          priceUnit: "/month",
          features: ["Posts made with AI", "Post by hand or on a schedule"],
        },
      ],
      footnote: "Google and Instagram ads are priced around your budget, so we quote them after we talk.",
    },
  },
  {
    type: "linkCallout",
    props: {
      theme: "dark",
      text: "We also make NFC keychains with your shop's logo.",
      linkLabel: "See the keychains",
      href: "/nfc-keychains",
    },
  },
  {
    type: "reviews",
    props: {
      title: "What clients say",
      subtitle: "Reviews from businesses we've worked with.",
    },
  },
  {
    type: "faqAccordion",
    props: {
      theme: "light",
      eyebrow: "Questions",
      heading: "Before you call",
      subheading: "Short answers before you call or fill out the form.",
      items: [
        {
          question: "Do I have to buy everything?",
          answer: "No. Each product has its own price and you can start with one.",
        },
        {
          question: "Do the clients stay mine?",
          answer: "Yes. They book on your own page, not on a marketplace.",
        },
        {
          question: "Can you come to my shop?",
          answer: "You can ask for an in-person visit in the form, or pick a video call.",
        },
        {
          question: "How much do the ads cost?",
          answer: "It depends on how much you want to spend each month. We quote it after we talk about your shop.",
        },
      ],
    },
  },
  {
    // Light variant: it renders no image (imageUrl is dark-theme only), so none is set.
    type: "leadFormCta",
    props: {
      formSlug: FORM_SLUG,
      heading: "Let's fill your chairs",
      subheading: "Tell us about your shop. It takes a minute.",
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
