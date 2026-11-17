import { routeParam } from "../lib/routeParam.js";
import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { createLiveSchema, liveCommandSchema } from "#shared/liveSharing.js";
import { LiveSharingService, LiveSharingError } from "../liveSharing/service.js";
import { LiveStreams } from "../liveSharing/stream.js";
import { rateLimit, rateLimitMiddleware, normalizeIpKey } from "../lib/rateLimit.js";

const idSchema = z.string().uuid();
const controllerSchema = z.object({ controllerToken: z.string().min(32).max(128) }).strict();
const joinSchema = z.object({ token: z.string().min(32).max(128), code: z.string().max(200).optional() }).strict();
const userId = (req: Request): string => String((req.session as any)?.userId ?? "");
const cookieName = "live_viewer";
function cookieCredential(req: Request) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return value.join("=");
  }
  return "";
}
function privateHeaders(res: Response) {
  res.set({ "Cache-Control": "no-store, no-transform", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" });
}
export function registerLiveSharingRoutes(app: Express, options: {
  service: LiveSharingService;
  requireAdmin: RequestHandler;
  enabled: () => boolean;
}) {
  const { service, requireAdmin, enabled } = options;
  const streams = new LiveStreams(service);
  const wrap = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof LiveSharingError) res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}), ...(error.state ? { state: error.state } : {}) });
      else if (error instanceof z.ZodError) res.status(400).json({ message: "Invalid live session request." });
      else next(error);
    }
  };
  app.use("/live", (_req, res, next) => { privateHeaders(res); next(); });
  app.use("/api/live-sessions", (req, res, next) => {
    privateHeaders(res);
    if (req.path === "/config") return next();
    if (!enabled()) return res.status(404).json({ message: "Live sharing is not enabled." });
    next();
  });
  app.get("/api/live-sessions/config", (_req, res) => { res.json({ enabled: enabled() }); });
  app.param("liveId", (req, res, next, value) => {
    if (!idSchema.safeParse(value).success) return res.status(400).json({ message: "Invalid live session id." });
    next();
  });
  app.post("/api/live-sessions", requireAdmin, rateLimitMiddleware({ limit: 20, windowMs: 60 * 60_000, keyFn: userId }), wrap(async (req, res) => {
    const body = createLiveSchema.parse(req.body);
    res.status(201).json(await service.create(userId(req), body.kind, body.sourceId, body.language));
  }));
  const base = "/api/live-sessions/:liveId";
  app.get(`${base}/presenter`, requireAdmin, wrap(async (req, res) => { res.json(await service.presenter(routeParam(req, "liveId"), userId(req))); }));
  app.post(`${base}/takeover`, requireAdmin, rateLimitMiddleware({ limit: 20, windowMs: 60_000, keyFn: userId }), wrap(async (req, res) => {
    res.json(await service.takeover(routeParam(req, "liveId"), userId(req)));
  }));
  app.post(`${base}/command`, requireAdmin, rateLimitMiddleware({ limit: 240, windowMs: 60_000, keyFn: userId }), wrap(async (req, res) => {
    res.json(await service.command(routeParam(req, "liveId"), userId(req), liveCommandSchema.parse(req.body)));
  }));
  app.post(`${base}/heartbeat`, requireAdmin, rateLimitMiddleware({ limit: 30, windowMs: 60_000, keyFn: userId }), wrap(async (req, res) => {
    const { controllerToken } = controllerSchema.parse(req.body);
    res.json({ ...await service.heartbeat(routeParam(req, "liveId"), userId(req), controllerToken), audienceCount: streams.audienceCount(routeParam(req, "liveId")) });
  }));
  for (const action of ["share", "revoke"] as const) {
    app.post(`${base}/${action}`, requireAdmin, rateLimitMiddleware({ limit: 20, windowMs: 60_000, keyFn: userId }), wrap(async (req, res) => {
      const { controllerToken } = controllerSchema.parse(req.body);
      res.json(await service[action](routeParam(req, "liveId"), userId(req), controllerToken));
    }));
  }
  app.post(`${base}/join`, rateLimitMiddleware({ limit: 200, windowMs: 5 * 60_000 }), wrap(async (req, res) => {
    const body = joinSchema.parse(req.body);
    if (body.code !== undefined && rateLimit(`live-code:${normalizeIpKey(req.ip)}:${routeParam(req, "liveId")}`, { limit: 10, windowMs: 5 * 60_000 })) {
      return res.status(429).json({ message: "Too many access-code attempts. Please try again later." });
    }
    const { view, credential } = await service.join(routeParam(req, "liveId"), body.token, body.code);
    res.cookie(cookieName, credential, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
      path: `/api/live-sessions/${routeParam(req, "liveId")}`, maxAge: Math.max(0, Date.parse(view.state.expiresAt) - Date.now()),
    });
    res.json(view);
  }));
  app.get(`${base}/view`, rateLimitMiddleware({ limit: 120, windowMs: 60_000 }), wrap(async (req, res) => {
    res.json(await service.audience(routeParam(req, "liveId"), cookieCredential(req)));
  }));
  // Mark presenter streams explicitly: anonymous guests cannot select this role.
  app.get(`${base}/events`, rateLimitMiddleware({ limit: 120, windowMs: 60_000 }), (req, res, next) => {
    if (req.query.role === "presenter") return requireAdmin(req, res, next);
    next();
  }, wrap(async (req, res) => {
    const id = routeParam(req, "liveId"), presenter = req.query.role === "presenter", credential = cookieCredential(req);
    if (presenter) await service.presenter(id, userId(req));
    else await service.audience(id, credential);
    if (res.destroyed || res.writableEnded) return;
    // Check after authorization awaits and immediately attach: no race for slots.
    if (!streams.canConnect(id, presenter)) return res.status(429).json({ message: "This live session has reached its connection limit." });
    res.set({ "Content-Type": "text/event-stream", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders(); res.write("retry: 2000\n\n");
    streams.attach(id, res, credential, presenter);
  }));
  return streams;
}
