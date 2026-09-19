import { asc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { companySettings, portfolioServices } from "#shared/schema.js";
import type { HomepageContent, LinksPageConfig, OurServicesCard } from "#shared/schema.js";
import { isCatalogCategory, type CatalogCategory } from "#shared/catalog.js";

/**
 * Self-applying content fixes. Each function is idempotent: it checks the
 * current value before writing, so running it again is a no-op. They run at
 * boot through server/lib/bootstrapTasks.ts and on demand from the admin
 * route, the MCP tools and scripts/apply-content-fixes.ts.
 */
export interface TaskResult {
  /** True when nothing is left to do; false means "retry later". */
  done: boolean;
  notes: string[];
}

// ─── Storage helpers ───────────────────────────────────────────────────────

const BUCKET = "uploads";

/** Copy a public image into Supabase Storage under uploads/<pathBase>.<ext>. */
export async function copyToStorage(src: string, pathBase: string): Promise<string> {
  const res = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (SkaleClub content sync)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  const ext =
    type === "image/png" ? "png"
    : type === "image/jpeg" ? "jpg"
    : type === "image/webp" ? "webp"
    : type === "image/svg+xml" ? "svg"
    : type === "image/gif" ? "gif"
    : null;
  if (!ext) throw new Error(`${src} is not an image (${type || "no content-type"})`);
  return putInStorage(`${pathBase}.${ext}`, Buffer.from(await res.arrayBuffer()), type);
}

export async function putInStorage(objectPath: string, bytes: Buffer, contentType: string): Promise<string> {
  const { getSupabaseAdmin } = await import("./supabase.js");
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload of ${objectPath} failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

// ─── HTML helpers (product sites) ──────────────────────────────────────────

export function pickMeta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']+)["']/i)?.[1];
}

