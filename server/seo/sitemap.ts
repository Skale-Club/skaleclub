import { withLanguage } from "#shared/languagePath.js";
import { buildPagePaths, type PageSlugs } from "#shared/pageSlugs.js";
import { CORE_PAGES_LASTMOD, CORE_SEO, CORE_SEO_KEYS, corePathForKey, isNoindexPath } from "#shared/coreSeo.js";
import { LANDING_SEO, landingPathForSlug } from "#shared/landingSeo.js";

// sitemap.xml builder: core pages (both languages), active managed landings and
// published blog posts, each URL carrying its hreflang alternates. Pure so it can
// be unit-tested without a database.

export interface SitemapPage {
  slug: string;
  language: "en" | "pt";
  isActive: boolean;
  updatedAt: Date | null;
}

export interface SitemapPost {
  slug: string;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

interface SitemapUrl {
  path: string;
  lastmod: string;
  alternates?: { en: string; pt: string };
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function day(date: Date | null | undefined, fallback: string): string {
  return date ? new Date(date).toISOString().split("T")[0] : fallback;
}

function isIndexableLandingSlug(slug: string, pageSlugs?: Partial<PageSlugs> | null): boolean {
  const seo = LANDING_SEO[slug];
  if (seo?.robots?.startsWith("noindex")) return false;
  return !isNoindexPath(landingPathForSlug(slug), pageSlugs);
}

export function collectSitemapUrls(
  input: { pageSlugs?: Partial<PageSlugs> | null; pages: SitemapPage[]; posts: SitemapPost[] },
): SitemapUrl[] {
  const { pageSlugs } = input;
  const urls: SitemapUrl[] = [];
  const seen = new Set<string>();
  const add = (url: SitemapUrl) => {
    if (seen.has(url.path)) return;
    seen.add(url.path);
    urls.push(url);
  };
  const pair = (enPath: string, lastmod: string) => {
    const alternates = { en: enPath, pt: withLanguage(enPath, "pt") };
    add({ path: alternates.en, lastmod, alternates });
    add({ path: alternates.pt, lastmod, alternates });
  };

  for (const key of CORE_SEO_KEYS) {
    if (!CORE_SEO[key].sitemap) continue;
    pair(corePathForKey(key, pageSlugs), CORE_PAGES_LASTMOD);
  }
  pair("/nfc-guide", CORE_PAGES_LASTMOD);

  const active = new Map(input.pages.filter((page) => page.isActive).map((page) => [page.slug, page]));
  for (const page of Array.from(active.values())) {
    if (!isIndexableLandingSlug(page.slug, pageSlugs)) continue;
    const lastmod = day(page.updatedAt, CORE_PAGES_LASTMOD);
    if (page.slug.endsWith("-br")) {
      const base = active.get(page.slug.slice(0, -3));
      const path = landingPathForSlug(page.slug);
      // A PT row pairs with an English base row; otherwise it stands alone.
      const alternates = base?.language === "en" ? { en: landingPathForSlug(base.slug), pt: path } : undefined;
      add({ path, lastmod, alternates });
      continue;
    }
    const path = landingPathForSlug(page.slug);
    const brRow = active.get(`${page.slug}-br`);
    // `grupo`-style pages are Portuguese-only at their bare path: no pair.
    const alternates =
      page.language === "en" && brRow ? { en: path, pt: landingPathForSlug(brRow.slug) } : undefined;
    add({ path, lastmod, alternates });
  }

  const blogPath = buildPagePaths(pageSlugs).blog;
  for (const post of input.posts) {
    add({ path: `${blogPath}/${post.slug}`, lastmod: day(post.updatedAt ?? post.publishedAt, CORE_PAGES_LASTMOD) });
  }
  return urls;
}

export function buildSitemapXml(origin: string, urls: SitemapUrl[]): string {
  const abs = (path: string) => xmlEscape(`${origin}${path}`);
  const body = urls.map((url) => {
    const links = url.alternates
      ? [
          ["en", url.alternates.en],
          ["pt-BR", url.alternates.pt],
          ["x-default", url.alternates.en],
        ]
          .map(([hreflang, path]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${abs(path)}" />`)
          .join("\n")
      : "";
    return `  <url>\n    <loc>${abs(url.path)}</loc>\n    <lastmod>${url.lastmod}</lastmod>${links ? `\n${links}` : ""}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body.join("\n")}\n</urlset>\n`;
}
