import { BlogGenerator } from "./lib/blog-generator.js";
import { fetchAllRssSources } from "./lib/rssFetcher.js";

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const MIN_BLOG_INTERVAL_MS = 60 * 60 * 1000; // 60min clamp per Phase 38 D-01

// Phase 38 BLOG2-14: read postsPerDay on every tick so admin changes
// take effect on the next interval boundary (no restart, no clearTimeout).
async function getBlogIntervalMs(): Promise<number> {
  const { storage } = await import("./storage.js");
  const settings = await storage.getBlogSettings();
  if (!settings || settings.postsPerDay <= 0) return MIN_BLOG_INTERVAL_MS;
  return Math.max(DAY_IN_MS / settings.postsPerDay, MIN_BLOG_INTERVAL_MS);
}

async function blogTick(): Promise<void> {
  try {
    const { storage } = await import("./storage.js");
    const settings = await storage.getBlogSettings();
    // postsPerDay = 0 → poll mode (don't generate, but keep the loop alive
    // so a future re-enable is observed without restart).
    if (!settings || settings.postsPerDay <= 0) {
      console.log("[cron] blog generation skipped: posts_per_day_zero (poll mode)");
      return;
    }
    const result = await BlogGenerator.generate({ manual: false });
    if (result.skipped) {
      console.log(`[cron] blog generation skipped: ${result.reason}`);
    } else {
      console.log(`[cron] blog generation completed: postId=${result.postId}`);
    }
  } catch (err) {
    console.error("[cron] blog generation error:", err);
  } finally {
    const nextMs = await getBlogIntervalMs();
    console.log(`[cron] blog next tick in ${Math.round(nextMs / 60_000)}min`);
    setTimeout(blogTick, nextMs);
  }
}

export function startCron(): void {
  if (process.env.VERCEL) {
    // Vercel is serverless — no persistent process; cron is triggered via POST /api/blog/cron/generate
    // and POST /api/blog/cron/fetch-rss (configured in vercel.json).
    return;
  }

  // Phase 38 BLOG2-14: dynamic interval = max(24h / postsPerDay, 60min).
  // First tick fires AFTER the initial computed interval — matches setInterval semantics.
  console.log("[cron] blog auto-generator starting (recursive setTimeout, postsPerDay-driven)");
  void getBlogIntervalMs().then((ms) => {
    console.log(`[cron] blog first tick in ${Math.round(ms / 60_000)}min`);
    setTimeout(blogTick, ms);
  });

  // RSS fetcher remains on setInterval per Phase 38 CONTEXT D-06 (deferred).
  console.log("[rss-fetcher] cron starting — runs every 60 minutes");
  setInterval(async () => {
    try {
      const summary = await fetchAllRssSources();
      console.log(
        `[rss-fetcher] cron tick: sources=${summary.sourcesProcessed} upserted=${summary.itemsUpserted} errors=${summary.errors.length}`,
      );
    } catch (err) {
      console.error("[rss-fetcher] cron error:", err);
    }
  }, HOUR_IN_MS);
}
