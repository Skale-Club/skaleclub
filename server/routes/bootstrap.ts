import type { Express } from "express";
import { requireAdmin, sendError } from "./_shared.js";
import { listBootstrapTasks, runBootstrapTasks } from "../lib/bootstrapTasks.js";

/** Admin view of the self-applying maintenance tasks, and a button to run them now. */
export function registerBootstrapRoutes(app: Express) {
  app.get("/api/admin/bootstrap", requireAdmin, async (_req, res) => {
    try {
      res.json(await listBootstrapTasks());
    } catch (err) {
      sendError(res, err, "Failed to load bootstrap tasks");
    }
  });

  app.post("/api/admin/bootstrap/run", requireAdmin, async (req, res) => {
    try {
      const force = req.body?.force === true || req.query.force === "true";
      res.json(await runBootstrapTasks({ force }));
    } catch (err) {
      sendError(res, err, "Failed to run bootstrap tasks");
    }
  });
}
