import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";

const brandGuidelinesSchema = z.object({
  content: z.string().max(2000, "Brand guidelines cannot exceed 2,000 characters"),
});

export function registerBrandGuidelinesRoutes(app: Express) {
  // GET /api/brand-guidelines — public (no auth required; AI endpoint reads this server-side)
  app.get("/api/brand-guidelines", async (_req, res) => {
    const row = await storage.getBrandGuidelines();
    res.json({ content: row?.content ?? '' });
  });

  // PUT /api/brand-guidelines — admin-auth required
  app.put("/api/brand-guidelines", requireAdmin, async (req, res) => {
    const parsed = brandGuidelinesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.upsertBrandGuidelines(parsed.data.content);
    res.json(updated);
  });
}
