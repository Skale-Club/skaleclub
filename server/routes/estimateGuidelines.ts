import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";

const estimateGuidelinesSchema = z.object({
  content: z.string().max(50000, "Estimate guidelines cannot exceed 50,000 characters"),
});

export function registerEstimateGuidelinesRoutes(app: Express) {
  // GET /api/estimate-guidelines — public (no auth; MCP tool reads this server-side)
  app.get("/api/estimate-guidelines", async (_req, res) => {
    const row = await storage.getEstimateGuidelines();
    res.json({ content: row?.content ?? '' });
  });

  // PUT /api/estimate-guidelines — admin-only
  app.put("/api/estimate-guidelines", requireAdmin, async (req, res) => {
    const parsed = estimateGuidelinesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.upsertEstimateGuidelines(parsed.data.content);
    res.json(updated);
  });
}
