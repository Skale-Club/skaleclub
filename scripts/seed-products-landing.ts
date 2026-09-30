// Seed the /products group page + its two product detail pages, and the
// per-product lead forms they each open.
//
// Idempotent: re-running updates all rows in place (same row ids preserved).
// DRY-RUN by default: prints a diff. Add --apply to write (old rows are
// snapshotted into content_revisions first).
//
// Run: npx tsx --env-file=.env scripts/seed-products-landing.ts [--apply]
//
// Creates / updates (6 rows):
//   1. forms  WHERE slug = 'products-leads'              (generic — group page)
//   2. forms  WHERE slug = 'nfc-review-plaque-leads'
//   3. forms  WHERE slug = 'nfc-custom-keychains-leads'
//   4. pages  WHERE slug = 'products'                     -> served at /products
//   5. pages  WHERE slug = 'nfc-review-plaque'            -> served at /products/nfc-review-plaque
//   6. pages  WHERE slug = 'nfc-custom-keychains'         -> served at /products/nfc-custom-keychains
//
// All three pages are built ONLY from already-registered section types
// (heroWebsites, featureGrid, contentBlocks, leadFormCta) — the same building
// blocks scripts/seed-nfc-keychains-landing.ts and scripts/seed-barbershop-landing.ts
// use, in the same hero -> content -> closing-CTA shape. No new page
// component and no new section type were created for this.
//
// Two small, deliberate additions to EXISTING sections were needed and are
// documented where they live:
//   - heroWebsites gained an optional "tel:" secondaryCtaHref + secondaryCtaNote
//     (client/src/components/pages/sections/HeroWebsitesSection.tsx) — not used
//     by this file, added for the /barbershops hero's phone CTA.
//   - featureGrid items gained an optional root-relative `href`, making a card
//     a link to its own page with no visual change otherwise
//     (client/src/components/pages/sections/FeatureGridSection.tsx) — THIS is
//     what makes the /products group page's cards clickable.
//
// Nested URL note: DynamicLanding's catch-all route is single-segment
// ("/:slug"), so /products/<slug> needed one more route in client/src/App.tsx
// ("/products/:slug", added right above the catch-all), a matching branch in
// server/seo/routes.ts's resolveRoute (same lookup, server-side), and an
// explicit URL-segment -> DB-slug map, shared/landingSeo.ts's PRODUCT_ROUTES,
// that BOTH of those read instead of trusting the URL segment as the DB slug.
// PRODUCT_ROUTES also drives landingPathForSlug/slugForLandingPath, so the
// canonical URL, sitemap and crawler meta injection all say "/products/<slug>"
// instead of "/<slug>", and an unmapped /products/<anything-else> is a real
// 404 (never a lookup against some other row). The keychains product's DB
// slug is "nfc-custom-keychains", not "nfc-keychains" — that slug is already
// the existing NFC keychains ad-landing / pricing page at the TOP-LEVEL
// /nfc-keychains, a different page with different content; reusing it here
// would make DynamicLanding render that page's content under /products
// instead of this one. Its bare URL segment ("nfc-review-plaque", whose DB
// slug happens to equal it) also 301s away from the un-namespaced
// /nfc-review-plaque — see server/canonicalHost.ts and the matching
// client-side Route in App.tsx.
//
// English only for now — not requested in Portuguese, and these pages have no
// "-br" counterpart or translations table entry. Cheap to add later the same
// way scripts/seed-barbershop-translations.ts does it for /barbershops.
//
// No pricing anywhere on these three pages: both products are quoted per
// order ("Ask for a quote"), matching the brief.
import "dotenv/config";
import { seedForm, seedPage, withSeedGuard } from "./lib/seed-utils.js";
import { type PageSection } from "../shared/schema/pages.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";

// ── Shared "what kind of business" question, reused by both product forms ──

