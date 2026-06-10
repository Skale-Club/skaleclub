import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertRedirectSchema } from "#shared/schema.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { requireAdmin } from "./_shared.js";

export function registerRedirectRoutes(app: Express) {
  // Admin CRUD
  app.get("/api/redirects", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getRedirects());
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/redirects", requireAdmin, async (req, res) => {
    try {
      const data = insertRedirectSchema.parse(req.body);
      if (isReservedSlug(data.slug)) {
        return res.status(400).json({ message: `"${data.slug}" is a reserved path` });
      }
      res.status(201).json(await storage.createRedirect(data));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/redirects/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertRedirectSchema.partial().parse(req.body);
      if (data.slug && isReservedSlug(data.slug)) {
        return res.status(400).json({ message: `"${data.slug}" is a reserved path` });
      }
      res.json(await storage.updateRedirect(Number(req.params.id), data));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/redirects/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteRedirect(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}

// Public resolver — registered LAST so it never shadows real routes.
// Only intercepts single-segment paths with no dots and not reserved.
export function registerPublicRedirectResolver(app: Express) {
  app.get("/:slug([a-z0-9-]+)", async (req, res, next) => {
    const { slug } = req.params;
    if (isReservedSlug(slug)) return next();
    try {
      const record = await storage.getRedirectBySlug(slug);
      if (!record || !record.isActive) return next();
      res.redirect(302, record.destinationUrl);
    } catch {
      next();
    }
  });
}