/** The largest icon the page declares: sized <link rel=icon>, apple-touch-icon, SVG. */
export function pickIconFromHtml(html: string): string | undefined {
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

/** Pixel width of a remote PNG/JPEG/WebP/GIF; 0 when unknown or unreachable. */
export async function imageWidth(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return b.readUInt32BE(16);
    if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return b.readUInt16LE(6);
    if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return b.readUInt16LE(26) & 0x3fff;
      if (chunk === "VP8L") return 1 + ((b[21] | (b[22] << 8)) & 0x3fff);
      if (chunk === "VP8X") return 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
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

// ─── 1. company_settings + portfolio order ─────────────────────────────────

const SEO_TITLE = "Skale Club | AI Automation & Smart Websites for Growing Businesses";
const SEO_KEYWORDS =
  "business automation, AI chatbots, AI phone assistant, custom websites, CRM automation, " +
  "lead generation, digital marketing, 3D printing, Framingham MA, Boston";
const PORTFOLIO_HERO_TITLE = "Apps and Services Built to Scale Your Business";
const STALE_KEYWORD_MARKERS = ["mentoria", "brasileiros", "cleaning", "landscaping"];

function isPlaceholderUrl(url: unknown): boolean {
  if (typeof url !== "string") return true;
  const u = url.trim().toLowerCase();
  if (u === "" || u === "https://" || u === "http://") return true;
  return /^https?:\/\/(www\.)?(instagram|facebook|tiktok|linkedin|youtube)\.com\/?$/.test(u);
}

async function settingsRow() {
  const [row] = await db.select().from(companySettings).orderBy(asc(companySettings.id)).limit(1);
  return row;
}

/**
 * The content findings of the September 2026 site review:
 * descriptive SEO title, English keywords (the stored list was Portuguese
 * and about a previous business), a portfolio hero that does not repeat the
 * homepage hero, placeholder entries off the links page, and unique
 * portfolio_services.order values.
 */
export async function applyContentFixes(): Promise<TaskResult> {
  const row = await settingsRow();
  if (!row) return { done: false, notes: ["No company_settings row yet."] };
  const notes: string[] = [];
  const patch: Partial<typeof row> = {};

  const bareTitle = !row.seoTitle || row.seoTitle.trim() === (row.companyName || "").trim();
  if (bareTitle && row.seoTitle !== SEO_TITLE) {
    patch.seoTitle = SEO_TITLE;
    notes.push(`seoTitle: "${row.seoTitle}" -> "${SEO_TITLE}"`);
  }

  const kw = (row.seoKeywords || "").toLowerCase();
  if (STALE_KEYWORD_MARKERS.some((m) => kw.includes(m))) {
    patch.seoKeywords = SEO_KEYWORDS;
    notes.push("seoKeywords: replaced the stale Portuguese list");
  }

  const homepage: HomepageContent = { ...(row.homepageContent ?? {}) };
  const hero = homepage.portfolioHero ?? {};
  if (hero.title && row.heroTitle && hero.title.trim() === row.heroTitle.trim()) {
    homepage.portfolioHero = { ...hero, title: PORTFOLIO_HERO_TITLE };
    patch.homepageContent = homepage;
    notes.push(`portfolioHero.title: "${hero.title}" -> "${PORTFOLIO_HERO_TITLE}"`);
  }

  const links: LinksPageConfig | null = row.linksPageConfig ? { ...row.linksPageConfig } : null;
  if (links) {
    const before = links.links?.length ?? 0;
    const kept = (links.links ?? []).filter((l) => !(isPlaceholderUrl(l.url) || l.title?.trim() === "New Link"));
    const socialBefore = links.socialLinks?.length ?? 0;
    const socialKept = (links.socialLinks ?? []).filter((s) => !isPlaceholderUrl(s.url));
    if (kept.length !== before || socialKept.length !== socialBefore) {
      patch.linksPageConfig = { ...links, links: kept, socialLinks: socialKept };
      notes.push(`linksPageConfig: removed ${before - kept.length} placeholder link(s), ${socialBefore - socialKept.length} placeholder social link(s)`);
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(companySettings).set(patch).where(eq(companySettings.id, row.id));
  }

  const services = await db.select().from(portfolioServices).orderBy(asc(portfolioServices.order), asc(portfolioServices.id));
  const orders = services.map((s) => s.order ?? 0);
  if (new Set(orders).size !== orders.length) {
    for (let i = 0; i < services.length; i++) {
      if ((services[i].order ?? 0) !== i + 1) {
        await db.update(portfolioServices).set({ order: i + 1 }).where(eq(portfolioServices.id, services[i].id));
      }
    }
    notes.push(`portfolio_services.order renumbered: ${services.map((s, i) => `${s.title}=${i + 1}`).join(", ")}`);
  }

  if (notes.length === 0) notes.push("Already applied.");
  return { done: true, notes };
}

// ─── 2. Product artwork from the products' own sites ───────────────────────

/**
 * Each X app's site is the source of truth for its mark and share image. The
 * page is fetched, og:image and the largest declared icon are read from the
 * HTML, copied into Supabase Storage (never hot-linked) and written to the
 * product home cover. Only empty fields and icons below print resolution are touched;
 * explicit `icon`/`image` paths win over what the HTML declares.
 */
export const PRODUCT_SITES: Record<string, { site?: string; icon?: string; image?: string }> = {
  "scheduling-system": { site: "https://xkedule.com" },
  xtimator: { site: "https://xtimator.com" },
  "smart-menu": { site: process.env.XMARTMENU_URL || "https://xmartmenu.skale.club" },
  xareable: { site: "https://xareable.com" },
  "crm-setup": { site: "https://xphere.app" },
};
const MIN_ICON_PX = 118; // a 10mm badge at 300dpi

export async function syncProductArtwork(): Promise<TaskResult> {
  if (process.env.NODE_ENV !== "production") {
    return { done: false, notes: ["Deferred outside production so product assets are never changed from local development."] };
  }
  const services = await db.select().from(portfolioServices).orderBy(asc(portfolioServices.order));
  const notes: string[] = [];
  let pending = 0;

  for (const svc of services) {
    const spec = PRODUCT_SITES[svc.slug];
    if (!spec?.site) continue;
    const site = spec.site.replace(/\/$/, "");
    // Replace an icon only when it is missing or measurably too small; an
    // icon that cannot be fetched right now is not a reason to overwrite it.
    const iconWidth = svc.logoIconUrl ? await imageWidth(svc.logoIconUrl) : 0;
    const needIcon = !svc.logoIconUrl || (iconWidth > 0 && iconWidth < MIN_ICON_PX);
    const needHome = !svc.homeImageUrl;
    if (!needIcon && !needHome) continue;

    let html = "";
    try {
      const res = await fetch(site, { headers: { "user-agent": "Mozilla/5.0 (SkaleClub content sync)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      notes.push(`${svc.title}: ${site} unreachable (${(err as Error).message}); will retry.`);
      pending++;
      continue;
    }

    const iconHref = spec.icon ?? pickIconFromHtml(html);
    const imageHref = spec.image ?? pickMeta(html, "og:image");
    const patch: { logoIconUrl?: string; homeImageUrl?: string; toolUrl?: string } = {};
    if (!svc.toolUrl) patch.toolUrl = site;

    if (needIcon) {
      if (iconHref) {
        try {
          patch.logoIconUrl = await copyToStorage(new URL(iconHref, site).toString(), `product-assets/${svc.slug}-icon`);
        } catch (err) {
          notes.push(`${svc.title}: icon ${iconHref} — ${(err as Error).message}`);
          pending++;
        }
      } else {
        notes.push(`${svc.title}: ${site} declares no icon; keeping the current one.`);
      }
    }
    if (needHome) {
      if (imageHref) {
        try {
          patch.homeImageUrl = await copyToStorage(new URL(imageHref, site).toString(), `product-assets/${svc.slug}-home`);
        } catch (err) {
          notes.push(`${svc.title}: og:image ${imageHref} — ${(err as Error).message}`);
          pending++;
        }
      } else {
        notes.push(`${svc.title}: ${site} has no og:image; card stays without a home cover.`);
      }
    }

    if (Object.keys(patch).length > 0) {
      await db.update(portfolioServices).set(patch).where(eq(portfolioServices.id, svc.id));
      notes.push(`${svc.title}: ${Object.entries(patch).map(([k, v]) => `${k} <- ${v}`).join(", ")}`);
    }
  }

  if (notes.length === 0) notes.push("All product artwork present.");
  return { done: pending === 0, notes };
}

// ─── 3. Curated product logos + real website captures ──────────────────────

interface ProductCatalogArtwork {
  site: string;
  home: string;
  logo: string;
  dashboard?: string;
  legacyHome?: string[];
  legacyLogo?: string[];
}

const PRODUCT_CATALOG_ARTWORK: Record<string, ProductCatalogArtwork> = {
  xareable: {
    site: "https://xareable.com",
    home: "/product-assets/catalog-2026-09/xareable-home.webp",
    logo: "/product-assets/catalog-2026-09/xareable-logo.webp",
    legacyHome: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/product-assets/xareable-home-2026-09.jpg",
    ],
    legacyLogo: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/1783115396335_55a9999d-09a7-4294-aa1a-7c2e087b9dc9.webp",
    ],
  },
  websites: {
    // Xsites is the Skale Club website platform. Its public platform URL is an
    // admin login, so the cover intentionally proves the product with a real
    // customer site built on it instead.
    site: "https://mvpbuildergroup.com",
    home: "/product-assets/catalog-2026-09/websites-home.webp",
    logo: "/product-assets/catalog-2026-09/websites-logo.png",
    dashboard: "/product-assets/catalog-2026-09/websites-dashboard.webp",
  },
  "scheduling-system": {
    site: "https://xkedule.com",
    home: "/product-assets/catalog-2026-09/scheduling-system-home.webp",
    logo: "/product-assets/catalog-2026-09/scheduling-system-logo.png",
    dashboard: "/product-assets/catalog-2026-09/scheduling-system-dashboard.webp",
    legacyHome: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/product-assets/scheduling-system-home-2026-09.jpg",
    ],
    legacyLogo: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/product-assets/scheduling-system-icon.png",
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/1783107543683_3b8f12bc-6ac2-4519-bf2f-9c6499329738.webp",
    ],
  },
  "smart-menu": {
    site: "https://xmartmenu.skale.club",
    home: "/product-assets/catalog-2026-09/smart-menu-home.webp",
    logo: "/product-assets/catalog-2026-09/smart-menu-logo.webp",
    dashboard: "/product-assets/catalog-2026-09/smart-menu-dashboard.webp",
    legacyHome: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/product-assets/smart-menu-home-2026-09.jpg",
    ],
    legacyLogo: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/1783205835559_464fce11-1b52-4e45-bdb2-3958d0fadd18.webp",
    ],
  },
  "crm-setup": {
    site: "https://xphere.app",
    home: "/product-assets/catalog-2026-09/crm-setup-home.webp",
    logo: "/product-assets/catalog-2026-09/crm-setup-logo.svg",
    legacyLogo: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/1783115414320_44c114ed-874f-40ab-ba73-317aa8f327d7.webp",
    ],
  },
  xtimator: {
    site: "https://xtimator.com",
    home: "/product-assets/catalog-2026-09/xtimator-home.webp",
    logo: "/product-assets/catalog-2026-09/xtimator-logo.png",
    dashboard: "/product-assets/catalog-2026-09/xtimator-dashboard.webp",
    legacyLogo: [
      "https://neummispnnqzrhdhnxwa.supabase.co/storage/v1/object/public/uploads/1783118997429_00cb9d30-5d74-4ec9-bf0c-a3ac034911c7.webp",
    ],
  },
};

