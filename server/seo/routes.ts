import { legacyLanguagePath, splitLanguagePath } from "#shared/languagePath.js";
import { isNoindexPath } from "#shared/coreSeo.js";
import { buildPagePaths, DEFAULT_PAGE_SLUGS, type PageSlugs } from "#shared/pageSlugs.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { getLandingRow, getPublishedBlogRow, type BlogRow, type LandingRow } from "./data.js";

// Decides, for a request that reached the SPA fallback, whether the URL is a
// real page (200) or a soft 404, and whether it must stay out of the index.

function trimSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export interface RouteResolution {
  status: 200 | 404;
  noindex: boolean;
  /** The managed-landing row serving this URL, when it is one. */
  landing: LandingRow | null;
  /** The active row of the other language, when the landing has one. */
  alternate: LandingRow | null;
  /** The published blog post serving this URL, when it is one. */
  blog: BlogRow | null;
}

// First path segments the client routes explicitly before its `/:slug` landing
// catch-all (mirrors RESERVED_LANDING_SEGMENTS in client/src/App.tsx).
function isReservedLandingSegment(segment: string): boolean {
  return (
    isReservedSlug(segment) ||
    segment === "oauth" ||
    segment === "print" ||
    segment === "nfc-order" ||
    segment === "nfc-guide" ||
    (Object.values(DEFAULT_PAGE_SLUGS) as string[]).includes(segment)
  );
}

function staticRoutes(pageSlugs?: Partial<PageSlugs> | null) {
  const exact = new Set<string>(["/", "/nfc-guide", "/nfc-order"]);
  const vcards = new Set<string>();
  const blogs = new Set<string>();
  const hubs = new Set<string>();
  for (const slugs of [pageSlugs, null]) {
    const paths = buildPagePaths(slugs);
    for (const key of ["thankYou", "privacyPolicy", "termsOfService", "contact", "faq", "blog", "portfolio", "hub", "links"] as const) {
      exact.add(paths[key]);
    }
    vcards.add(paths.vcard);
    blogs.add(paths.blog);
    hubs.add(paths.hub);
  }
  return { exact, vcards, blogs, hubs };
}

async function findLanding(segment: string, language: "en" | "pt"): Promise<LandingRow | null> {
  // `/br/x` prefers the `x-br` row and falls back to the base row, exactly like
  // DynamicLanding does on the client.
  if (language === "pt" && !segment.endsWith("-br")) {
    return (await getLandingRow(`${segment}-br`)) ?? (await getLandingRow(segment));
  }
  return getLandingRow(segment);
}

const NOT_FOUND = { status: 404, noindex: true, landing: null, alternate: null, blog: null } as const;

export async function resolveRoute(
  pathname: string,
  pageSlugs?: Partial<PageSlugs> | null,
): Promise<RouteResolution> {
  const clean = trimSlash(pathname);
  const noindex = isNoindexPath(clean, pageSlugs);
  const ok = (extra: Partial<RouteResolution> = {}): RouteResolution => ({
    status: 200,
    noindex,
    landing: null,
    alternate: null,
    blog: null,
    ...extra,
  });

  const normalized = legacyLanguagePath(clean) ?? clean;
  const { path, language } = splitLanguagePath(normalized);

  // splitLanguagePath leaves `/br/admin`, `/br/e/x`, `/br/links`... untouched:
  // an exempt route under the language prefix is not a page.
  if (path === "/br" || path.startsWith("/br/")) return { ...NOT_FOUND };

  const routes = staticRoutes(pageSlugs);
  if (routes.exact.has(path)) return ok();
  if (hasPrefix(path, "/admin") || hasPrefix(path, "/oauth") || hasPrefix(path, "/print")) return ok();
  if (["/e/", "/p/", "/f/"].some((prefix) => path.startsWith(prefix) && path.length > prefix.length)) return ok();
  for (const vcard of Array.from(routes.vcards)) if (hasPrefix(path, vcard)) return ok();
  for (const hub of Array.from(routes.hubs)) {
    if (path === `${hub}/grupo` || path === `${hub}/group`) return ok();
  }

  try {
    for (const blog of Array.from(routes.blogs)) {
      if (!path.startsWith(`${blog}/`)) continue;
      const slug = path.slice(blog.length + 1);
      if (!slug || slug.includes("/")) return { ...NOT_FOUND };
      const post = await getPublishedBlogRow(slug);
      return post ? ok({ blog: post }) : { ...NOT_FOUND };
    }

    const segments = path.slice(1).split("/");
    if (segments.length === 1 && segments[0] && !isReservedLandingSegment(segments[0])) {
      const landing = await findLanding(segments[0], language);
      if (!landing) return { ...NOT_FOUND };
      const alternate = landing.alternateSlug ? await getLandingRow(landing.alternateSlug) : null;
      return ok({ landing, alternate });
    }
  } catch (err) {
    // Fail open: a database error must not turn a valid page into a 404.
    console.error("[seo] route lookup failed, serving 200:", (err as Error).message);
    return ok();
  }

  return { ...NOT_FOUND };
}
