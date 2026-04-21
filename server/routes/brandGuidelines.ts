import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";

export function registerBrandGuidelinesRoutes(app: Express) {
  // GET /api/brand-guidelines — public (no auth required; AI endpoint reads this server-side)
  app.get("/api/brand-guidelines", async (_req, res) => {
    const row = await storage.getBrandGuidelines();
    res.json({ content: row?.content ?? "" });
  });

  // PUT /api/brand-guidelines — admin-auth required
  app.put("/api/brand-guidelines", requireAdmin, async (req, res) => {
    const { content } = req.body as { content?: unknown };
    if (typeof content !== "string") {
      return res.status(400).json({ message: "content must be a string" });
    }
    const updated = await storage.upsertBrandGuidelines(content);
    res.json(updated);
  });
}
