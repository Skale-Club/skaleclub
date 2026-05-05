import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import {
  insertBlogSettingsSchema,
  insertBlogRssSourceSchema,
  blogRssItemStatusSchema,
} from "#shared/schema.js";
import { BlogGenerator, runPreview } from "../lib/blog-generator.js";
import { fetchAllRssSources } from "../lib/rssFetcher.js";
import { slugifyTitle } from "../lib/blogContentValidator.js";
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

  // RSS-06: POST /api/blog/cron/fetch-rss — Bearer token auth, runs the RSS fetcher
  app.post("/api/blog/cron/fetch-rss", async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const summary = await fetchAllRssSources();
      res.json(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // BLOG-19: GET /api/blog/jobs/latest — admin-auth, returns most recent job or null
  app.get("/api/blog/jobs/latest", requireAdmin, async (_req, res) => {
    const job = await storage.getLatestBlogGenerationJob();
    res.json(job ?? null);
  });

  // Phase 37 BLOG2-12: GET /api/blog/health — admin-auth, drives the red banner
  // in AutomationStatusBanners.tsx. Returns booleans only (no secrets).
  app.get("/api/blog/health", requireAdmin, async (_req, res) => {
    const apiKeyConfigured = Boolean(process.env.BLOG_GEMINI_API_KEY?.trim());
    const integration = await storage.getChatIntegration("gemini");
    const integrationEnabled = Boolean(integration?.enabled);
    res.json({ apiKeyConfigured, integrationEnabled });
  });

  // ========================================================================
  // Phase 37 — Admin RSS Sources CRUD (BLOG2-07)
  // ========================================================================

  // GET /api/blog/rss-sources — list all sources
  app.get("/api/blog/rss-sources", requireAdmin, async (_req, res) => {
    const rows = await storage.listRssSources();
    res.json(rows);
  });

  // POST /api/blog/rss-sources — create new source
  app.post("/api/blog/rss-sources", requireAdmin, async (req, res) => {
    const parsed = insertBlogRssSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const created = await storage.createRssSource(parsed.data);
    res.status(201).json(created);
  });

  // PATCH /api/blog/rss-sources/:id — partial update (name, url, enabled)
  app.patch("/api/blog/rss-sources/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid source id" });
    }
    const parsed = insertBlogRssSourceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.updateRssSource(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Source not found" });
    res.json(updated);
  });

  // DELETE /api/blog/rss-sources/:id — cascade-deletes blog_rss_items via FK
  app.delete("/api/blog/rss-sources/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid source id" });
    }
    const existing = await storage.getRssSource(id);
    if (!existing) return res.status(404).json({ message: "Source not found" });
    await storage.deleteRssSource(id);
    res.status(204).end();
  });

  // ========================================================================
  // Phase 37 — RSS Items Queue (BLOG2-08)
  // ========================================================================

  // GET /api/blog/rss-items?status=pending|used|skipped&limit=50&offset=0
  app.get("/api/blog/rss-items", requireAdmin, async (req, res) => {
    const querySchema = z.object({
      status: blogRssItemStatusSchema,
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { status, limit, offset } = parsed.data;
    const rows = await storage.listRssItemsByStatus(status, limit, offset);
    res.json(rows);
  });

  // ========================================================================
  // Phase 37 — Job History + Retry + Cancel (BLOG2-10, BLOG2-11)
  // ========================================================================

  // GET /api/blog/jobs?limit=50 — last N jobs joined with rssItemTitle
  app.get("/api/blog/jobs", requireAdmin, async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const rows = await storage.listBlogGenerationJobs(limit);
    res.json(rows);
  });

  // POST /api/blog/jobs/:id/retry — re-run generation against the same RSS item
  // D-09: creates a NEW job row; the original failed row is preserved unchanged.
  app.post("/api/blog/jobs/:id/retry", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid job id" });
    }
    const job = await storage.getBlogGenerationJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (!job.postId) {
      return res.status(409).json({
        message: "Source item no longer available — generate a new run instead",
      });
    }
    // Info-9: O(1) joined single-row read instead of scanning listBlogGenerationJobs(200).find(...)
    const jobRow = await storage.getBlogGenerationJobWithRssItem(id);
    if (!jobRow || !jobRow.rssItemId) {
      return res.status(409).json({
        message: "Source item no longer available — generate a new run instead",
      });
    }
    try {
      const result = await BlogGenerator.generate({ manual: true, rssItemId: jobRow.rssItemId });
      if (result.skipped) {
        return res.json({ skipped: true, reason: result.reason });
      }
      res.json({ jobId: result.jobId, postId: result.postId, post: result.post });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/blog/jobs/:id/cancel — release stale lock + mark job cancelled
  // D-10: only allowed if lockAcquiredAt is older than 10 minutes.
  app.post("/api/blog/jobs/:id/cancel", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid job id" });
    }
    const job = await storage.getBlogGenerationJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "running") {
      return res.status(409).json({ message: "Only running jobs can be cancelled" });
    }
    const settings = await storage.getBlogSettings();
    const STALE_MS = 10 * 60 * 1000;
    const lockedAt = settings?.lockAcquiredAt ? new Date(settings.lockAcquiredAt).getTime() : 0;
    const ageMs = Date.now() - lockedAt;
    if (!lockedAt || ageMs < STALE_MS) {
      return res.status(409).json({
        message: `Lock not stale yet (age: ${Math.round(ageMs / 1000)}s; needs >600s)`,
      });
    }
    if (settings) {
      await storage.upsertBlogSettings({
        enabled: settings.enabled,
        postsPerDay: settings.postsPerDay,
        seoKeywords: settings.seoKeywords,
        enableTrendAnalysis: settings.enableTrendAnalysis,
        promptStyle: settings.promptStyle,
        lockAcquiredAt: null,
        lastRunAt: settings.lastRunAt,
      });
    }
    const updated = await storage.updateBlogGenerationJob(id, {
      status: "failed",
      reason: "cancelled_by_admin",
      completedAt: new Date(),
    });
    res.json(updated);
  });

  // ========================================================================
  // Phase 37 — Preview-then-Commit (BLOG2-09)
  // ========================================================================

  // POST /api/blog/preview — generate WITHOUT writing post or job row
  // D-07: optional rssItemId override; otherwise uses selectNextRssItem.
  app.post("/api/blog/preview", requireAdmin, async (req, res) => {
    const bodySchema = z.object({
      rssItemId: z.number().int().positive().optional(),
    });
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    try {
      const result = await runPreview({ rssItemId: parsed.data.rssItemId });
      if (result.skipped) {
        return res.json({ skipped: true, reason: result.reason });
      }
      res.json({
        skipped: false,
        preview: {
          title: result.result.title,
          slug: result.result.slug,
          content: result.result.content,
          excerpt: result.result.excerpt,
          metaDescription: result.result.metaDescription,
          focusKeyword: result.result.focusKeyword,
          tags: result.result.tags,
          featureImageUrl: result.result.featureImageUrl,
          rssItemId: result.result.rssItem.id,
          rssItemTitle: result.result.rssItem.title,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/blog/posts/from-preview — atomic commit of a previewed payload
  // D-07: createBlogPost + markRssItemUsed in one handler. If markRssItemUsed
  // fails after createBlogPost succeeds, the post is preserved (matches the
  // generator's contract: post creation is the source of truth).
  app.post("/api/blog/posts/from-preview", requireAdmin, async (req, res) => {
    const bodySchema = z.object({
      title: z.string().min(1).max(500),
      content: z.string().min(1),
      excerpt: z.string().default(""),
      metaDescription: z.string().default(""),
      focusKeyword: z.string().default(""),
      tags: z.array(z.string()).default([]),
      featureImageUrl: z.string().url().nullable().default(null),
      rssItemId: z.number().int().positive(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const data = parsed.data;
    // Recompute slug server-side defensively (Info-8: do not trust client slug).
    const slug = slugifyTitle(data.title) || `blog-post-${Date.now()}`;
    try {
      const post = await storage.createBlogPost({
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
        tags: data.tags.join(", "),
        featureImageUrl: data.featureImageUrl,
        status: "draft",
        authorName: "AI Assistant",
      });
      try {
        await storage.markRssItemUsed(data.rssItemId, post.id);
      } catch (markErr) {
        const m = markErr instanceof Error ? markErr.message : String(markErr);
        console.warn(`[from-preview] markRssItemUsed failed for item ${data.rssItemId}: ${m}`);
      }
      res.status(201).json(post);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}
