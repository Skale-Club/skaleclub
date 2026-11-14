import type { BlogPost, CompanySettings, Faq, PortfolioService } from "#shared/schema.js";
import { TtlCache } from "./cache.js";
import type { BlogRow, LandingRow } from "./data.js";

// Leaf module: server/storage.ts calls invalidateSeoCache() after writes, and
// data.ts imports storage, so the caches live here to avoid an import cycle.
export const settingsCache = new TtlCache<CompanySettings>();
export const landingCache = new TtlCache<LandingRow | null>();
export const blogCache = new TtlCache<BlogRow | null>();
// Page-content summaries (server/seo/content).
export const faqsCache = new TtlCache<Faq[]>();
export const portfolioCache = new TtlCache<PortfolioService[]>();
export const recentPostsCache = new TtlCache<BlogPost[]>();
export const postBodyCache = new TtlCache<string | null>();
export const translationsCache = new TtlCache<Map<string, string>>();

export function invalidateSeoCache(): void {
  settingsCache.clear();
  landingCache.clear();
  blogCache.clear();
  faqsCache.clear();
  portfolioCache.clear();
  recentPostsCache.clear();
  postBodyCache.clear();
  translationsCache.clear();
}
