import { DEFAULT_PAGE_SLUGS } from "./pageSlugs.js";
import { isReservedSlug } from "./reservedSlugs.js";

export type SiteLanguage = "en" | "pt";

// The public site's language lives in the URL: no prefix = English, a leading
// `/br` segment = Portuguese (`/br`, `/br/contact`, `/br/nfc-keychains`).
// These prefixes never carry a language prefix (so `/vcard/br` stays a username).
// `links`/`vcard` below use the DEFAULT page slugs; if those slugs are
// customised in admin, this exemption (and the `/vcard/br` username
// protection) no longer holds for the customised path.
const LANGUAGE_EXEMPT_PREFIXES = [
  "/admin",
  "/api",
  "/assets",
  "/e",
  "/p",
  "/print",
  "/oauth",
  `/${DEFAULT_PAGE_SLUGS.links}`,
  `/${DEFAULT_PAGE_SLUGS.vcard}`,
];

export function isLanguageExemptPath(pathname: string): boolean {
  return LANGUAGE_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function splitLanguagePath(pathname: string): { path: string; language: SiteLanguage } {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (trimmed === "/br") return { path: "/", language: "pt" };
  if (trimmed.startsWith("/br/")) {
    const remainder = trimmed.slice(3);
    // `/br/admin` etc. must 404 rather than render an exempt route under /br.
    if (isLanguageExemptPath(remainder)) return { path: trimmed, language: "en" };
    return { path: remainder, language: "pt" };
  }
  return { path: trimmed, language: "en" };
}

function splitSuffix(to: string): [string, string] {
  const index = to.search(/[?#]/);
  return index === -1 ? [to, ""] : [to.slice(0, index), to.slice(index)];
}

export function withLanguage(to: string, language: SiteLanguage): string {
  if (language !== "pt" || !to.startsWith("/") || to.startsWith("//")) return to;
  const [pathname, suffix] = splitSuffix(to);
  if (isLanguageExemptPath(pathname) || splitLanguagePath(pathname).language === "pt") return to;
  return `/br${pathname === "/" ? "" : pathname.replace(/\/$/, "")}${suffix}`;
}

export function stripLanguage(to: string): string {
  const [pathname, suffix] = splitSuffix(to);
  return splitLanguagePath(pathname).path + suffix;
}

// A first segment that isn't safe to rewrite: it names a real route (a blog
// post or form slugged "br"), not a stray Portuguese URL shape.
function isLegacySegmentExempt(segment: string): boolean {
  if (!segment) return true;
  if (isReservedSlug(segment)) return true;
  if (segment === "attached_assets") return true;
  return (Object.values(DEFAULT_PAGE_SLUGS) as string[]).includes(segment);
}

// Maps old Portuguese URL shapes to the new `/br` prefix, or null if `pathname`
// isn't one of them. Covers the two-segment suffix form (`/x/br`) and the
// legacy single-segment form (`/x-br`); never matches anything already `/br...`,
// an exempt path (so `/vcard/br` keeps resolving as a username), or a reserved
// first segment (so `/blog/br`, `/f/br`, `/xpot/br` stay real routes/slugs).
export function legacyLanguagePath(pathname: string): string | null {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (trimmed === "/br" || trimmed.startsWith("/br/")) return null;
  if (isLanguageExemptPath(trimmed)) return null;

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 2 && segments[1] === "br" && segments[0] !== "br") {
    return isLegacySegmentExempt(segments[0]) ? null : `/br/${segments[0]}`;
  }
  if (segments.length === 1 && segments[0] !== "br" && segments[0].endsWith("-br")) {
    const slug = segments[0].slice(0, -3);
    return isLegacySegmentExempt(slug) ? null : `/br/${slug}`;
  }
  return null;
}
