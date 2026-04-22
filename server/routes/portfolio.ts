import type { Express } from "express";
import { z } from "zod";
import { DEFAULT_PORTFOLIO_SERVICES } from "#shared/defaults/cms.js";
import { storage } from "../storage.js";
import { insertPortfolioServiceSchema } from "#shared/schema.js";
import { requireAdmin, setPublicCache } from "./_shared.js";

export function registerPortfolioRoutes(app: Express) {
  app.get("/api/portfolio-services", async (req, res) => {
    try {
      const services = await storage.getPortfolioServices();
      setPublicCache(res, 300);
      res.json(services);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/portfolio-services/:idOrSlug", async (req, res) => {
    try {
      const { idOrSlug } = req.params;
      let service;
      if (/^\d+$/.test(idOrSlug)) {
        service = await storage.getPortfolioService(Number(idOrSlug));
      } else {
        service = await storage.getPortfolioServiceBySlug(idOrSlug);
      }
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      setPublicCache(res, 300);
      res.json(service);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/portfolio-services", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPortfolioServiceSchema.parse(req.body);
      const service = await storage.createPortfolioService(validatedData);
      res.status(201).json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Reorder must come before /:id so Express doesn't match "reorder" as an id
  app.put("/api/portfolio-services/reorder", requireAdmin, async (req, res) => {
    try {
      const { orders } = req.body as { orders: { id: number; order: number }[] };
      if (!Array.isArray(orders)) {
        return res.status(400).json({ message: "Orders must be an array" });
      }

      for (const item of orders) {
        await storage.updatePortfolioService(item.id, { order: item.order });
      }

      res.json({ success: true, count: orders.length });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/portfolio-services/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPortfolioServiceSchema.partial().parse(req.body);
      const service = await storage.updatePortfolioService(Number(req.params.id), validatedData);
      res.json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/portfolio-services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePortfolioService(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/portfolio-services/seed", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getPortfolioServices();
      if (existing.length > 0) {
        return res.json({ message: "Services already exist", count: existing.length });
      }

      const created = [];
      for (const service of DEFAULT_PORTFOLIO_SERVICES) {
        const result = await storage.createPortfolioService(service);
        created.push(result);
      }

      res.json({ message: "Services seeded successfully", count: created.length, services: created });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });
}
