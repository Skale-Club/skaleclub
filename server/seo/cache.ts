// Tiny in-memory TTL cache for the SEO layer. The SPA fallback runs on every
// page request, and crawlers probe arbitrary slugs, so lookups (settings, pages,
// blog posts) are cached per key for a few minutes, negatives included.
//
// A loader that throws is NOT cached: the caller decides how to fail (the route
// resolver fails open, so a database blip never turns valid pages into 404s).

export const SEO_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;

type Entry<T> = { expires: number; value: Promise<T> };

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number = SEO_CACHE_TTL_MS) {}

  get(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = loader();
    this.entries.set(key, { expires: now + this.ttlMs, value });
    // Bound the map: slug scans would otherwise grow it without limit.
    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return value;
  }

  clear() {
    this.entries.clear();
  }
}
