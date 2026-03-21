export interface PageSlugs {
  thankYou: string;
  privacyPolicy: string;
  termsOfService: string;
  contact: string;
  faq: string;
  blog: string;
  portfolio: string;
  links: string;
  vcard: string;
}

export const DEFAULT_PAGE_SLUGS: PageSlugs = {
  thankYou: "thankyou",
  privacyPolicy: "privacy-policy",
  termsOfService: "terms-of-service",
  contact: "contact",
  faq: "faq",
  blog: "blog",
  portfolio: "portfolio",
  links: "links",
  vcard: "vcard",
};

function sanitizeSingleSlug(value: string | null | undefined, fallback: string) {
  const normalized = (value || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9/-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");

  const cleaned = normalized
    .split("/")
    .map((segment) => segment.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");

  return cleaned || fallback;
}

export function resolvePageSlugs(pageSlugs?: Partial<PageSlugs> | null): PageSlugs {
  return {
    thankYou: sanitizeSingleSlug(pageSlugs?.thankYou, DEFAULT_PAGE_SLUGS.thankYou),
    privacyPolicy: sanitizeSingleSlug(pageSlugs?.privacyPolicy, DEFAULT_PAGE_SLUGS.privacyPolicy),
    termsOfService: sanitizeSingleSlug(pageSlugs?.termsOfService, DEFAULT_PAGE_SLUGS.termsOfService),
    contact: sanitizeSingleSlug(pageSlugs?.contact, DEFAULT_PAGE_SLUGS.contact),
    faq: sanitizeSingleSlug(pageSlugs?.faq, DEFAULT_PAGE_SLUGS.faq),
    blog: sanitizeSingleSlug(pageSlugs?.blog, DEFAULT_PAGE_SLUGS.blog),
    portfolio: sanitizeSingleSlug(pageSlugs?.portfolio, DEFAULT_PAGE_SLUGS.portfolio),
    links: sanitizeSingleSlug(pageSlugs?.links, DEFAULT_PAGE_SLUGS.links),
    vcard: sanitizeSingleSlug(pageSlugs?.vcard, DEFAULT_PAGE_SLUGS.vcard),
  };
}

function toPath(slug: string) {
  return `/${slug}`;
}

export function buildPagePaths(pageSlugs?: Partial<PageSlugs> | null) {
  const slugs = resolvePageSlugs(pageSlugs);
  const blog = toPath(slugs.blog);
  const vcard = toPath(slugs.vcard);

  return {
    home: "/",
    thankYou: toPath(slugs.thankYou),
    privacyPolicy: toPath(slugs.privacyPolicy),
    termsOfService: toPath(slugs.termsOfService),
    contact: toPath(slugs.contact),
    faq: toPath(slugs.faq),
    blog,
    blogPostPattern: `${blog}/:slug`,
    blogPost: (slug: string) => `${blog}/${slug}`,
    portfolio: toPath(slugs.portfolio),
    links: toPath(slugs.links),
    vcard,
    vcardPattern: `${vcard}/:username`,
    vcardUser: (username: string) => `${vcard}/${username}`,
  };
}

export function isRoutePrefixMatch(location: string, routePath: string) {
  return location === routePath || location.startsWith(`${routePath}/`);
}

export function getPageSlugsValidationError(pageSlugs?: Partial<PageSlugs> | null) {
  const resolved = resolvePageSlugs(pageSlugs);
  const seen = new Map<string, string>();

  for (const [key, value] of Object.entries(resolved)) {
    if (value === "admin" || value.startsWith("admin/")) {
      return `The slug "${value}" is reserved for admin routes.`;
    }

    if (value === "api" || value.startsWith("api/")) {
      return `The slug "${value}" is reserved for API routes.`;
    }

    const existingKey = seen.get(value);
    if (existingKey) {
      return `The slug "${value}" is duplicated between "${existingKey}" and "${key}".`;
    }

    seen.set(value, key);
  }

  return null;
}
