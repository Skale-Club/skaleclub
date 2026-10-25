import type { Express } from "express";
import { storage } from "../storage.js";
import { randomSlugSuffix } from "../lib/slug.js";
import { insertWhiteboardSchema, EMPTY_WHITEBOARD_SCENE } from "#shared/schema.js";
import { requireAdmin, sendError } from "./_shared.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "whiteboard";
}

async function buildUniqueWhiteboardSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomSlugSuffix()}`;
    if (!await storage.getWhiteboardBySlug(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function registerWhiteboardsRoutes(app: Express) {
  // Public read: every saved whiteboard is shown at /w/:slug. Registered before
  // /:id so "slug" is never taken for an id.
  app.get("/api/whiteboards/slug/:slug", async (req, res) => {
    try {
      const board = await storage.getWhiteboardBySlug(req.params.slug);
      if (!board) return res.status(404).json({ message: "Whiteboard not found" });
      res.json({ id: board.id, slug: board.slug, title: board.title, scene: board.scene, updatedAt: board.updatedAt });
    } catch (err) {
      sendError(res, err, "Failed to load whiteboard");
    }
  });

  app.get("/api/whiteboards", requireAdmin, async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json(await storage.listWhiteboards(search));
    } catch (err) {
      sendError(res, err, "Failed to load whiteboards");
    }
  });

  app.get("/api/whiteboards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid whiteboard id" });
    try {
      const board = await storage.getWhiteboard(req.params.id);
      if (!board) return res.status(404).json({ message: "Whiteboard not found" });
      res.json(board);
    } catch (err) {
      sendError(res, err, "Failed to load whiteboard");
    }
  });

  app.post("/api/whiteboards", requireAdmin, async (req, res) => {
    try {
      const parsed = insertWhiteboardSchema.pick({ title: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = await buildUniqueWhiteboardSlug(parsed.data.title);
      const board = await storage.createWhiteboard({ title: parsed.data.title, slug, scene: EMPTY_WHITEBOARD_SCENE });
      res.status(201).json(board);
    } catch (err) {
      sendError(res, err, "Failed to create whiteboard");
    }
  });

  // Saves title, slug and/or scene. The scene body can carry embedded images,
  // so this path gets the large JSON limit (LARGE_BODY_RE in server/app.ts).
  app.put("/api/whiteboards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid whiteboard id" });
    try {
      const parsed = insertWhiteboardSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getWhiteboard(req.params.id);
      if (!existing) return res.status(404).json({ message: "Whiteboard not found" });
      const updateData = { ...parsed.data };
      if (typeof updateData.slug === "string") {
        const slug = slugify(updateData.slug);
        const owner = await storage.getWhiteboardBySlug(slug);
        if (owner && owner.id !== existing.id) {
          return res.status(409).json({ message: "Slug already in use" });
        }
        updateData.slug = slug;
      }
      res.json(await storage.updateWhiteboard(existing.id, updateData));
    } catch (err) {
      sendError(res, err, "Failed to save whiteboard");
    }
  });

  app.delete("/api/whiteboards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid whiteboard id" });
    try {
      const existing = await storage.getWhiteboard(req.params.id);
      if (!existing) return res.status(404).json({ message: "Whiteboard not found" });
      await storage.deleteWhiteboard(existing.id);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "Failed to delete whiteboard");
    }
  });
}
