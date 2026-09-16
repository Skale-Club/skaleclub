import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertBlogPostSchema } from "#shared/schema.js";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { requireAdmin, sendError, setPublicCache } from "./_shared.js";
import { sanitizeBlogHtml } from "../lib/blogContentValidator.js";

export function registerBlogRoutes(app: Express) {
  // Listing. `status` used to be passed straight through and omitting it
  // returned the whole table, so drafts written by the blog automation and
  // waiting in the admin approval queue were readable by anyone who asked for
  // `/api/blog?status=draft`. The table happens to be empty today; that is
  // timing, not a safeguard.
  //
  // The admin panel genuinely needs every status (BlogSection lists all posts,
  // PostApprovalPanel asks for drafts), so rather than splitting the route and
  // rewriting its callers and their query keys, anything other than
  // `status=published` now has to get past requireAdmin first.
  const requireAdminForNonPublished: RequestHandler = (req, res, next) => {
    if (req.query.status === "published") return next();
    return requireAdmin(req, res, next);
  };

  app.get("/api/blog", requireAdminForNonPublished, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      if (status === "published" && limit) {
        const posts = await storage.getPublishedBlogPosts(limit, offset);
        setPublicCache(res, 300);
        res.json(posts);
      } else if (status === "published") {
        const posts = await storage.getBlogPosts(status);
        setPublicCache(res, 300);
        res.json(posts);
      } else {
        // Admin-only past this point.
        const posts = status
          ? await storage.getBlogPosts(status)
          : await storage.getBlogPosts();
        res.json(posts);
      }
    } catch (err) {
      console.error("[blog] GET /api/blog failed:", err);
      res.status(500).json({ message: "Failed to load blog posts" });
    }
  });

  app.get("/api/blog/count", async (_req, res) => {
    try {
      const count = await storage.countPublishedBlogPosts();
      setPublicCache(res, 300);
      res.json({ count });
    } catch (err) {
      console.error("[blog] GET /api/blog/count failed:", err);
      res.status(500).json({ message: "Failed to count blog posts" });
    }
  });

  app.delete("/api/blog/tags/:tag", requireAdmin, async (req, res) => {
    try {
      const rawTag = decodeURIComponent(req.params.tag || "").trim();
      if (!rawTag) {
        return res.status(400).json({ message: "Tag is required" });
      }
      const posts = await storage.getBlogPosts();
      const target = rawTag.toLowerCase();
      let updatedCount = 0;
      for (const post of posts) {
        const tags = (post.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (!tags.length) continue;
        const filtered = tags.filter((tag) => tag.toLowerCase() !== target);
        if (filtered.length !== tags.length) {
          await storage.updateBlogPost(post.id, { tags: filtered.join(",") });
          updatedCount += 1;
        }
      }
      res.json({ success: true, tag: rawTag, updatedCount });
    } catch (err) {
      sendError(res, err, "Failed to delete tag");
    }
  });

  app.put("/api/blog/tags/:tag", requireAdmin, async (req, res) => {
    try {
      const rawTag = decodeURIComponent(req.params.tag || "").trim();
      const nextTag = String(req.body?.name || "").trim();
      if (!rawTag || !nextTag) {
        return res.status(400).json({ message: "Tag and new name are required" });
      }
      const fromLower = rawTag.toLowerCase();
      const toLower = nextTag.toLowerCase();
      const posts = await storage.getBlogPosts();
      let updatedCount = 0;

      for (const post of posts) {
        const tags = (post.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (!tags.length) continue;

        const seen = new Set<string>();
        let changed = false;
        const nextTags: string[] = [];

        for (const tag of tags) {
          const lower = tag.toLowerCase();
          if (lower === fromLower) {
            changed = true;
            if (!seen.has(toLower)) {
              seen.add(toLower);
              nextTags.push(nextTag);
            }
            continue;
          }
          if (!seen.has(lower)) {
            seen.add(lower);
            nextTags.push(tag);
          }
        }

        if (changed) {
          await storage.updateBlogPost(post.id, { tags: nextTags.join(",") });
          updatedCount += 1;
        }
      }

      res.json({ success: true, tag: rawTag, renamedTo: nextTag, updatedCount });
    } catch (err) {
      sendError(res, err, "Failed to rename tag");
    }
  });

  app.get("/api/blog/:idOrSlug", async (req, res) => {
    try {
      const param = req.params.idOrSlug;
      let post;

      if (/^\d+$/.test(param)) {
        post = await storage.getBlogPost(Number(param));
      } else {
        post = await storage.getBlogPostBySlug(param);
      }

      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }

      // An unpublished post is only visible to a signed-in admin. Without this,
      // knowing (or guessing) a draft's id or slug was enough to read it, which
      // is how the admin preview dialog reaches drafts — so the check is on the
      // session rather than a separate route.
      if (post.status !== "published") {
        const sess = req.session as { userId?: string } | undefined;
        if (!sess?.userId) {
          return res.status(404).json({ message: "Blog post not found" });
        }
        const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
        if (!dbUser?.isAdmin) {
          return res.status(404).json({ message: "Blog post not found" });
        }
      }

      res.json(post);
    } catch (err) {
      console.error("[blog] GET /api/blog/:idOrSlug failed:", err);
      res.status(500).json({ message: "Failed to load blog post" });
    }
  });

  app.get("/api/blog/:id/related", async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 4;
      const posts = await storage.getRelatedBlogPosts(Number(req.params.id), limit);
      setPublicCache(res, 300);
      res.json(posts);
    } catch (err) {
      console.error("[blog] GET /api/blog/:id/related failed:", err);
      res.status(500).json({ message: "Failed to load related posts" });
    }
  });

  app.post("/api/blog", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.parse(req.body);
      if (typeof validatedData.content === "string") {
        validatedData.content = sanitizeBlogHtml(validatedData.content);
      }
      const post = await storage.createBlogPost(validatedData);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      sendError(res, err, "Failed to create post");
    }
  });

  app.put("/api/blog/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.partial().parse(req.body);
      if (typeof validatedData.content === "string") {
        validatedData.content = sanitizeBlogHtml(validatedData.content);
      }
      const post = await storage.updateBlogPost(Number(req.params.id), validatedData);
      res.json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      sendError(res, err, "Failed to update post");
    }
  });

  app.delete("/api/blog/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBlogPost(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "Failed to delete post");
    }
  });
}
