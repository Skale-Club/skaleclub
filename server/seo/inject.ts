import { legacyLanguagePath, splitLanguagePath, withLanguage } from "#shared/languagePath.js";
import { buildPagePaths } from "#shared/pageSlugs.js";
import { CORE_SEO, coreKeyForPath, corePathForKey, type CoreSeoKey } from "#shared/coreSeo.js";
import {
  CORE_OG_IMAGE,
  LANDING_SEO,
  getLandingSeo,
  landingPathForSlug,
  slugForLandingPath,
  type SeoImage,
} from "#shared/landingSeo.js";
import type { CompanySettings } from "#shared/schema.js";
import { HeadEditor } from "./head.js";
import type { RouteResolution } from "./routes.js";
import { absoluteUrl, breadcrumbs, landingFaq, nfcGuideFaq, nfcProduct, organizationGraph } from "./structuredData.js";

// Per-page <head> for the SPA shell: title/description/canonical/hreflang/Open
// Graph/JSON-LD, computed on the server so the very first response is right.

export function canonicalOrigin(): string {
  const fromEnv = process.env.VITE_CANONICAL_ORIGIN?.trim();
  const fromHost = process.env.CANONICAL_HOST?.trim();
  return (fromEnv || (fromHost ? `https://${fromHost}` : "https://skale.club")).replace(/\/$/, "");
}

export interface InjectContext {
  settings: CompanySettings | null;
  route: RouteResolution;
}

const NOINDEX_ROBOTS = "noindex, nofollow";
const NO_LANGUAGE_PAIR = new Set<CoreSeoKey>(["links"]);
const NFC_GUIDE_CRUMB = { en: "NFC Keychain Guide", pt: "Guia de Chaveiros NFC" };
const NFC_PRODUCT_NAME = { en: "Custom NFC Keychains", pt: "Chaveiros NFC Personalizados" };

type Alternates = { en: string; pt: string } | null;

function baseSlugOf(slug: string): string {
  return slug.endsWith("-br") ? slug.slice(0, -3) : slug;
}

function hasStaticPair(slug: string): boolean {
  const base = baseSlugOf(slug);
  return base !== "" && Boolean(LANDING_SEO[base]) && Boolean(LANDING_SEO[`${base}-br`]);
}

