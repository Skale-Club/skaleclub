import { routeParam } from "../lib/routeParam.js";
import type { Express, RequestHandler } from "express";
import { downloadableAppSchema, publicDownloadableApp, appReleaseSchema } from "#shared/schema/downloads.js";
import { downloadableAppStore } from "../lib/downloadableApps.js";
import { requireAdmin, sendError } from "./_shared.js";
import { resolveAppReleases } from "../lib/appReleases.js";

export function registerDownloadRoutes(app: Express, store = downloadableAppStore, admin: RequestHandler = requireAdmin, resolve = resolveAppReleases) {
  // Do not cache: withdrawing a release must also withdraw its stable URL.
  app.use(["/api/downloadable-apps", "/api/downloads", "/api/admin/downloadable-apps"], (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/downloadable-apps", async (_req, res) => {
    try { res.json(await Promise.all((await store.list()).filter((row) => row.isPublished).map(async (row) => publicDownloadableApp(await resolve(row))))); }
    catch (err) { sendError(res, err, "Failed to load applications"); }
  });
  app.get("/api/downloadable-apps/:slug", async (req, res) => {
    try {
      const row = await store.get(routeParam(req, "slug"));
      if (!row?.isPublished) return res.status(404).json({ message: "Application not found" });
      res.json(publicDownloadableApp(await resolve(row)));
    } catch (err) { sendError(res, err, "Failed to load application"); }
  });
  app.get("/api/downloads/:slug/:releaseId", async (req, res) => {
    try {
      const saved = await store.get(routeParam(req, "slug"));
      const row = saved?.isPublished ? await resolve(saved) : saved;
      const release = row?.isPublished ? row.releases.find((item) => item.id === routeParam(req, "releaseId") && item.isPublished) : undefined;
      if (!release) return res.status(404).json({ message: "Download not found" });
      // Validate on read as well, including records edited outside this API.
      const parsed = appReleaseSchema.safeParse(release);
      if (!parsed.success) return res.status(404).json({ message: "Download not found" });
      res.redirect(302, parsed.data.downloadUrl);
    } catch (err) { sendError(res, err, "Failed to load download"); }
  });
  app.get("/api/admin/downloadable-apps", admin, async (_req, res) => {
    try { res.json(await store.list(true)); }
    catch (err) { sendError(res, err, "Failed to load applications"); }
  });
  const save = (create: boolean): RequestHandler => async (req, res) => {
    const parsed = downloadableAppSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    if (!create && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(routeParam(req, "id"))) return res.status(400).json({ message: "Invalid application id" });
    try {
      const row = create ? await store.create(parsed.data) : await store.update(routeParam(req, "id"), parsed.data);
      if (!row) return res.status(404).json({ message: "Application not found" });
      res.status(create ? 201 : 200).json(row);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return res.status(409).json({ message: "An application already uses this slug" });
      sendError(res, err, "Failed to save application");
    }
  };
  app.post("/api/admin/downloadable-apps", admin, save(true));
  app.put("/api/admin/downloadable-apps/:id", admin, save(false));
}
