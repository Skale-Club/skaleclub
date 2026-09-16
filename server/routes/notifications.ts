import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertNotificationTemplateSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications/templates", requireAdmin, async (_req, res) => {
    try {
      return res.json(await storage.getNotificationTemplates());
    } catch (err) {
      console.error("[notifications] GET /api/notifications/templates failed:", err);
      return res.status(500).json({ message: "Failed to load templates" });
    }
  });

  app.put("/api/notifications/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid template id" });
      }
      const updateSchema = insertNotificationTemplateSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const updated = await storage.upsertNotificationTemplate({ ...parsed.data, id } as Parameters<typeof storage.upsertNotificationTemplate>[0]);
      return res.json(updated);
    } catch (err) {
      console.error("[notifications] PUT /api/notifications/templates/:id failed:", err);
      return res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.post("/api/notifications/templates", requireAdmin, async (req, res) => {
    try {
      const parsed = insertNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const created = await storage.upsertNotificationTemplate(parsed.data);
      return res.status(201).json(created);
    } catch (err) {
      console.error("[notifications] POST /api/notifications/templates failed:", err);
      return res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.delete("/api/notifications/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid template id" });
      }
      await storage.deleteNotificationTemplate(id);
      return res.status(204).end();
    } catch (err) {
      console.error("[notifications] DELETE /api/notifications/templates/:id failed:", err);
      return res.status(500).json({ message: "Failed to delete template" });
    }
  });
}
