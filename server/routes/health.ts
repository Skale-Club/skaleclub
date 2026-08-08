import type { Express } from "express";

/**
 * Dependency-free liveness probe.
 *
 * Registered first so it answers even when the DB / Supabase / provider
 * integrations are down — Docker's HEALTHCHECK and Coolify's container health
 * must reflect "the process is up and serving", not "every dependency is well".
 * A DB-backed check here would flap the container on a transient Supabase blip.
 */
export function registerHealthRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
}