function canReplaceProductAsset(current: string | null | undefined, target: string, legacy: string[] = []): boolean {
  const value = current?.trim();
  return !value || value === target || legacy.includes(value);
}

/**
 * Gives every product the same honest visual contract: its official mark and
 * a real, date-stamped capture of the live website inside the catalog browser
 * frame. The files ship with the app so cards never depend on a third-party
 * screenshot at render time.
 */
export async function refreshProductCatalogArtwork(): Promise<TaskResult> {
  if (process.env.NODE_ENV !== "production") {
    return { done: false, notes: ["Deferred outside production so product URLs never precede the deployed assets."] };
  }

  const services = await db.select().from(portfolioServices).orderBy(asc(portfolioServices.order));
  const notes: string[] = [];

  for (const svc of services) {
    const spec = PRODUCT_CATALOG_ARTWORK[svc.slug];
    if (!spec) continue;

    const patch: { toolUrl?: string; homeImageUrl?: string; logoIconUrl?: string; dashboardImageUrl?: string } = {};
    if (!svc.toolUrl) patch.toolUrl = spec.site;
    else if (svc.toolUrl !== spec.site) notes.push(`${svc.title}: kept unexpected admin site ${svc.toolUrl}`);

    if (svc.homeImageUrl !== spec.home) {
      if (canReplaceProductAsset(svc.homeImageUrl, spec.home, spec.legacyHome)) {
        patch.homeImageUrl = spec.home;
      } else {
        notes.push(`${svc.title}: kept unexpected admin home image ${svc.homeImageUrl}`);
      }
    }

    if (svc.logoIconUrl !== spec.logo) {
      if (canReplaceProductAsset(svc.logoIconUrl, spec.logo, spec.legacyLogo)) {
        patch.logoIconUrl = spec.logo;
      } else {
        notes.push(`${svc.title}: kept unexpected admin logo ${svc.logoIconUrl}`);
      }
    }

    // Only demos or approved, real product screens are assigned here. An
    // existing admin-selected dashboard always wins; products without a
    // verified capture keep their one-image popup.
    if (spec.dashboard && svc.dashboardImageUrl !== spec.dashboard) {
      if (canReplaceProductAsset(svc.dashboardImageUrl, spec.dashboard)) {
        patch.dashboardImageUrl = spec.dashboard;
      } else {
        notes.push(`${svc.title}: kept unexpected admin dashboard ${svc.dashboardImageUrl}`);
      }
    }

    if (Object.keys(patch).length > 0) {
      await db.update(portfolioServices).set(patch).where(eq(portfolioServices.id, svc.id));
      notes.push(`${svc.title}: ${Object.keys(patch).join(", ")}`);
    }
  }

  if (notes.length === 0) notes.push("Every product already uses its official logo and real website capture.");
  return { done: true, notes };
}

