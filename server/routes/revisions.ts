import type { Express } from "express";
import { contentRevisionEntities } from "#shared/schema.js";
import { listRevisions, restoreRevision, RevisionError } from "../storage/revisions.js";
import { requireAdmin } from "./_shared.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerRevisionRoutes(app: Express) {
  app.get("/api/admin/revisions/:entity/:id", requireAdmin, async (req, res) => {
    try {
      const entity = String(req.params.entity);
      if (!(contentRevisionEntities as readonly string[]).includes(entity)) {
        return res.status(400).json({ message: "Unknown entity" });
      }
      const limit = Number(req.query.limit ?? 20);
      const rows = await listRevisions(entity, String(req.params.id), Number.isFinite(limit) ? limit : 20);
      res.json(rows);
    } catch (err) {
      console.error("[revisions] list failed:", err);
      res.status(500).json({ message: "Failed to load revisions" });
    }
  });

  app.post("/api/admin/revisions/:revisionId/restore", requireAdmin, async (req, res) => {
    const revisionId = String(req.params.revisionId);
    if (!UUID_RE.test(revisionId)) return res.status(400).json({ message: "Invalid revision id" });
    try {
      const result = await restoreRevision(revisionId);
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof RevisionError) return res.status(err.status).json({ message: err.message });
      console.error("[revisions] restore failed:", err);
      res.status(500).json({ message: "Failed to restore revision" });
    }
  });
}
