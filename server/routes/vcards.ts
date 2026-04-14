import type { Express } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db.js";
import { vcards, insertVCardSchema } from "#shared/schema.js";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";

export function registerVCardRoutes(app: Express) {
  app.get("/api/vcards", requireAdmin, async (_req, res) => {
    try {
      const allVCards = await db.select().from(vcards).orderBy(vcards.createdAt);
      res.json(allVCards);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch VCards" });
    }
  });

  app.get("/api/vcards/:username", async (req, res) => {
    try {
      const [vcard] = await db.select().from(vcards).where(eq(vcards.username, req.params.username));
      if (!vcard) return res.status(404).json({ error: "VCard not found" });

      // Override organization with global company settings dynamically
      const settings = await storage.getCompanySettings();
      if (settings?.companyName) {
        vcard.organization = settings.companyName;
      }

      res.json(vcard);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch VCard by username" });
    }
  });

  app.post("/api/vcards", requireAdmin, async (req, res) => {
    try {
      const data = insertVCardSchema.parse(req.body);
      const existing = await db.select().from(vcards).where(eq(vcards.username, data.username));
      if (existing.length > 0) return res.status(400).json({ error: "Username já existe." });

      const [newVcard] = await db.insert(vcards).values(data).returning();
      res.json(newVcard);
    } catch (err: any) {
      console.error(err);
      res.status(400).json({ error: "Failed to create VCard" });
    }
  });

  app.put("/api/vcards/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertVCardSchema.parse(req.body);
      const id = parseInt(req.params.id);

      const existing = await db.select().from(vcards).where(and(eq(vcards.username, data.username), ne(vcards.id, id)));
      if (existing.length > 0) return res.status(400).json({ error: "Username já existe." });

      const [updated] = await db.update(vcards).set({ ...data, updatedAt: new Date() }).where(eq(vcards.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      console.error(err);
      res.status(400).json({ error: "Failed to update VCard" });
    }
  });

  app.delete("/api/vcards/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(vcards).where(eq(vcards.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete VCard" });
    }
  });

  // Track VCard view — increments viewCount and updates lastViewedAt
  app.post("/api/vcards/:username/view", async (req, res) => {
    try {
      const [vcard] = await db.select().from(vcards).where(eq(vcards.username, req.params.username));
      if (!vcard) return res.status(404).json({ error: "VCard not found" });

      const [updated] = await db
        .update(vcards)
        .set({
          viewCount: sql`${vcards.viewCount} + 1`,
          lastViewedAt: new Date(),
        })
        .where(eq(vcards.id, vcard.id))
        .returning();

      res.json({ success: true, viewCount: updated.viewCount });
    } catch (err) {
      console.error("Error tracking VCard view:", err);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Track VCard download — increments downloadCount
  app.post("/api/vcards/:username/download", async (req, res) => {
    try {
      const [vcard] = await db.select().from(vcards).where(eq(vcards.username, req.params.username));
      if (!vcard) return res.status(404).json({ error: "VCard not found" });

      const [updated] = await db
        .update(vcards)
        .set({
          downloadCount: sql`${vcards.downloadCount} + 1`,
        })
        .where(eq(vcards.id, vcard.id))
        .returning();

      res.json({ success: true, downloadCount: updated.downloadCount });
    } catch (err) {
      console.error("Error tracking VCard download:", err);
      res.status(500).json({ error: "Failed to track download" });
    }
  });
}
