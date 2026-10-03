// Targeted patch of the NFC keychain landing rows (nfc-keychains, nfc-keychains-br):
// changes ONLY the fields below, leaving every other prop as edited in the admin.
//
//   - hero + closing CTA image: the Blender render of three real client keychains
//     (/nfc-keychains-trio.webp) instead of the generic "car key" render
//   - closing CTA: a quiet link to the full guide (/nfc-guide), the landing's
//     second level (the guide is also what the team sends on WhatsApp)
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
const GUIDE = { href: "/nfc-guide", en: "Read the full keychain guide", pt: "Ler o guia completo dos chaveiros" };

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
    if (s.type === "heroWebsites") {
      set("backgroundImageUrl", IMAGE);
      set("backgroundImageAlt", ALT[lang]);
    }
    if (s.type === "leadFormCta") {
      set("imageUrl", IMAGE);
      set("imageAlt", ALT[lang]);
      set("secondaryHref", GUIDE.href);
      set("secondaryLabel", GUIDE[lang]);
    }
    return { ...s, props };
  });
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