const BUSINESS_TYPE_OPTIONS = [
  { value: "barbershop",  label: "Barbershop",          points: 0 },
  { value: "salon",       label: "Salon",                points: 0 },
  { value: "restaurant",  label: "Restaurant",            points: 0 },
  { value: "other",       label: "Other",                 points: 0 },
] as const;

function productLeadQuestions(): FormQuestion[] {
  return [
    { id: "nome", order: 1, title: "What's your name?", type: "text", required: true, placeholder: "Your full name" },
    { id: "telefone", order: 2, title: "What's your WhatsApp?", type: "phoneCountry", required: true, placeholder: "(555) 123-4567" },
    { id: "email", order: 3, title: "What's your email?", type: "email", required: true, placeholder: "you@yourbusiness.com" },
    { id: "nomeNegocio", order: 4, title: "What's the name of your business?", type: "text", required: true, placeholder: "Your business name" },
    {
      id: "tipoNegocio",
      order: 5,
      title: "What kind of business is it?",
      type: "select",
      required: true,
      options: BUSINESS_TYPE_OPTIONS.map((o) => ({ ...o })),
    },
    { id: "observacoes", order: 6, title: "Anything else we should know?", type: "text", required: false, placeholder: "Optional" },
  ];
}

const leadFormConfig = (): FormConfig => ({
  questions: productLeadQuestions(),
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 }, // not scored — all leads land as `novo`
});

// ── Forms ────────────────────────────────────────────────────────────────

const PRODUCTS_FORM_SLUG = "products-leads";
const PLAQUE_FORM_SLUG = "nfc-review-plaque-leads";
const KEYCHAINS_FORM_SLUG = "nfc-custom-keychains-leads";

// ── "Made for" feature grid, shared by both product pages ─────────────────

const MADE_FOR_SECTION: PageSection = {
  type: "featureGrid",
  props: {
    eyebrow: "Made for",
    heading: "Works anywhere customers pause",
    subheading: "Works anywhere a customer stops for a moment.",
    items: [
      { icon: "IdCard", title: "Barbershops", description: "At the chair or the front desk." },
      { icon: "ConciergeBell", title: "Salons", description: "At reception or at the styling station." },
      { icon: "UtensilsCrossed", title: "Restaurants", description: "On the table or by the register." },
      { icon: "Store", title: "Any counter", description: "Anywhere a customer pauses for a few seconds." },
    ],
  },
};

// ── /products (group page) ──────────────────────────────────────────────

