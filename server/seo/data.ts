import { storage } from "../storage.js";
import type { CompanySettings, Page } from "#shared/schema.js";

// Cached (5 min) reads the SEO layer needs on every page request.

export interface LandingRow {
  slug: string;
  language: Page["language"];
  alternateSlug: string | null;
  sections: Page["sections"];
  updatedAt: Date | null;
}

export interface BlogRow {
  slug: string;
  title: string;
  metaDescription: string | null;
  featureImageUrl: string | null;
}

import { blogCache, landingCache, settingsCache } from "./caches.js";

export { invalidateSeoCache } from "./caches.js";

export function getSeoSettings(): Promise<CompanySettings> {
  return settingsCache.get("settings", () => storage.getCompanySettings());
}

/** The ACTIVE managed-landing row for a DB slug (`x` or `x-br`), or null. */
export function getLandingRow(slug: string): Promise<LandingRow | null> {
  return landingCache.get(slug, async () => {
    const row = await storage.getPageBySlug(slug);
    if (!row || !row.isActive) return null;
    return {
      slug: row.slug,
      language: row.language,
      alternateSlug: row.alternateSlug,
      sections: row.sections,
      updatedAt: row.updatedAt,
    };
  });
}

/** The PUBLISHED blog post for a slug, or null. */
export function getPublishedBlogRow(slug: string): Promise<BlogRow | null> {
  return blogCache.get(slug, async () => {
    const post = await storage.getBlogPostBySlug(slug);
    if (!post || post.status !== "published") return null;
    return {
      slug: post.slug,
      title: post.title,
      metaDescription: post.metaDescription,
      featureImageUrl: post.featureImageUrl,
    };
  });
}
