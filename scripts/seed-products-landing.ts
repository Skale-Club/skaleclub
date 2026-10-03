// Seed the /products group page + its two product detail pages, and the
// per-product lead forms they each open.
//
// Idempotent: re-running updates all rows in place (same row ids preserved).
// DRY-RUN by default: prints a diff. Add --apply to write (old rows are
// snapshotted into content_revisions first).
//
// Run: npx tsx --env-file=.env scripts/seed-products-landing.ts [--apply]
//
// Creates / updates (9 rows):
//   1. forms  WHERE slug = 'products-leads'                  (generic — group page)
//   2. forms  WHERE slug = 'nfc-review-plaque-leads'
//   3. forms  WHERE slug = 'nfc-custom-keychains-leads'
//   4. pages  WHERE slug = 'products'                        -> served at /products (EN)
//   5. pages  WHERE slug = 'products-br'                     -> served at /br/products (PT)
//   6. pages  WHERE slug = 'nfc-review-plaque'                -> served at /products/nfc-review-plaque (EN)
//   7. pages  WHERE slug = 'nfc-review-plaque-br'              -> served at /br/products/nfc-review-plaque (PT)
//   8. pages  WHERE slug = 'nfc-custom-keychains'              -> served at /products/nfc-keychains (EN)
//   9. pages  WHERE slug = 'nfc-custom-keychains-br'           -> served at /br/products/nfc-keychains (PT)
//
// All three pages are built ONLY from already-registered section types
// (heroWebsites, featureGrid, contentBlocks, leadFormCta; the review plaque
// page also uses trustBadges, processStepper, faqAccordion) — the same building
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
// Bilingual, same as /barbershops: each page is an EN/PT pair sharing the
// SAME sections array (copy is t()-based, driven by the pages.language
// column). seedPage() bakes the curated pt-BR copy from
// scripts/data/landing-pt-copy.ts straight into every "-br" row automatically
// (scripts/lib/pt-copy.ts) — no separate translations-table seed for these
// pages, on purpose (see O4 in scripts/seed-barbershop-translations.ts for
// why that table is scoped tightly and not the default choice here).
//
// No pricing on the /products group page or the keychain product page: those
// are quoted per order ("Ask for a quote"). The review plaque page DOES show
// prices (read from shared/nfc-plaque-pricing.ts) and its closing CTA opens the
// priced plaque order form (scripts/seed-nfc-plaque-order-form.ts).
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { seedForm, seedPage, withSeedGuard } from "./lib/seed-utils.js";
import { type PageSection } from "../shared/schema/pages.js";
import type { FormConfig, FormQuestion } from "../shared/schema/forms.js";
import { NFC_PLAQUE_PRICES, quotePlaqueOrder } from "../shared/nfc-plaque-pricing.js";

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
    items: [
      {
        icon: "IdCard",
        title: "Barbershops",
        description: "At the chair or the front desk.",
        imageUrl: "/industry-scenes/barbershop.webp",
        imageAlt: "A classic barber chair inside a barbershop",
      },
      {
        icon: "ConciergeBell",
        title: "Salons",
        description: "At reception or at the styling station.",
        imageUrl: "/industry-scenes/salon.webp",
        imageAlt: "Mirrors and styling chairs inside a hair salon",
      },
      {
        icon: "UtensilsCrossed",
        title: "Restaurants",
        description: "On the table or by the register.",
        imageUrl: "/industry-scenes/restaurant.webp",
        imageAlt: "Dining tables set inside a restaurant",
      },
      {
        icon: "Store",
        title: "Any counter",
        description: "Front desk, register, waiting area.",
        imageUrl: "/industry-scenes/counter.webp",
        imageAlt: "A customer paying by card at a service counter",
      },
    ],
  },
};

// ── /products (group page) ──────────────────────────────────────────────