const PRODUCTS_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "Products",
      subheadline: "Things we make for your counter.",
      ctaLabel: "Ask about a product",
    },
  },
  {
    type: "featureGrid",
    props: {
      eyebrow: "Made in-house",
      heading: "What we make",
      subheading: "Two things, each with its own page.",
      items: [
        {
          icon: "Nfc",
          title: "NFC review plaque",
          description: "A plaque for your counter that opens your Google review page in one tap.",
          href: "/products/nfc-review-plaque",
        },
        {
          icon: "KeyRound",
          title: "NFC keychains",
          description: "Custom keychains with your branding, plus a display to sell them at your counter.",
          href: "/products/nfc-keychains",
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      formSlug: PRODUCTS_FORM_SLUG,
      heading: "Not sure which one you need?",
      subheading: "Tell us about your business in a minute and we'll point you to the right one.",
      ctaLabel: "Ask about a product",
    },
  },
];

// ── /products/nfc-review-plaque ────────────────────────────────────────────

const NFC_REVIEW_PLAQUE_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "NFC review plaque",
      subheadline: "A plaque for your counter. Tap a phone on it and it opens your Google review page.",
      ctaLabel: "Ask for a quote",
      // No dedicated photo exists yet for this product — see the file header.
      // Falls back to the site's generic brand illustration, not a stock photo.
    },
  },
  {
    type: "contentBlocks",
    props: {
      eyebrow: "How it works",
      heading: "What happens when someone taps it",
      blocks: [
        {
          heading: "No app, nothing to type",
          paragraphs: [
            "A customer holds their phone near the plaque. It opens your Google review page right away, while the visit is still fresh in their mind.",
          ],
        },
      ],
    },
  },
  MADE_FOR_SECTION,
  {
    type: "contentBlocks",
    props: {
      eyebrow: "Make it yours",
      heading: "Made your way",
      blocks: [
        {
          heading: "What we print",
          paragraphs: ["We print it with your logo and colors, and the text you want on it."],
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      formSlug: PLAQUE_FORM_SLUG,
      heading: "Ask for a quote",
      subheading: "Tell us about your business in a minute. There's no set price. We quote based on what you need.",
      ctaLabel: "Ask for a quote",
    },
  },
];

// ── /products/nfc-custom-keychains ─────────────────────────────────────────
// Public path /products/nfc-keychains; DB slug is "nfc-custom-keychains" —
// see the file header for why it can't be "nfc-keychains".

const NFC_KEYCHAINS_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "NFC keychains",
      subheadline: "Custom keychains with your branding. The tap opens the link you choose.",
      ctaLabel: "Ask for a quote",
      backgroundImageUrl: "/nfc-keychains-hero.webp",
      backgroundImageAlt: "Custom 3D-printed NFC keychains with a business logo",
    },
  },
  {
    type: "contentBlocks",
    props: {
      eyebrow: "How it works",
      heading: "What happens when someone taps it",
      blocks: [
        {
          heading: "No app, nothing to type",
          paragraphs: [
            "A customer holds their phone near the keychain. It opens the link you picked, your booking page, Instagram, or your reviews.",
          ],
        },
      ],
    },
  },
  MADE_FOR_SECTION,
  {
    type: "contentBlocks",
    props: {
      eyebrow: "Make it yours",
      heading: "Made your way",
      blocks: [
        {
          heading: "What we print",
          paragraphs: ["We print the keychain with your branding and program the tag with the link you pick."],
        },
      ],
    },
  },
  {
    type: "contentBlocks",
    props: {
      eyebrow: "Extra revenue",
      heading: "A display for your counter",
      theme: "dark",
      blocks: [
        {
          heading: "Sell them yourself",
          paragraphs: [
            "We also make a display for your counter so you can sell the keychains yourself.",
            "It brings in a bit of extra money for the shop.",
          ],
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      formSlug: KEYCHAINS_FORM_SLUG,
      heading: "Ask for a quote",
      subheading: "Tell us about your business in a minute. There's no set price. We quote based on what you need.",
      ctaLabel: "Ask for a quote",
    },
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────

async function main(apply: boolean) {
  await seedForm(
    { slug: PRODUCTS_FORM_SLUG, name: "Products Leads", description: "Leads for the /products group page — not sure which product they need.", config: leadFormConfig(), isActive: true, isDefault: false },
    apply,
  );
  await seedForm(
    { slug: PLAQUE_FORM_SLUG, name: "NFC Review Plaque Leads", description: "Leads for /products/nfc-review-plaque.", config: leadFormConfig(), isActive: true, isDefault: false },
    apply,
  );
  await seedForm(
    { slug: KEYCHAINS_FORM_SLUG, name: "NFC Custom Keychains Leads", description: "Leads for /products/nfc-keychains (DB slug nfc-custom-keychains).", config: leadFormConfig(), isActive: true, isDefault: false },
    apply,
  );

  await seedPage({ slug: "products", name: "Products", language: "en", sections: PRODUCTS_SECTIONS }, apply);
  await seedPage({ slug: "nfc-review-plaque", name: "NFC Review Plaque", language: "en", sections: NFC_REVIEW_PLAQUE_SECTIONS }, apply);
  await seedPage({ slug: "nfc-custom-keychains", name: "NFC Keychains (product)", language: "en", sections: NFC_KEYCHAINS_SECTIONS }, apply);
}

void withSeedGuard(main);
