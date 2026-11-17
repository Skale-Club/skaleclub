import { routeParam } from "../lib/routeParam.js";
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertRedirectSchema } from "#shared/schema.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { requireAdmin, sendError } from "./_shared.js";

export function registerRedirectRoutes(app: Express) {
  // Admin CRUD
  app.get("/api/redirects", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getRedirects());
    } catch (err) {
      console.error("[redirects] GET /api/redirects failed:", err);
      res.status(500).json({ message: "Failed to load redirects" });
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
      sendError(res, err, "Failed to create redirect");
    }
  });

  app.put("/api/redirects/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertRedirectSchema.partial().parse(req.body);
      if (data.slug && isReservedSlug(data.slug)) {
        return res.status(400).json({ message: `"${data.slug}" is a reserved path` });
      }
      res.json(await storage.updateRedirect(Number(routeParam(req, "id")), data));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      sendError(res, err, "Failed to update redirect");
    }
  });

  app.delete("/api/redirects/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteRedirect(Number(routeParam(req, "id")));
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "Failed to delete redirect");
    }
  });
}

// Public resolver — registered LAST so it never shadows real routes.
// Only intercepts single-segment paths with no dots and not reserved.
export function registerPublicRedirectResolver(app: Express) {
  app.get("/:slug", async (req, res, next) => {
    const slug = routeParam(req, "slug");
    if (!/^[a-z0-9-]+$/.test(slug) || isReservedSlug(slug)) return next();
    try {
      const record = await storage.getRedirectBySlug(slug);
      if (!record || !record.isActive) return next();
      res.redirect(302, record.destinationUrl);
    } catch {
      next();
    }
  });
}
