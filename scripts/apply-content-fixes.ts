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
 *   6. Product artwork: each X app's own site is the source for its mark and
 *      share image. Fills empty imageUrl / logoIconUrl (XmartMenu, Xtimator)
 *      and replaces icons below print resolution (Xkedule's 96px file), with
 *      copies stored in Supabase. Set XMARTMENU_URL for XmartMenu's domain.
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

function pickMeta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']+)["']/i)?.[1];
}

/** The largest icon the page declares: apple-touch-icon first, then sized <link rel=icon>. */
function pickIconFromHtml(html: string): string | undefined {
  const links = Array.from(html.matchAll(/<link[^>]+>/gi), (m) => m[0]);
  let best: { href: string; size: number } | undefined;
  for (const tag of links) {
    const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !/icon/.test(rel)) continue;
    const sizes = tag.match(/sizes=["'](\d+)x\d+["']/i)?.[1];
    const size = sizes ? Number(sizes) : rel.includes("apple-touch-icon") ? 180 : /\.svg(\?|$)/i.test(href) ? 1024 : 32;
    if (!best || size > best.size) best = { href, size };
  }
  return best?.href;
}

/** Pixel width of a remote PNG/JPEG/WebP/GIF, 0 when unknown. */
async function imageWidth(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return b.readUInt32BE(16);
    if (b.length > 10 && b.toString("ascii", 0, 6).startsWith("GIF")) return b.readUInt16LE(6);
    if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return b.readUInt16LE(26) & 0x3fff;
      if (chunk === "VP8L") return 1 + (((b[21] | (b[22] << 8)) & 0x3fff));
      if (chunk === "VP8X") return 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return b.readUInt16BE(i + 7);
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Download a public image and store it under uploads/<pathBase>.<ext>; returns the public URL. */
async function copyToStorage(src: string, pathBase: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : type === "image/svg+xml" ? "svg" : type === "image/gif" ? "gif" : null;
    if (!ext) throw new Error(`not an image (${type || "no content-type"})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const { getSupabaseAdmin } = await import("../server/lib/supabase");
    const supabase = getSupabaseAdmin();
    const objectPath = `${pathBase}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(objectPath, bytes, { contentType: type, upsert: true });
    if (error) throw new Error(error.message);
    return supabase.storage.from("uploads").getPublicUrl(objectPath).data.publicUrl;
  } catch (err) {
    console.warn(`  could not copy ${src}: ${(err as Error).message}`);
    return null;
  }
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

  // 6. Product artwork from the products' own sites. Each product site is the
  //    source of truth for its mark and its share image: the page is fetched,
  //    og:image and the largest declared icon are read from the HTML, copied
  //    into Supabase Storage (so the CMS never hot-links a third-party host)
  //    and written to the card. Only empty or too-small fields are filled;
  //    explicit `icon`/`image` paths win over what the HTML declares.
  //    XmartMenu's domain is not known to this script: set XMARTMENU_URL.
  const PRODUCT_SITES: Record<string, { site?: string; icon?: string; image?: string }> = {
    "scheduling-system": { site: "https://xkedule.com", icon: "/icon-512.png" },
    xtimator: { site: "https://xtimator.com" },
    "smart-menu": { site: process.env.XMARTMENU_URL },
    xareable: { site: "https://xareable.com" },
  };
  const MIN_ICON_PX = 118; // 10mm badge at 300dpi

  for (const svc of services) {
    const spec = PRODUCT_SITES[svc.slug];
    if (!spec?.site) continue;
    const site = spec.site.replace(/\/$/, "");
    const needIcon = !svc.logoIconUrl || (await imageWidth(svc.logoIconUrl)) < MIN_ICON_PX;
    const needImage = !svc.imageUrl;
    if (!needIcon && !needImage) continue;

    let html = "";
    try {
      html = await (await fetch(site, { headers: { "user-agent": "Mozilla/5.0 (SkaleClub content script)" } })).text();
    } catch (err) {
      console.warn(`${svc.title}: could not fetch ${site} (${(err as Error).message}); skipped.`);
      continue;
    }
    const iconHref = spec.icon ?? pickIconFromHtml(html);
    const imageHref = spec.image ?? pickMeta(html, "og:image");
    const patch: { logoIconUrl?: string; imageUrl?: string; toolUrl?: string } = {};
    if (!svc.toolUrl) patch.toolUrl = site;

    if (needIcon && iconHref) {
      const url = await copyToStorage(new URL(iconHref, site).toString(), `product-assets/${svc.slug}-icon`);
      if (url) patch.logoIconUrl = url;
    }
    if (needImage && imageHref) {
      const url = await copyToStorage(new URL(imageHref, site).toString(), `product-assets/${svc.slug}-image`);
      if (url) patch.imageUrl = url;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(portfolioServices).set(patch).where(eq(portfolioServices.id, svc.id));
      changes.push(`${svc.title}: ${Object.entries(patch).map(([k, v]) => `${k} <- ${v}`).join(", ")}`);
    } else {
      console.warn(`${svc.title}: nothing usable found on ${site} (icon: ${iconHref ?? "none"}, og:image: ${imageHref ?? "none"}).`);
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
