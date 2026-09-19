// Seed the NFC keychain ORDER pages (EN + PT).
// Idempotent: re-running updates both rows in place (same ids preserved).
//
// Run: npx tsx --env-file=.env scripts/seed-nfc-order-page.ts
// Then: npx tsx --env-file=.env scripts/seed-nfc-order-translations.ts
//
// Creates / updates (2 rows):
//   pages WHERE slug = 'nfc-order'    (EN, language='en')  -> /nfc-order
//   pages WHERE slug = 'nfc-order-br' (PT, language='pt')  -> /br/nfc-order
//
// This page is for someone who has already decided and wants to ORDER. It is
// not the ad landing (/nfc-keychains, which sells the idea) nor the pricing
// explainer (/nfc-pricing, which answers objections). The pitch is short, the
// price ladder is high on the page, and the form is one click away — the hero
// CTA clicks the leadFormCta button, so both buttons open the same modal.
//
// Both rows share SECTIONS; only language and alternateSlug differ (reciprocal
// alternateSlug drives hreflang). Copy is authored in ENGLISH, the t() source
// language, and served in Portuguese from the `translations` rows written by
// the companion script above.
//
// The price ladder is GENERATED from shared/nfc-pricing.ts rather than typed
// out, so the page cannot quote a price the form does not charge. Editing the
// tiers and re-running this script is what keeps them in step — until then the
// stored row holds the numbers from the last run.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { pool, db } from "../server/db.js";
import { pages, type PageSection } from "../shared/schema/pages.js";
import {
  NFC_ART_FEE_CENTS,
  NFC_QUANTITY,
  NFC_VOLUME_TIERS,
  formatUsdCents,
  tierUnitPriceCents,
} from "../shared/nfc-pricing.js";

const ORDER_FORM_SLUG = "nfc-keychain-order";

// ── Price ladder, derived ──────────────────────────────────────────────────

type PriceLine = { label: string; price: string; note?: string; kind: "one-time" | "per-unit" | "minimum" };

function buildPriceLines(): PriceLine[] {
  const reachable = NFC_VOLUME_TIERS.filter((tier) => tier.minQuantity <= NFC_QUANTITY.max);

  const tierLines: PriceLine[] = reachable.map((tier, index) => {
    const next = reachable[index + 1];
    const upper = next ? next.minQuantity - 1 : NFC_QUANTITY.max;
    return {
      label: `${tier.minQuantity}-${upper} pieces`,
      price: `${formatUsdCents(tier.unitPriceCents)} each`,
      kind: "per-unit",
    };
  });

  const minimumTotal = tierUnitPriceCents(NFC_QUANTITY.min) * NFC_QUANTITY.min;

  return [
    ...tierLines,
    {
      label: "Minimum order",
      price: formatUsdCents(minimumTotal),
      note: `${NFC_QUANTITY.min} pieces`,
      kind: "minimum",
    },
    {
      label: "Art / design fee",
      price: formatUsdCents(NFC_ART_FEE_CENTS),
      note: "First order only — waived from your second order onward",
      kind: "one-time",
    },
  ];
}

// ── Sections ───────────────────────────────────────────────────────────────

export const SECTIONS: PageSection[] = [
  {
    type: "heroWebsites",
    props: {
      headline: "Order your NFC keychains",
      subheadline:
        "Choose how many you need, send us your logo, and we confirm every detail with you before anything is produced.",
      ctaLabel: "Start my order",
      secondaryCtaLabel: "See how they work",
      secondaryCtaHref: "/nfc-pricing",
      backgroundImageUrl: "/nfc-keychains-hero.webp",
      backgroundImageAlt: "Custom 3D-printed NFC keychains in different designs",
    },
  },
  {
    type: "pricingTable",
    props: {
      theme: "dark",
      eyebrow: "Pricing",
      heading: "The more you order, the less each one costs",
      subheading: "The form adds this up for you as you choose the quantity.",
      lines: buildPriceLines(),
      footnote: "100% payment upfront, after we confirm your order. Production starts once payment clears.",
    },
  },
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
    },
  },
];

// ── Page specs ─────────────────────────────────────────────────────────────

type PageSpec = { slug: string; name: string; language: "en" | "pt"; alternateSlug: string };

const SPECS: PageSpec[] = [
  { slug: "nfc-order", name: "NFC Order (EN)", language: "en", alternateSlug: "nfc-order-br" },
  { slug: "nfc-order-br", name: "NFC Order (PT)", language: "pt", alternateSlug: "nfc-order" },
];

async function upsertPage(spec: PageSpec) {
  const existing = await db.select().from(pages).where(eq(pages.slug, spec.slug));

  if (existing.length > 0) {
    const [row] = await db
      .update(pages)
      .set({
        name: spec.name,
        sections: SECTIONS,
        language: spec.language,
        alternateSlug: spec.alternateSlug,
        isActive: true,
      })
      .where(eq(pages.slug, spec.slug))
      .returning();
    console.log(`  updated page '${row.slug}' (${SECTIONS.length} sections)`);
    return;
  }

  const [row] = await db
    .insert(pages)
    .values({
      slug: spec.slug,
      name: spec.name,
      sections: SECTIONS,
      language: spec.language,
      alternateSlug: spec.alternateSlug,
      isActive: true,
    })
    .returning();
  console.log(`  created page '${row.slug}' (${SECTIONS.length} sections)`);
}

async function seed() {
  console.log("Seeding NFC order pages...");
  for (const spec of SPECS) await upsertPage(spec);
  console.log("\nPrice ladder written to the page:");
  for (const line of buildPriceLines()) {
    console.log(`  ${line.label.padEnd(22)} ${line.price}${line.note ? `  (${line.note})` : ""}`);
  }
}

// Only seed when run directly. Importing this file (to check SECTIONS against
// the section prop schemas, say) must not open a connection or write anything.
const runDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (runDirectly) {
  seed()
    .then(() => console.log("\nDone. Live at /nfc-order and /br/nfc-order."))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
