import type { Express } from "express";
import { isAuthorizedCronRequest } from "./_shared.js";
import { runRetention } from "../storage/retention.js";

export function registerRetentionRoutes(app: Express) {
  app.post("/api/cron/retention", async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized cron request" });
    }
    try {
      const result = await runRetention();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[retention] run failed:", err);
      res.status(500).json({ ok: false, message: "Retention run failed" });
    }
  });
}
