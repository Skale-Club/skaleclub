import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertFaqSchema } from "#shared/schema.js";
import { requireAdmin, setPublicCache } from "./_shared.js";

export function registerFaqRoutes(app: Express) {
  app.get("/api/faqs", async (_req, res) => {
    try {
      const faqList = await storage.getFaqs();
      setPublicCache(res, 300);
      res.json(faqList);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/faqs", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFaqSchema.parse(req.body);
      const faq = await storage.createFaq(validatedData);
      res.status(201).json(faq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/faqs/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFaqSchema.partial().parse(req.body);
      const faq = await storage.updateFaq(Number(req.params.id), validatedData);
      res.json(faq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/faqs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFaq(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}