export const PRODUCTS_SECTIONS: PageSection[] = [
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

// Product renders (client/public/, transparent WebP): Blender renders of the real
// Fusion model, made by "3D Printing/NFC Plaque/source/render/render_previews.py".
// Re-render there and re-export the WebPs when the plaque design changes.
const PLAQUE_PAIR = { src: "/nfc-plaque-pair.webp", alt: "Google Review and Instagram NFC plaques side by side" };
const PLAQUE_GOOGLE = { src: "/nfc-plaque-google.webp", alt: "Google Review NFC plaque with a QR code, on its black stand" };
const PLAQUE_INSTAGRAM = { src: "/nfc-plaque-instagram.webp", alt: "Instagram NFC plaque with the logo in silk filament" };

// The closing CTA opens the PRICED order form (scripts/seed-nfc-plaque-order-form.ts),
// the same pattern as the keychain landing. PLAQUE_FORM_SLUG (the unpriced
// quote form above) stays seeded so its existing leads remain reachable.
const PLAQUE_ORDER_FORM_SLUG = "nfc-plaque-order";

// Facts this copy relies on (Notion, 2026-10-02: plaque design brief + price
// projection). Do not add claims beyond these without checking:
//   - Every plaque has an NFC chip AND a QR code ("tap or scan").
//   - Standard plaque = our ready-made Google Review or Instagram design,
//     nothing of the customer printed; chip and QR go through a Smart Tags link
//     (skale.club/n|q/<code>), so the destination can change and taps/scans are
//     counted.
//   - Custom plaque = the customer's logo / name / @; chip and QR open the
//     customer's own link directly (no Smart Tags), so the link is fixed at print.
//   - Prices come from shared/nfc-plaque-pricing.ts (NFC_PLAQUE_PRICES), never typed here.
//   - Google's review policy bans incentives and asking only happy customers.
//   - No turnaround number: the window is confirmed at approval.
const usd = (cents: number) => `$${cents / 100}`;
const PP = NFC_PLAQUE_PRICES;
const PLAQUE_PRICE_FAQ =
  `Standard plaques (Google Review or Instagram) are ${usd(PP.standardUnitCents)} each, or 2 for ${usd(PP.standardPairCents)}. ` +
  `Custom plaques with your brand are ${usd(PP.customFirstCents)} for the first and ${usd(PP.customAdditionalCents)} for each additional one. ` +
  "You see the total in the order form, and we confirm it with you before production.";

export const NFC_REVIEW_PLAQUE_SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      theme: "dark",
      eyebrow: "NFC review plaque",
      headline: "More Google reviews, right from your counter.",
      subheadline:
        "A 3D-printed plaque for your counter. A customer taps their phone or scans the QR code and your Google review page opens. No app, no searching, no typing.",
      ctaLabel: "Order your plaque",
      secondaryCtaLabel: "See how it works",
      secondaryCtaHref: "#how-it-works",
      backgroundImageUrl: PLAQUE_PAIR.src,
      backgroundImageAlt: PLAQUE_PAIR.alt,
    },
  },
  {
    type: "trustBadges",
    props: {
      theme: "dark",
      badges: [
        { title: "Programmed and tested", description: "Every NFC tag is checked before shipping", icon: "badgecheck" },
        { title: "Tap or scan", description: "NFC chip and QR code on every plaque", icon: "sparkles" },
        { title: "No app required", description: "Works with modern iPhone and Android phones", icon: "zap" },
      ],
    },
  },
  {
    type: "contentBlocks",
    props: {
      theme: "light",
      eyebrow: "Why it matters",
      imageUrl: PLAQUE_GOOGLE.src,
      imageAlt: PLAQUE_GOOGLE.alt,
      imageSide: "right",
      heading: "Reviews are how new customers choose you",
      subheading: "Before visiting a business for the first time, people check its rating on Google.",
      blocks: [
        {
          heading: "Reviews help you show up on Google Maps",
          paragraphs: [
            "Google says the number of reviews and the rating are part of how it ranks local businesses. More recent, real reviews make you easier to find and easier to pick over the shop down the street.",
          ],
        },
        {
          heading: "Happy customers forget to review",
          paragraphs: [
            "Plenty of customers who liked the service would leave a review if it were easy. The problem is the path: open Google, search your name, find the button, start typing. By the time they get home, they have moved on.",
          ],
        },
        {
          heading: "The plaque removes the steps",
          paragraphs: [
            "With the plaque on the counter, the review page is one tap away while the visit is still fresh. Your team can point to it at checkout instead of asking customers to look you up later.",
          ],
          bullets: [
            "Opens your Google review page directly",
            "Works while the customer is still in your shop",
            "Gives your team an easy way to ask for a review",
          ],
        },
      ],
    },
  },
  {
    type: "processStepper",
    props: {
      theme: "dark",
      anchorId: "how-it-works",
      eyebrow: "How it works",
      heading: "From first message to your first review in 4 steps",
      subheading: "You approve every step before we move on.",
      steps: [
        {
          title: "Choose your plaque",
          description: "Pick the Google Review, Instagram or custom plaque and how many you need. You see the price right in the form.",
        },
        {
          title: "Send your link",
          description: "Tell us your review page or profile. For a custom plaque, send your logo and approve the design before anything is printed.",
        },
        {
          title: "We print and program",
          description: "The plaque is 3D-printed, and the NFC chip and the QR code are linked to your page and tested.",
        },
        {
          title: "Put it on the counter",
          description: "Your plaque arrives ready to use. Place it where customers pay or wait and the reviews start coming in.",
        },
      ],
      icons: ["Nfc", "Link2", "Factory", "Star"],
    },
  },
  {
    type: "contentBlocks",
    props: {
      theme: "light",
      eyebrow: "Two ways to order",
      imageUrl: PLAQUE_INSTAGRAM.src,
      imageAlt: PLAQUE_INSTAGRAM.alt,
      imageSide: "left",
      heading: "Standard or custom",
      subheading: "Both are 3D-printed, programmed and tested before they ship.",
      blocks: [
        {
          heading: "Standard plaque",
          paragraphs: [
            "Our ready-made Google Review or Instagram design. The tap and the QR go through a Skale Club link that sends customers to your page.",
          ],
          bullets: [
            "If your page changes, we update the link and the plaque keeps working",
            "We can see how many times it was tapped or scanned",
          ],
        },
        {
          heading: "Custom plaque",
          paragraphs: [
            "Your logo, name or @ printed on the plaque. The tap and the QR open your own link directly, so the destination is set when we print it.",
          ],
          bullets: ["Your brand on the counter", "You approve the design before printing"],
        },
      ],
    },
  },
  {
    // One card per way to order, so the two price rules read as two choices
    // (a flat list of four price rows did not). Examples come from the same
    // quote function the order form uses.
    type: "pricingPlans",
    props: {
      theme: "dark",
      eyebrow: "Pricing",
      heading: "Simple, upfront pricing",
      subheading: "No hidden fees. You know the total before we start.",
      ctaLabel: "Order your plaque",
      plans: [
        {
          name: "Standard",
          title: "Google Review or Instagram",
          price: usd(PP.standardUnitCents),
          priceUnit: "per plaque",
          priceNote: `or 2 for ${usd(PP.standardPairCents)}`,
          features: ["Our ready-made design", "We can change the link anytime", "We see every tap and scan"],
          example: `3 plaques: ${usd(quotePlaqueOrder({ quantity: 3, typeId: "google" }).totalCents)}`,
        },
        {
          name: "Custom",
          title: "Your brand on the plaque",
          price: usd(PP.customFirstCents),
          priceUnit: "first plaque",
          priceNote: `${usd(PP.customAdditionalCents)} each additional`,
          features: ["Your logo, name or @", "Custom artwork included", "Opens your own link directly"],
          example: `3 plaques: ${usd(quotePlaqueOrder({ quantity: 3, typeId: "custom" }).totalCents)}`,
          highlight: true,
        },
      ],
      footnote: "No payment in the order form. We confirm the total with you on WhatsApp before production.",
    },
  },
  MADE_FOR_SECTION,
  {
    type: "faqAccordion",
    props: {
      theme: "dark",
      eyebrow: "FAQ",
      heading: "Questions people ask before ordering",
      subheading: "Everything you need to decide, without waiting for a reply.",
      items: [
        {
          question: "Do my customers need to install an app?",
          answer:
            "No. Modern iPhones and Android phones read NFC natively, the same way they handle tap-to-pay. The customer holds the phone near the plaque and the review page opens.",
        },
        {
          question: "Does it work with every phone?",
          answer:
            "The tap works with modern iPhones and with Android phones that have NFC turned on. Any phone with a camera can scan the QR code on the plaque instead.",
        },
        {
          question: "Does the plaque need batteries or Wi-Fi?",
          answer:
            "No. The NFC tag has no battery: the phone powers it during the tap. The page opens using the customer's own mobile data or Wi-Fi.",
        },
        {
          question: "Can I change where the plaque points later?",
          answer:
            "On the standard plaque, yes: the tap and the QR go through a Skale Club link, and we change where it sends people without touching the plaque. On the custom plaque they open your own link directly, so it is set when we print it.",
        },
        {
          question: "Can I offer a discount in exchange for a review?",
          answer:
            "No. Google's rules do not allow rewards for reviews, or asking only the customers you think are happy. The plaque helps you ask everyone in a simple way, which is exactly what Google allows.",
        },
        { question: "How much does it cost?", answer: PLAQUE_PRICE_FAQ },
        {
          question: "How long does it take?",
          answer:
            "The production and delivery window is confirmed with you when your order is approved, so you know what to expect before you commit.",
        },
        {
          question: "Can I order more than one?",
          answer:
            "Yes, up to 10 in the order form: one at the register, others at reception or on the tables. For more than 10, tell us in the last question of the form.",
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      theme: "dark",
      formSlug: PLAQUE_ORDER_FORM_SLUG,
      heading: "Ready to get more reviews?",
      subheading:
        "About a minute to fill in. You see the price as you choose the plaque and quantity, and we confirm everything with you on WhatsApp before producing anything. Sending the form costs nothing.",
      ctaLabel: "Order your plaque",
      imageUrl: PLAQUE_PAIR.src,
      imageAlt: PLAQUE_PAIR.alt,
    },
  },
];

// ── /products/nfc-custom-keychains ─────────────────────────────────────────
// Public path /products/nfc-keychains; DB slug is "nfc-custom-keychains" —
// see the file header for why it can't be "nfc-keychains".

export const NFC_KEYCHAINS_SECTIONS: PageSection[] = [
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
      subheading: "Nothing to install. It works with the phone your customer already has.",
      blocks: [
        {
          heading: "No app, nothing to type",
          paragraphs: [
            "A customer holds their phone near the keychain. It opens the link you picked. Most shops use their booking page or their Google reviews.",
          ],
        },
      ],
    },
  },
  MADE_FOR_SECTION,
  {
    type: "contentBlocks",
    props: {
      eyebrow: "Customization",
      heading: "Made to order",
      subheading: "Printed with your branding, one piece at a time.",
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
      subheading: "Keychains your customers can buy on the spot.",
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

  // Each pair shares the SAME sections array; seedPage() bakes the pt-BR copy
  // into the "-br" row (scripts/data/landing-pt-copy.ts) when language is "pt".
  const PAGES: Array<{ slug: string; name: string; language: "en" | "pt"; alternateSlug: string; sections: PageSection[] }> = [
    { slug: "products", name: "Products (EN)", language: "en", alternateSlug: "products-br", sections: PRODUCTS_SECTIONS },
    { slug: "products-br", name: "Products (PT)", language: "pt", alternateSlug: "products", sections: PRODUCTS_SECTIONS },
    { slug: "nfc-review-plaque", name: "NFC Review Plaque (EN)", language: "en", alternateSlug: "nfc-review-plaque-br", sections: NFC_REVIEW_PLAQUE_SECTIONS },
    { slug: "nfc-review-plaque-br", name: "NFC Review Plaque (PT)", language: "pt", alternateSlug: "nfc-review-plaque", sections: NFC_REVIEW_PLAQUE_SECTIONS },
    { slug: "nfc-custom-keychains", name: "NFC Keychains product (EN)", language: "en", alternateSlug: "nfc-custom-keychains-br", sections: NFC_KEYCHAINS_SECTIONS },
    { slug: "nfc-custom-keychains-br", name: "NFC Keychains product (PT)", language: "pt", alternateSlug: "nfc-custom-keychains", sections: NFC_KEYCHAINS_SECTIONS },
  ];
  for (const spec of PAGES) await seedPage(spec, apply);
}

// Only seed when run directly: importing the section arrays (patch scripts,
// a pt-copy coverage check) must not open a connection or write anything.
const runDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (runDirectly) void withSeedGuard(main);
else console.log("[seed-products-landing] imported, not run directly: nothing executed");
