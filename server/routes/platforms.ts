import type { Express } from "express";
import { storage } from "../storage.js";
import { fromPortfolioService } from "#shared/catalog.js";
import { platformDbSlug, platformSlug } from "#shared/platforms.js";
import { sendError } from "./_shared.js";

export function registerPlatformRoutes(app: Express, store: Pick<typeof storage, "getPortfolioServiceBySlug"> = storage) {
  app.get("/api/platforms/:slug", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const slug = platformDbSlug(req.params.slug);
    if (!slug) return res.status(404).json({ message: "Platform not found" });
    try {
      const row = await store.getPortfolioServiceBySlug(slug);
      if (!row?.isActive) return res.status(404).json({ message: "Platform not found" });
      res.json({ ...fromPortfolioService(row), slug: platformSlug(row.slug) });
    } catch (err) { sendError(res, err, "Failed to load platform"); }
  });
}