export function injectSeo(html: string, pathname: string, ctx: InjectContext): string {
  const { settings, route } = ctx;
  const origin = canonicalOrigin();
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const normalized = legacyLanguagePath(cleanPath) ?? cleanPath;
  const { path: basePath, language } = splitLanguagePath(normalized);
  const pageSlugs = settings?.pageSlugs;
  const head = new HeadEditor(html);

  const urlSlug = slugForLandingPath(normalized);
  const landing = route.landing;
  // Curated copy is keyed by the DB row that actually serves the URL; when the
  // row lookup was skipped (database error) fall back to the URL's own slug.
  const seoSlug = landing?.slug ?? urlSlug;
  const seo = seoSlug ? getLandingSeo(seoSlug) : undefined;

  // Private, unknown and tooling URLs: keep them out of the index and out of
  // canonical/hreflang/JSON-LD. Curated title/description still apply so a
  // shared link (e.g. the NFC order form) previews properly.
  if (route.noindex || route.status === 404) {
    head.meta("name", "robots", NOINDEX_ROBOTS);
    head.canonical(null).removeMeta("property", "og:url").alternates([]).jsonLd([]);
    if (seo && route.status === 200) {
      head.title(seo.title).meta("name", "description", seo.description);
      head.meta("property", "og:title", seo.title).meta("property", "og:description", seo.description);
      head.meta("property", "og:locale", seo.locale).lang(seo.locale === "pt_BR" ? "pt-BR" : "en");
    } else if (language === "pt") {
      head.lang("pt-BR").meta("property", "og:locale", "pt_BR");
    }
    return head.toString();
  }

  const coreKey = landing ? undefined : coreKeyForPath(basePath, pageSlugs);
  const blog = route.blog;

  // ---- canonical path and language alternates --------------------------------
  let canonicalPath = normalized;
  let alternates: Alternates = null;
  if (landing) {
    canonicalPath = landingPathForSlug(landing.slug);
    const isPt = landing.language === "pt";
    const alternateSlug = route.alternate?.slug ?? (hasStaticPair(landing.slug) ? (isPt ? baseSlugOf(landing.slug) : `${landing.slug}-br`) : null);
    if (alternateSlug) {
      const self = canonicalPath;
      const other = landingPathForSlug(alternateSlug);
      alternates = isPt ? { en: other, pt: self } : { en: self, pt: other };
    }
  } else if (coreKey) {
    const enPath = corePathForKey(coreKey, pageSlugs);
    canonicalPath = language === "pt" && !NO_LANGUAGE_PAIR.has(coreKey) ? withLanguage(enPath, "pt") : enPath;
    if (!NO_LANGUAGE_PAIR.has(coreKey)) alternates = { en: enPath, pt: withLanguage(enPath, "pt") };
  } else if (blog) {
    // Post bodies are single-language: `/br/blog/x` reuses the English post, so
    // it canonicalises to the English URL and advertises no language pair.
    canonicalPath = basePath;
  } else if (seo && hasStaticPair(seoSlug)) {
    const base = baseSlugOf(seoSlug);
    alternates = { en: landingPathForSlug(base), pt: landingPathForSlug(`${base}-br`) };
  }

  const canonical = `${origin}${canonicalPath === "/br" ? "/br" : canonicalPath}`;
  const isPt = seo ? seo.locale === "pt_BR" : landing ? landing.language === "pt" || language === "pt" : language === "pt";
  const locale = isPt ? "pt_BR" : "en_US";

  head.lang(isPt ? "pt-BR" : "en").canonical(canonical);
  head.meta("property", "og:url", canonical).meta("property", "og:locale", locale);

  if (alternates) {
    const enHref = `${origin}${alternates.en}`;
    head.alternates([
      { hreflang: "en", href: enHref },
      { hreflang: "pt-BR", href: `${origin}${alternates.pt}` },
      { hreflang: "x-default", href: enHref },
    ]);
  } else {
    head.alternates([]);
  }

  // ---- title, description, image ----------------------------------------------
  let title: string | undefined;
  let description: string | undefined;
  let image: SeoImage | undefined;
  let imageUrl: string | undefined;
  if (seo) {
    title = seo.title;
    description = seo.description;
    image = seo.ogImage;
  } else if (coreKey) {
    const copy = CORE_SEO[coreKey][isPt ? "pt" : "en"];
    title = copy?.title;
    description = copy?.description;
    image = CORE_SEO[coreKey].ogImage;
  } else if (blog) {
    title = `${blog.title} | ${settings?.companyName?.trim() || "Blog"}`;
    description = blog.metaDescription || undefined;
    imageUrl = blog.featureImageUrl ? absoluteUrl(origin, blog.featureImageUrl) : undefined;
  }

  if (title) {
    const socialTitle = blog ? blog.title : title;
    head.title(title).meta("property", "og:title", socialTitle).meta("name", "twitter:title", socialTitle);
  }
  if (description) {
    head
      .meta("name", "description", description)
      .meta("property", "og:description", description)
      .meta("name", "twitter:description", description);
  }
  if (image) {
    imageUrl = absoluteUrl(origin, image.path);
    head.meta("property", "og:image:width", String(image.width)).meta("property", "og:image:height", String(image.height));
  }
  // A post's own image has unknown dimensions: drop the site image's.
  if (imageUrl && !image) head.removeMeta("property", "og:image:width").removeMeta("property", "og:image:height");
  if (imageUrl) head.meta("property", "og:image", imageUrl).meta("name", "twitter:image", imageUrl);
  if (blog) head.meta("property", "og:type", "article");
  if (seo?.robots) head.meta("name", "robots", seo.robots);

  // ---- structured data ----------------------------------------------------------
  const blocks: object[] = [];
  const lang = isPt ? "pt" : "en";
  const homeCrumb = { name: CORE_SEO.home.crumb[lang], path: isPt ? "/br" : "/" };
  const blogListingPath = buildPagePaths(pageSlugs).blog;

  if (coreKey === "home") {
    const fallbackDescription =
      "Skale Club helps businesses scale with data-driven marketing systems, automation, and growth strategy.";
    blocks.push(organizationGraph(origin, settings, description || settings?.seoDescription || fallbackDescription));
  } else if (coreKey) {
    blocks.push(breadcrumbs(origin, [homeCrumb, { name: CORE_SEO[coreKey].crumb[lang], path: canonicalPath }]));
  }

  if (blog) {
    blocks.push(
      breadcrumbs(origin, [
        homeCrumb,
        { name: CORE_SEO.blog.crumb[lang], path: isPt ? withLanguage(blogListingPath, "pt") : blogListingPath },
        { name: blog.title, path: canonicalPath },
      ]),
    );
  }

  if (!landing && baseSlugOf(urlSlug) === "nfc-guide") {
    const faq = nfcGuideFaq(lang);
    if (faq) blocks.push(faq);
    blocks.push(breadcrumbs(origin, [homeCrumb, { name: NFC_GUIDE_CRUMB[lang], path: canonicalPath }]));
  }

  if (baseSlugOf(seoSlug) === "nfc-keychains") {
    blocks.push(
      nfcProduct(origin, NFC_PRODUCT_NAME[lang], description ?? "", (image ?? CORE_OG_IMAGE).path, canonical),
    );
    const faq = landingFaq(landing);
    if (faq) blocks.push(faq);
  }

  head.jsonLd(blocks);
  return head.toString();
}
