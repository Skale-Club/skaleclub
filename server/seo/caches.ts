import type { CompanySettings } from "#shared/schema.js";
import { TtlCache } from "./cache.js";
import type { BlogRow, LandingRow } from "./data.js";

// Leaf module: server/storage.ts calls invalidateSeoCache() after writes, and
// data.ts imports storage, so the caches live here to avoid an import cycle.
export const settingsCache = new TtlCache<CompanySettings>();
export const landingCache = new TtlCache<LandingRow | null>();
export const blogCache = new TtlCache<BlogRow | null>();

export function invalidateSeoCache(): void {
  settingsCache.clear();
  landingCache.clear();
  blogCache.clear();
}
