import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage.js";
import { insertPresentationSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";
import { z } from "zod";

const thumbnailSchema = z.object({
  thumbnailUrl: z.string().startsWith("data:image/webp;base64,").max(1_000_000),
  thumbnailSignature: z.string().min(1).max(200),
});

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "presentation";
}

async function buildUniquePresentationSlug(title: string): Promise<string> {
  const base = slugifyTitle(title);
  if (!await storage.getPresentationBySlug(base)) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!await storage.getPresentationBySlug(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function normalizeCustomSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "presentation";
}

export function registerPresentationsRoutes(app: Express) {
  // Literal-segment route registered FIRST — prevents Express matching "slug" as a :id UUID
  // (RESEARCH.md Pitfall 3 guard)
  app.get("/api/presentations/slug/:slug", async (req, res) => {
    try {
      const presentation = await storage.getPresentationBySlug(req.params.slug);
      if (!presentation) return res.status(404).json({ message: "Presentation not found" });
      const { thumbnailUrl, thumbnailSignature, ...publicPresentation } = presentation as any;
      res.json(publicPresentation);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // PRES-17: Record view — called from client when viewing presentation
  // SHA-256 hash IP per ip_hash column intent (STATE.md Phase 15 decision)
  app.post("/api/presentations/:id/view", async (req, res) => {
    try {
      const rawIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "").toString();
      const ipHash = rawIp
        ? crypto.createHash("sha256").update(rawIp).digest("hex")
        : undefined;
      await storage.recordPresentationView(req.params.id, ipHash);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // PRES-05: Admin list — returns PresentationWithStats[] sorted by createdAt desc
  // listPresentations() already performs the LEFT JOIN + JSONB count query
  app.get("/api/presentations", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const search = req.query.search as string | undefined;
      const result = await storage.listPresentations(limit, offset, search);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // PRES-06: Create accepts { title, slug? }; slug is generated from title unless provided.
  // insertPresentationSchema has slides default([]) so omitting slides is valid
  app.post("/api/presentations", requireAdmin, async (req, res) => {
    try {
      const parsed = insertPresentationSchema.pick({ title: true, slug: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = parsed.data.slug
        ? normalizeCustomSlug(parsed.data.slug)
        : await buildUniquePresentationSlug(parsed.data.title);
      if (parsed.data.slug && await storage.getPresentationBySlug(slug)) {
        return res.status(409).json({ message: "Slug already in use" });
      }
      const presentation = await storage.createPresentation({ title: parsed.data.title, slides: [], slug });
      res.status(201).json({ id: presentation.id, slug: presentation.slug, slides: presentation.slides });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // PRES-07: Update — accepts title/slides; version NOT in insertPresentationSchema
  // so it must be injected manually as existing.version + 1 (RESEARCH.md Pitfall 2 guard)
  // IDs are UUID strings — do NOT call Number(req.params.id)
  app.put("/api/presentations/:id", requireAdmin, async (req, res) => {
    try {
      const updateSchema = insertPresentationSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getPresentation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Presentation not found" });
      const updateData = { ...parsed.data };
      if (typeof updateData.slug === "string") {
        const slug = normalizeCustomSlug(updateData.slug);
        const slugOwner = await storage.getPresentationBySlug(slug);
        if (slugOwner && slugOwner.id !== existing.id) {
          return res.status(409).json({ message: "Slug already in use" });
        }
        updateData.slug = slug;
      }
      const updated = await storage.updatePresentation(req.params.id, {
        ...updateData,
        version: existing.version + 1,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/presentations/:id/thumbnail", requireAdmin, async (req, res) => {
    try {
      const parsed = thumbnailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getPresentation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Presentation not found" });
      const updated = await storage.updatePresentation(req.params.id, parsed.data);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // PRES-08: Delete — 404-guard before delete; cascade of presentation_views is DB-handled
  app.delete("/api/presentations/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getPresentation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Presentation not found" });
      await storage.deletePresentation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}
