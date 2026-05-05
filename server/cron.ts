import { BlogGenerator } from "./lib/blog-generator.js";
import { fetchAllRssSources } from "./lib/rssFetcher.js";

const HOUR_IN_MS = 60 * 60 * 1000;

export function startCron(): void {
  if (process.env.VERCEL) {
    // Vercel is serverless — no persistent process; cron is triggered via POST /api/blog/cron/generate
    // and POST /api/blog/cron/fetch-rss (configured in vercel.json).
    return;
  }

  console.log("[cron] blog auto-generator starting — runs every 60 minutes");
  setInterval(async () => {
    try {
      const result = await BlogGenerator.generate({ manual: false });
      if (result.skipped) {
        console.log(`[cron] blog generation skipped: ${result.reason}`);
      } else {
        console.log(`[cron] blog generation completed: postId=${result.postId}`);
      }
    } catch (err) {
      console.error("[cron] blog generation error:", err);
    }
  }, HOUR_IN_MS);

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