// ─── 4. The 3D Printing service card ───────────────────────────────────────

const SERVICE_IMAGE_PATHS: Record<string, string> = {
  "digital marketing consultation": "/service-images/editorial-2026-09/digital-marketing-consultation.webp",
  "website design & development": "/service-images/editorial-2026-09/website-design-development.webp",
  "paid advertising": "/service-images/editorial-2026-09/paid-advertising.webp",
  "content creation": "/service-images/editorial-2026-09/content-creation.webp",
  "branding & graphic design": "/service-images/editorial-2026-09/branding-graphic-design.webp",
  "lead generation": "/service-images/editorial-2026-09/lead-generation.webp",
  "crm and marketing automation": "/service-images/editorial-2026-09/crm-marketing-automation.webp",
  "3d printing": "/service-images/editorial-2026-09/3d-printing.webp",
};

const THREE_D_CARD: Omit<OurServicesCard, "order"> = {
  enabled: true,
  imageUrl: SERVICE_IMAGE_PATHS["3d printing"],
  title: "3D Printing",
  subtitle: "Custom parts and branded pieces",
  description:
    "Custom 3D-printed pieces for your business: branded NFC keychains, display stands, " +
    "signage parts, prototypes and replacement parts. We prepare the file from your logo or " +
    "drawing, print it, and test every piece before it ships.",
  features: ["Branded keychains", "Prototypes", "Custom parts"],
  category: "brand",
};

/**
 * Adds "3D Printing" to the homepage "Our Services" section (the admin-managed
 * cards in company_settings.homepage_content) with the editorial image bundled
 * into the site build. The asset is deterministic and never generated at boot.
 */
