import type { Express } from "express";
import { storage } from "../storage.js";
import { insertPageSchema, updatePageSchema } from "#shared/schema.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { requireAdmin } from "./_shared.js";

export function registerPageRoutes(app: Express) {
  // PUBLIC — literal /slug/ segment registered FIRST to avoid colliding with /:id
  // (same pitfall guard noted at server/routes/presentations.ts:44-45)
  app.get("/api/pages/slug/:slug", async (req, res) => {
    try {
      const row = await storage.getPageBySlug(req.params.slug);
      if (!row || !row.isActive) {
        return res.status(404).json({ message: "Page not found" });
      }
      // Public response: omit internal fields per CONTEXT.md "Server endpoints"
      const { id, createdAt, updatedAt, ...publicRow } = row as any;
      res.json(publicRow);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ADMIN list
  app.get("/api/pages", requireAdmin, async (_req, res) => {
    try {
      const rows = await storage.listPages();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ADMIN get by id
  app.get("/api/pages/:id", requireAdmin, async (req, res) => {
    try {
      const row = await storage.getPage(req.params.id);
      if (!row) return res.status(404).json({ message: "Page not found" });
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ADMIN create
  app.post("/api/pages", requireAdmin, async (req, res) => {
    try {
      const parsed = insertPageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = parsed.data.slug.toLowerCase().trim();
      if (isReservedSlug(slug)) {
        return res.status(409).json({ message: `Slug "${slug}" is reserved` });
      }
      if (await storage.getPageBySlug(slug)) {
        return res.status(409).json({ message: "Slug already in use" });
      }
      const row = await storage.createPage({ ...parsed.data, slug });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // ADMIN update — supports partial body via updatePageSchema
  app.put("/api/pages/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updatePageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getPage(req.params.id);
      if (!existing) return res.status(404).json({ message: "Page not found" });

      const updateData: any = { ...parsed.data };
      if (typeof updateData.slug === "string") {
        const slug = updateData.slug.toLowerCase().trim();
        if (isReservedSlug(slug)) {
          return res.status(409).json({ message: `Slug "${slug}" is reserved` });
        }
        const slugOwner = await storage.getPageBySlug(slug);
        if (slugOwner && slugOwner.id !== existing.id) {
          return res.status(409).json({ message: "Slug already in use" });
        }
        updateData.slug = slug;
      }

      const updated = await storage.updatePage(req.params.id, updateData);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // ADMIN delete
  app.delete("/api/pages/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getPage(req.params.id);
      if (!existing) return res.status(404).json({ message: "Page not found" });
      await storage.deletePage(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}
