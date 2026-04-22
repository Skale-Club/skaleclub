import { BlogGenerator } from "./lib/blog-generator.js";

const HOUR_IN_MS = 60 * 60 * 1000;

export function startCron(): void {
  if (process.env.VERCEL) {
    // Vercel is serverless — no persistent process; cron is triggered via POST /api/blog/cron/generate
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
}