export async function ensure3dPrintingService(): Promise<TaskResult> {
  const row = await settingsRow();
  if (!row) return { done: false, notes: ["No company_settings row yet."] };
  const notes: string[] = [];
  const homepage: HomepageContent = { ...(row.homepageContent ?? {}) };
  const section = homepage.ourServicesSection ?? {};
  const cards: OurServicesCard[] = [...(section.cards ?? [])];

  let index = cards.findIndex((c) => c.title.trim().toLowerCase() === THREE_D_CARD.title.toLowerCase());
  if (index < 0) {
    const nextOrder = cards.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
    cards.push({ ...THREE_D_CARD, order: nextOrder });
    index = cards.length - 1;
    notes.push(`Added "${THREE_D_CARD.title}" card at order ${nextOrder}.`);
  }

  if (!cards[index].imageUrl) {
    cards[index] = { ...cards[index], imageUrl: THREE_D_CARD.imageUrl };
    notes.push(`Assigned packaged card image ${THREE_D_CARD.imageUrl}.`);
  }

  await db
    .update(companySettings)
    .set({ homepageContent: { ...homepage, ourServicesSection: { ...section, cards } } })
    .where(eq(companySettings.id, row.id));
  if (notes.length === 0) notes.push("Already present with an image.");
  return { done: true, notes };
}

// ─── 5. Editorial service card images ───────────────────────────────────────

function isReplaceableServiceImage(current: string | undefined, target: string): boolean {
  const value = current?.trim();
  if (!value) return true;
  if (value === target) return false;
  const filename = target.split("/").at(-1)?.replace(/\.webp$/i, "") ?? "";
  return new RegExp(`/service-images/${filename}\\.(?:jpe?g|png|webp)(?:[?#]|$)`, "i").test(value);
}

/**
 * Replaces only the known legacy service artwork (or an empty image) with the
 * versioned editorial set bundled in client/public. An unexpected admin URL is
 * deliberately preserved, so a later manual choice is never overwritten.
 */
export async function refreshServiceImages(): Promise<TaskResult> {
  if (process.env.NODE_ENV !== "production") {
    return { done: false, notes: ["Deferred outside production so image URLs never precede the deployed assets."] };
  }
  const row = await settingsRow();
  if (!row) return { done: false, notes: ["No company_settings row yet."] };
  const homepage: HomepageContent = { ...(row.homepageContent ?? {}) };
  const section = homepage.ourServicesSection ?? {};
  const notes: string[] = [];
  let changed = false;
  const cards = (section.cards ?? []).map((card) => {
    const key = card.title.trim().toLowerCase();
    const target = SERVICE_IMAGE_PATHS[key];
    if (!target || card.imageUrl === target) return card;
    if (!isReplaceableServiceImage(card.imageUrl, target)) {
      notes.push(`${card.title}: kept unexpected admin image ${card.imageUrl}`);
      return card;
    }
    changed = true;
    notes.push(`${card.title}: ${target}`);
    return { ...card, imageUrl: target };
  });

  if (changed) {
    await db
      .update(companySettings)
      .set({ homepageContent: { ...homepage, ourServicesSection: { ...section, cards } } })
      .where(eq(companySettings.id, row.id));
  }
  if (notes.length === 0) notes.push("Every known service already uses the editorial image set.");
  return { done: true, notes };
}

// ─── 6. Explicit catalog categories for the service cards ──────────────────

/**
 * The service cards live in JSON, so the migration that added
 * portfolio_services.category cannot reach them. Categories are assigned by
 * title, only where a card has none, so an admin's later choice always wins.
 */
const SERVICE_CATEGORIES: Record<string, CatalogCategory> = {
  "digital marketing consultation": "marketing",
  "website design & development": "websites",
  "paid advertising": "marketing",
  "content creation": "marketing",
  "branding & graphic design": "brand",
  "lead generation": "crm",
  "crm and marketing automation": "crm",
  "3d printing": "brand",
};

export async function assignServiceCategories(): Promise<TaskResult> {
  const row = await settingsRow();
  if (!row) return { done: false, notes: ["No company_settings row yet."] };
  const homepage: HomepageContent = { ...(row.homepageContent ?? {}) };
  const section = homepage.ourServicesSection ?? {};
  const notes: string[] = [];
  const cards = (section.cards ?? []).map((card) => {
    if (isCatalogCategory(card.category)) return card;
    const category = SERVICE_CATEGORIES[card.title.trim().toLowerCase()];
    if (!category) return card;
    notes.push(`${card.title} -> ${category}`);
    return { ...card, category };
  });
  if (notes.length > 0) {
    await db
      .update(companySettings)
      .set({ homepageContent: { ...homepage, ourServicesSection: { ...section, cards } } })
      .where(eq(companySettings.id, row.id));
  } else {
    notes.push("Every known card already has a category.");
  }
  return { done: true, notes };
}
