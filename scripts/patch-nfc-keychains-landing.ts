// Targeted patch of the NFC keychain landing rows (nfc-keychains, nfc-keychains-br):
// changes ONLY the fields below, leaving every other prop as edited in the admin.
//
//   - hero + closing CTA image: the Blender render of three real client keychains
//     (/nfc-keychains-trio.webp) instead of the generic "car key" render
//   - the full guide (/nfc-guide, the landing's second level and what the team
//     sends on WhatsApp) gets its own quiet linkCallout band right after the FAQ;
//     the closing CTA keeps only the order button (no guide link, no price note)
//   - "what the tap opens" grid: each destination shows its own logo and colour
//     (featureGrid `brand`), matched by the item's icon
//
// DRY-RUN by default; --apply writes (each row snapshotted into content_revisions first).
// Run: npx tsx --env-file=.env scripts/patch-nfc-keychains-landing.ts [--apply]
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db.js";
import { recordRevisionOrThrow } from "../server/storage/revisions.js";
import { withSeedGuard } from "./lib/seed-utils.js";
import { pages, type PageSection } from "../shared/schema/pages.js";

const IMAGE = "/nfc-keychains-trio.webp";
const ALT = {
  en: "Three custom NFC keychains made for businesses, with their logos in raised relief",
  pt: "Três chaveiros NFC personalizados para empresas, com a logo em alto-relevo",
};
const GUIDE_CALLOUT: Record<"en" | "pt", PageSection> = {
  en: {
    type: "linkCallout",
    props: {
      theme: "dark",
      eyebrow: "Keychain guide",
      text: "Want every detail? Models, pricing, artwork and production in the full guide.",
      linkLabel: "Read the guide",
      href: "/nfc-guide",
    },
  },
  pt: {
    type: "linkCallout",
    props: {
      theme: "dark",
      eyebrow: "Guia dos chaveiros",
      text: "Quer todos os detalhes? Modelos, preços, arte e produção no guia completo.",
      linkLabel: "Ler o guia",
      href: "/nfc-guide",
    },
  },
};

// featureGrid icon -> brand badge, for the grid of tap destinations only.
const BRAND_BY_ICON: Record<string, string> = {
  Star: "google", Instagram: "instagram", MessageCircle: "whatsapp",
  IdCard: "vcard", UtensilsCrossed: "menu", Globe: "web",
};

function patch(sections: PageSection[], lang: "en" | "pt"): { sections: PageSection[]; changes: string[] } {
  const changes: string[] = [];
  const next = sections.map((s) => {
    const props = { ...(s.props as Record<string, unknown>) };
    const set = (key: string, value: unknown) => {
      if (props[key] !== value) {
        changes.push(`${s.type}.${key}: ${JSON.stringify(props[key])} -> ${JSON.stringify(value)}`);
        props[key] = value;
      }
    };
    const drop = (key: string) => {
      if (key in props) {
        changes.push(`${s.type}.${key}: ${JSON.stringify(props[key])} -> (removed)`);
        delete props[key];
      }
    };
    if (s.type === "heroWebsites") {
      set("backgroundImageUrl", IMAGE);
      set("backgroundImageAlt", ALT[lang]);
    }
    // The destinations grid is the featureGrid holding the Instagram item.
    if (s.type === "featureGrid" && Array.isArray(props.items) &&
        (props.items as Array<{ icon?: string }>).some((it) => it.icon === "Instagram")) {
      const items = (props.items as Array<Record<string, unknown>>).map((it) => {
        const brand = BRAND_BY_ICON[it.icon as string];
        if (!brand || it.brand === brand) return it;
        changes.push(`featureGrid "${it.title}": brand -> ${brand}`);
        return { ...it, brand };
      });
      props.items = items;
    }
    if (s.type === "leadFormCta") {
      set("imageUrl", IMAGE);
      set("imageAlt", ALT[lang]);
      // The guide moved to its own band; the price line did not belong here.
      drop("secondaryHref");
      drop("secondaryLabel");
      drop("note");
    }
    return { ...s, props };
  });
  if (!next.some((s) => s.type === "linkCallout")) {
    const faq = next.findIndex((s) => s.type === "faqAccordion");
    const at = faq >= 0 ? faq + 1 : next.length - 1;
    next.splice(at, 0, GUIDE_CALLOUT[lang]);
    changes.push(`linkCallout: inserted at position ${at} (after the FAQ)`);
  }
  return { sections: next, changes };
}

async function main(apply: boolean) {
  for (const [slug, lang] of [["nfc-keychains", "en"], ["nfc-keychains-br", "pt"]] as const) {
    const [row] = await db.select().from(pages).where(eq(pages.slug, slug));
    if (!row) {
      console.log(`  [missing] page '${slug}'`);
      continue;
    }
    const { sections, changes } = patch(row.sections as PageSection[], lang);
    if (changes.length === 0) {
      console.log(`  [unchanged] page '${slug}'`);
      continue;
    }
    console.log(`  [${apply ? "UPDATE" : "would update"}] page '${slug}':`);
    for (const c of changes) console.log(`      ${c}`);
    if (!apply) continue;
    await recordRevisionOrThrow("page", row.id, row, "seed", "patch-nfc-keychains-landing: render image + guide link");
    await db.update(pages).set({ sections, updatedAt: new Date() }).where(eq(pages.slug, slug));
  }
}

void withSeedGuard(main);
