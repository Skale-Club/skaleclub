import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { getJobsHealth } from "../lib/jobHeartbeat.js";

const READY_TIMEOUT_MS = 2_000;

/**
 * Health probes.
 *
 * `/api/health` is dependency-free liveness. Registered first so it answers
 * even when the DB / Supabase / provider integrations are down: Docker's
 * HEALTHCHECK and Coolify's container health must reflect "the process is up
 * and serving", not "every dependency is well". A DB-backed check there would
 * flap the container on a transient Supabase blip.
 *
 * `/api/ready` is readiness: it runs `select 1` (2 s cap) and answers 503 when
 * the database is unreachable. Point load balancers / uptime monitors at it,
 * never the container HEALTHCHECK.
 *
 * `/api/health/jobs` reports the age of each scheduled job's last heartbeat.
 * Public and free of secrets (job names, timestamps, outcome notes only).
 */
export function registerHealthRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        db.execute(sql`select 1`),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("db_timeout")), READY_TIMEOUT_MS);
        }),
      ]);
      res.json({ status: "ready" });
    } catch (err) {
      console.error("[ready] database check failed:", (err as Error).message);
      res.status(503).json({ status: "unavailable" });
    } finally {
      if (timer) clearTimeout(timer);
    }
  });

  // Commit currently running (Coolify injects SOURCE_COMMIT); lets the deploy
  // workflow confirm the new build is the one answering.
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ commit: process.env.SOURCE_COMMIT ?? null });
  });

  app.get("/api/health/jobs", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const jobs = await getJobsHealth();
      res.json({
        status: jobs.some((j) => j.stale) ? "stale" : "ok",
        jobs,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[health/jobs] failed:", (err as Error).message);
      res.status(503).json({ status: "unavailable" });
    }
  });
}
