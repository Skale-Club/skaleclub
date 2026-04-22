import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage.js";
import { insertEstimateSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "estimate";
}

async function buildUniqueEstimateSlug(data: {
  companyName?: string | null;
  contactName?: string | null;
  clientName: string;
}): Promise<string> {
  const source = data.companyName?.trim() || data.contactName?.trim() || data.clientName.trim();
  const base = slugifyName(source);

  if (!await storage.getEstimateBySlug(base)) return base;

  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!await storage.getEstimateBySlug(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export function registerEstimatesRoutes(app: Express) {
  // Public slug endpoint registered first to avoid Express matching "slug" as an :id value
  app.get("/api/estimates/slug/:slug", async (req, res) => {
    try {
      const estimate = await storage.getEstimateBySlug(req.params.slug);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });
      // Never expose access_code to the public client (D-07, RESEARCH pitfall 1)
      const { accessCode, ...publicEstimate } = estimate as any;
      res.json({ ...publicEstimate, hasAccessCode: Boolean(accessCode) });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates/:id/view", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ipAddress = (
        (req.headers['x-forwarded-for'] as string) || req.ip || ''
      ).toString() || undefined;
      await storage.recordEstimateView(id, ipAddress);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates/:id/verify-code", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { code } = req.body as { code: string };
      const estimate = await storage.getEstimate(id);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });
      // No gate set — treat as unlocked
      if (!estimate.accessCode) return res.json({ success: true });
      // Plain text comparison — D-07 (NOT bcrypt — codes must be readable for GHL automation)
      if (estimate.accessCode !== code) return res.status(401).json({ message: "Incorrect code" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/estimates", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const result = await storage.listEstimates(limit, offset);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates", requireAdmin, async (req, res) => {
    try {
      const bodySchema = insertEstimateSchema.omit({ slug: true });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = await buildUniqueEstimateSlug(parsed.data);
      const estimate = await storage.createEstimate({ ...parsed.data, slug });
      res.status(201).json(estimate);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/estimates/:id", requireAdmin, async (req, res) => {
    try {
      const updateSchema = insertEstimateSchema.partial().omit({ slug: true });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getEstimate(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Estimate not found" });
      const estimate = await storage.updateEstimate(Number(req.params.id), parsed.data);
      res.json(estimate);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/estimates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEstimate(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}
