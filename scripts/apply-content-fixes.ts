import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { db } from "../server/db";
import { companySettings, portfolioServices } from "../shared/schema";
import type { HomepageContent, LinksPageConfig } from "../shared/schema";

/**
 * Content fixes found by the September 2026 site review, applied in one
 * idempotent pass. Run with `npx tsx scripts/apply-content-fixes.ts`.
 * Every change checks the current value first, so re-running is a no-op.
 *
 *   1. SEO title: "Skale Club" alone is a weak <title>; set a descriptive one.
 *   2. SEO keywords: the stored list was Portuguese and about a previous
 *      business ("mentoria, brasileiros, cleaning"); replace with the current
 *      positioning in English.
 *   3. Portfolio hero title repeated the homepage hero word for word.
 *   4. Links page: drop the placeholder "New Link" (url "https://") and the
 *      bare "https://instagram.com/" social entry, both visible publicly.
 *   5. portfolio_services: duplicate `order` values (5,5 and 6,6) made the
 *      product order depend on the database's row order. Renumber 1..n.
 *   6. Xkedule's logoIconUrl was a 96px file, too small for the 10mm badge on
 *      the printed folder (needs ~118px at 300dpi). The product's own site
 *      serves its mark at 512px (https://xkedule.com/icon-512.png); it is
 *      copied into Supabase Storage so the CMS never depends on a third-party
 *      host, and the card points at the copy.
 *
 * 3D Printing is handled by scripts/add-3d-printing-service.ts.
 */

const SEO_TITLE = "Skale Club | AI Automation & Smart Websites for Growing Businesses";
const SEO_KEYWORDS =
  "business automation, AI chatbots, AI phone assistant, custom websites, CRM automation, " +
  "lead generation, digital marketing, 3D printing, Framingham MA, Boston";
const PORTFOLIO_HERO_TITLE = "Apps and Services Built to Scale Your Business";
const STALE_KEYWORD_MARKERS = ["mentoria", "brasileiros", "cleaning", "landscaping"];

function isPlaceholderUrl(url: unknown): boolean {
  if (typeof url !== "string") return true;
  const u = url.trim().toLowerCase();
  return u === "" || u === "https://" || u === "http://" || /^https?:\/\/(www\.)?[a-z.]+\/?$/.test(u) && /instagram\.com\/?$|facebook\.com\/?$/.test(u);
}

async function main() {
  const [row] = await db.select().from(companySettings).orderBy(asc(companySettings.id)).limit(1);
  if (!row) {
    console.error("No company_settings row. Seed the database first.");
    process.exitCode = 1;
    return;
  }

  const changes: string[] = [];
  const patch: Partial<typeof row> = {};

  // 1. Title
  const bareTitle = !row.seoTitle || row.seoTitle.trim() === (row.companyName || "").trim();
  if (bareTitle && row.seoTitle !== SEO_TITLE) {
    patch.seoTitle = SEO_TITLE;
    changes.push(`seoTitle: "${row.seoTitle}" -> "${SEO_TITLE}"`);
  }

  // 2. Keywords
  const kw = (row.seoKeywords || "").toLowerCase();
  if (STALE_KEYWORD_MARKERS.some((m) => kw.includes(m))) {
    patch.seoKeywords = SEO_KEYWORDS;
    changes.push(`seoKeywords: replaced stale Portuguese list`);
  }

  // 3. Portfolio hero
  const homepage: HomepageContent = { ...(row.homepageContent ?? {}) };
  const hero = homepage.portfolioHero ?? {};
  if (hero.title && row.heroTitle && hero.title.trim() === row.heroTitle.trim()) {
    homepage.portfolioHero = { ...hero, title: PORTFOLIO_HERO_TITLE };
    patch.homepageContent = homepage;
    changes.push(`portfolioHero.title: "${hero.title}" -> "${PORTFOLIO_HERO_TITLE}"`);
  }

  // 4. Links page placeholders
  const links: LinksPageConfig | null = row.linksPageConfig ? { ...row.linksPageConfig } : null;
  if (links) {
    const before = links.links?.length ?? 0;
    const kept = (links.links ?? []).filter((l) => !(isPlaceholderUrl(l.url) || l.title?.trim() === "New Link"));
    const socialBefore = links.socialLinks?.length ?? 0;
    const socialKept = (links.socialLinks ?? []).filter((s) => !isPlaceholderUrl(s.url));
    if (kept.length !== before || socialKept.length !== socialBefore) {
      patch.linksPageConfig = { ...links, links: kept, socialLinks: socialKept };
      changes.push(`linksPageConfig: removed ${before - kept.length} placeholder link(s), ${socialBefore - socialKept.length} placeholder social link(s)`);
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(companySettings).set(patch).where(eq(companySettings.id, row.id));
  }

  // 5. Portfolio order
  const services = await db.select().from(portfolioServices).orderBy(asc(portfolioServices.order), asc(portfolioServices.id));
  const orders = services.map((s) => s.order ?? 0);
  if (new Set(orders).size !== orders.length) {
    for (let i = 0; i < services.length; i++) {
      if ((services[i].order ?? 0) !== i + 1) {
        await db.update(portfolioServices).set({ order: i + 1 }).where(eq(portfolioServices.id, services[i].id));
      }
    }
    changes.push(`portfolio_services.order renumbered: ${services.map((s) => `${s.title}=${services.indexOf(s) + 1}`).join(", ")}`);
  }

  // 6. Xkedule icon at print resolution
  const XKEDULE_ICON_SRC = "https://xkedule.com/icon-512.png";
  const XKEDULE_ICON_PATH = "product-icons/xkedule-512.png";
  const xkedule = services.find((s) => s.slug === "scheduling-system" || s.title.toLowerCase() === "xkedule");
  if (xkedule && !(xkedule.logoIconUrl || "").includes(XKEDULE_ICON_PATH)) {
    try {
      const res = await fetch(XKEDULE_ICON_SRC);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const { getSupabaseAdmin } = await import("../server/lib/supabase");
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.storage
        .from("uploads")
        .upload(XKEDULE_ICON_PATH, bytes, { contentType: "image/png", upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("uploads").getPublicUrl(XKEDULE_ICON_PATH);
      await db.update(portfolioServices).set({ logoIconUrl: data.publicUrl }).where(eq(portfolioServices.id, xkedule.id));
      changes.push(`Xkedule logoIconUrl: 96px file -> ${data.publicUrl} (512px, from the product site)`);
    } catch (err) {
      console.warn(`Xkedule icon not updated: ${(err as Error).message}. Re-run when ${XKEDULE_ICON_SRC} and Supabase are reachable.`);
    }
  }

  if (changes.length === 0) {
    console.log("Nothing to change — all content fixes are already applied.");
  } else {
    console.log("Applied:");
    for (const c of changes) console.log(`  - ${c}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
