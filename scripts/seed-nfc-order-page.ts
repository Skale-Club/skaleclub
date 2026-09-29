// DEPRECATED: the order experience is now a dedicated full-screen client route.
// The explanatory guide and order form are now explicit React routes and need
// no page seed. Keep this file only as historical reference; do not run it.
//
// Seed the former NFC keychain ORDER pages (EN + PT).
// Idempotent: re-running updates both rows in place (same ids preserved).
//
// DRY-RUN by default: prints a diff. Add --apply to write.
// Run: npx tsx --env-file=.env scripts/seed-nfc-order-page.ts [--apply]
// Then: npx tsx --env-file=.env scripts/seed-nfc-order-translations.ts
//
// Creates / updates (2 rows):
//   pages WHERE slug = 'nfc-order'    (EN, language='en')  -> /nfc-order
//   pages WHERE slug = 'nfc-order-br' (PT, language='pt')  -> /br/nfc-order
//
// This page is for someone who has already decided and wants to ORDER. It is
// not the landing (/nfc-keychains, which sells the idea and answers the
// questions). The pitch is short and the form is one click away: the hero CTA
// clicks the leadFormCta button, so both buttons open the same modal.
//
// Both rows share SECTIONS; only language and alternateSlug differ (reciprocal
// alternateSlug drives hreflang). Copy is authored in ENGLISH, the t() source
// language, and served in Portuguese from the `translations` rows written by
// the companion script above.
//
// No price table (2026-09-22): the price lives in the order form (a live
// preview computed from shared/nfc-pricing.ts) and is confirmed on WhatsApp.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import type { PageSection } from "../shared/schema/pages.js";
import { seedForm, seedPage, withSeedGuard } from "./lib/seed-utils.js";
import { NFC_WHATSAPP_CTA } from "../shared/nfc-whatsapp.js";

const ORDER_FORM_SLUG = "nfc-keychain-order";

// ── Sections ───────────────────────────────────────────────────────────────

export const SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      theme: "dark",
      headline: "Order your NFC keychains",
      subheadline:
        "Choose how many you need, send us your logo, and we confirm every detail with you before anything is produced.",
      ctaLabel: "Start my order",
      secondaryCtaLabel: "See how they work",
      secondaryCtaHref: "/nfc-keychains",
      backgroundImageUrl: "/nfc-keychains-hero.webp",
      backgroundImageAlt: "Custom 3D-printed NFC keychains in different designs",
      // Pre-filled message per page language carries the Xphere agent's keyword
      // ("keychains" EN / "chaveiros" PT) — see shared/nfc-whatsapp.ts.
      whatsapp: NFC_WHATSAPP_CTA,
    },
  },
  // No price table (2026-09-22): the form below shows the exact price as a
  // preview and the final total is confirmed on WhatsApp.
  {
    type: "processStepper",
    props: {
      theme: "dark",
      eyebrow: "What happens next",
      heading: "From your order to keychains in hand",
      subheading: "Sending the form does not charge you anything. You approve every step before we move on.",
      steps: [
        {
          title: "You send the order",
          description:
            "Quantity, what the tap should open, your logo and where to ship. It takes about a minute, and you can stop and come back — your answers are saved.",
        },
        {
          title: "We call you",
          description:
            "We review whether we can produce what you asked for and call you on WhatsApp to confirm the quantity, the artwork and the final total.",
        },
        {
          title: "You approve the art",
          description:
            "We prepare your logo for 3D printing and send you the design. Nothing goes into production until you say yes.",
        },
        {
          title: "We produce and ship",
          description:
            "Each keychain is printed with your design, the NFC tag inside is programmed with your link and tested, then shipped to your address.",
        },
      ],
      icons: ["Package", "MessageCircle", "PenTool", "Truck"],
    },
  },
  {
    type: "contentBlocks",
    props: {
      theme: "dark",
      eyebrow: "Before you start",
      heading: "What we need from you",
      subheading: "Two things, and the form asks for both.",
      blocks: [
        {
          heading: "Your logo",
          paragraphs: [
            "Upload it as a PNG, JPG, WEBP or PDF. The sharper the file, the better the print comes out.",
            "No logo file? Upload the best version you have — a clear photo or a screenshot usually works, and the first-order art fee covers preparing it for 3D printing. If you have no logo at all, we create the artwork for you.",
          ],
        },
        {
          heading: "The link the tap should open",
          paragraphs: [
            "Your Google review page, Instagram, digital business card, menu or website. You pick it in the form, and we set it up with you on the call.",
          ],
          bullets: [
            "Point the tag at a link you control, like a page on your own site",
            "That way you can redirect it later without touching the keychains",
          ],
        },
      ],
    },
  },
  {
    type: "faqAccordion",
    props: {
      theme: "dark",
      eyebrow: "FAQ",
      heading: "What people ask before sending an order",
      subheading: "Short answers, so you can decide without waiting for a reply.",
      items: [
        {
          question: "Does sending this form place an order?",
          answer:
            "No. It sends us an order request. We check that we can produce what you asked for and call you to confirm everything. Nothing is charged on this page.",
        },
        {
          question: "Is the price I see here final?",
          answer:
            "It is an estimate built from the quantity and the type of keychain you picked. We confirm the final total with you before anything is produced, so there are no surprises.",
        },
        {
          question: "When do I pay?",
          answer:
            "After we confirm your order on the call. Payment is 100% upfront, and production starts once it clears and you have approved the artwork.",
        },
        {
          question: "Can I change the quantity after sending the form?",
          answer:
            "Yes, right up until you approve the artwork. Tell us on the call and we re-quote at the price for the new quantity.",
        },
        {
          question: "Why is the minimum 20 pieces?",
          answer:
            "Every order is set up, designed, printed and programmed as a batch, so a very small run does not make sense for either side. Twenty is enough to put one at every point of contact and still hand some out.",
        },
      ],
    },
  },
  {
    type: "leadFormCta",
    props: {
      theme: "dark",
      formSlug: ORDER_FORM_SLUG,
      heading: "Ready to order?",
      subheading: "About a minute to fill in. We confirm everything with you on WhatsApp before producing anything.",
      ctaLabel: "Start my order",
      whatsapp: NFC_WHATSAPP_CTA,
    },
  },
];

// ── Page specs ─────────────────────────────────────────────────────────────

type PageSpec = { slug: string; name: string; language: "en" | "pt"; alternateSlug: string };

const SPECS: PageSpec[] = [
  { slug: "nfc-order", name: "NFC Order (EN)", language: "en", alternateSlug: "nfc-order-br" },
  { slug: "nfc-order-br", name: "NFC Order (PT)", language: "pt", alternateSlug: "nfc-order" },
];

async function seed(apply: boolean) {
  console.log("Seeding NFC order pages...");
  for (const spec of SPECS) await seedPage({ ...spec, sections: SECTIONS }, apply);
}

// Only seed when run directly. Importing this file (to check SECTIONS against
// the section prop schemas, say) must not open a connection or write anything.
const runDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (runDirectly) {
  void withSeedGuard(seed);
 else {
  console.log("[seed-nfc-order-page] imported, not run directly: nothing executed");
}
