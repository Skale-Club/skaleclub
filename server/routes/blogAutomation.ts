import type { Express } from "express";
import { storage } from "../storage.js";
import { insertBlogSettingsSchema } from "#shared/schema.js";
import { BlogGenerator } from "../lib/blog-generator.js";
import { requireAdmin, isAuthorizedCronRequest } from "./_shared.js";

const BLOG_SETTINGS_DEFAULTS = {
  enabled: false,
  postsPerDay: 0,
  seoKeywords: "",
  enableTrendAnalysis: false,
  promptStyle: "",
  lastRunAt: null,
  lockAcquiredAt: null,
};

export function registerBlogAutomationRoutes(app: Express) {
  // BLOG-13: GET /api/blog/settings — public, safe defaults when no DB row
  app.get("/api/blog/settings", async (_req, res) => {
    const row = await storage.getBlogSettings();
    res.json(row ?? BLOG_SETTINGS_DEFAULTS);
  });

  // BLOG-13: PUT /api/blog/settings — admin-auth, upsert + return saved row
  // Omit lockAcquiredAt and lastRunAt so admin saves cannot corrupt lock or timing state (RESEARCH.md Pitfall 5)
  app.put("/api/blog/settings", requireAdmin, async (req, res) => {
    const parsed = insertBlogSettingsSchema
      .omit({ lockAcquiredAt: true, lastRunAt: true })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const saved = await storage.upsertBlogSettings(parsed.data);
    res.json(saved);
  });

  // BLOG-14: POST /api/blog/generate — admin-auth, manual trigger
  // Skip results are 200 (not 4xx) per BLOG-14 requirement
  // Errors return { error } with 500 — structured response, not unhandled express-async-errors
  app.post("/api/blog/generate", requireAdmin, async (_req, res) => {
    try {
      const result = await BlogGenerator.generate({ manual: true });
      if (result.skipped) {
        return res.json({ skipped: result.skipped, reason: result.reason });
      }
      res.json({ jobId: result.jobId, postId: result.postId, post: result.post });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // BLOG-15: POST /api/blog/cron/generate — Bearer token auth (no session)
  app.post("/api/blog/cron/generate", async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const result = await BlogGenerator.generate({ manual: false });
    if (result.skipped) {
      return res.json({ skipped: result.skipped, reason: result.reason });
    }
    res.json({ jobId: result.jobId, postId: result.postId });
  });

  // BLOG-19: GET /api/blog/jobs/latest — admin-auth, returns most recent job or null
  app.get("/api/blog/jobs/latest", requireAdmin, async (_req, res) => {
    const job = await storage.getLatestBlogGenerationJob();
    res.json(job ?? null);
  });
}
