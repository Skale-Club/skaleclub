import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  DEVICE_EVENT_TYPES,
  PROVISIONER_PROTOCOL_HEADER,
  PROVISIONER_PROTOCOL_VERSION,
  PROVISIONING_ERROR_CODES,
} from "#shared/nfcProvisioning.js";
import type { SmartTagProvisioningDevice } from "#shared/schema.js";
import { normalizeIpKey, rateLimitMiddleware } from "../lib/rateLimit.js";
import { getClientIp } from "../lib/turnstile.js";
import * as provisioning from "../lib/smartTags/provisioning.js";
import { SmartTagError } from "../lib/smartTags/repository.js";
import { requireAdmin, sendError } from "./_shared.js";
import { smartTagBaseUrl } from "./smartTags.js";

// Two audiences:
//   /api/provisioner/*  — the paired desktop app, Bearer device token only.
//                         A device token reaches nothing else in the API.
//   /api/admin/...      — admins (session), who pair/revoke devices and send jobs.

declare module "express-serve-static-core" {
  interface Request {
    provisionerDevice?: SmartTagProvisioningDevice;
  }
}

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof SmartTagError) return res.status(err.status).json({ message: err.message });
  if (err instanceof z.ZodError) {
    return res.status(400).json({ message: err.issues[0]?.message ?? "Validation error", errors: err.errors });
  }
  return sendError(res, err, fallback);
}

function uuidOr404(value: string, res: Response): string | null {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    res.status(404).json({ message: "Not found" });
    return null;
  }
  return parsed.data;
}

/** Old or newer apps get a clear upgrade message instead of undefined behaviour. */
function requireProtocol(req: Request, res: Response, next: NextFunction) {
  const sent = Number(req.get(PROVISIONER_PROTOCOL_HEADER));
  if (sent !== PROVISIONER_PROTOCOL_VERSION) {
    return res.status(426).json({
      message: "This Skale NFC Provisioner version is not compatible with the website. Install the current version.",
      protocolVersion: PROVISIONER_PROTOCOL_VERSION,
    });
  }
  next();
}

async function requireProvisioner(req: Request, res: Response, next: NextFunction) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ message: "Device token required" });
  try {
    const device = await provisioning.authenticateDevice(token);
    if (!device) return res.status(401).json({ message: "Device is not paired or was revoked" });
    req.provisionerDevice = device;
    await provisioning.touchDevice(device, req.get("x-provisioner-app-version")?.slice(0, 40) ?? null);
    next();
  } catch (err) {
    fail(res, err, "Failed to authenticate device");
  }
}

const pairSchema = z.object({
  pairingCode: z.string().min(1).max(20),
  platform: optionalText(40),
  appVersion: optionalText(40),
}).strict();

const eventSchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  type: z.enum(DEVICE_EVENT_TYPES),
  detail: z.record(z.unknown()).optional(),
}).strict();

const completeSchema = z.object({
  outcome: z.enum(["succeeded", "failed"]),
  readbackUrl: z.string().max(2048).nullable().optional(),
  tagType: optionalText(40),
  errorCode: z.enum(PROVISIONING_ERROR_CODES).nullable().optional(),
  errorMessage: optionalText(500),
}).strict();

export function registerSmartTagProvisioningRoutes(app: Express) {
  // ─── Desktop app ────────────────────────────────────────────────────────────

  // Pairing codes are short-lived, but still cap guesses per IP.
  const pairLimit = rateLimitMiddleware({
    limit: 10,
    windowMs: 10 * 60_000,
    keyFn: (req) => normalizeIpKey(getClientIp(req)),
    message: "Too many pairing attempts. Try again later.",
  });

  app.post("/api/provisioner/pair", requireProtocol, pairLimit, async (req, res) => {
    try {
      const body = pairSchema.parse(req.body);
      const result = await provisioning.redeemPairing(body);
      res.status(201).json({ ...result, protocolVersion: PROVISIONER_PROTOCOL_VERSION });
    } catch (err) {
      fail(res, err, "Pairing failed");
    }
  });

  const device = [requireProtocol, requireProvisioner] as const;

  app.get("/api/provisioner/session", ...device, (req, res) => {
    const d = req.provisionerDevice!;
    res.json({
      device: { id: d.id, deviceName: d.deviceName },
      protocolVersion: PROVISIONER_PROTOCOL_VERSION,
      baseUrl: smartTagBaseUrl(),
    });
  });

  // Next job for this device, or 204 when there is nothing to do.
  app.post("/api/provisioner/jobs/claim", ...device, async (req, res) => {
    try {
      const job = await provisioning.claimNextJob(req.provisionerDevice!.id);
      if (!job) return res.status(204).end();
      res.json(job);
    } catch (err) {
      fail(res, err, "Failed to claim job");
    }
  });

  app.post("/api/provisioner/events", ...device, async (req, res) => {
    try {
      const body = eventSchema.parse(req.body);
      const status = await provisioning.recordDeviceEvent(req.provisionerDevice!.id, body);
      res.json({ ok: true, jobStatus: status });
    } catch (err) {
      fail(res, err, "Failed to record event");
    }
  });

  app.post("/api/provisioner/jobs/:id/complete", ...device, async (req, res) => {
    const id = uuidOr404(req.params.id, res);
    if (!id) return;
    try {
      const body = completeSchema.parse(req.body);
      const job = await provisioning.completeJob(req.provisionerDevice!.id, id, body);
      res.json({
        id: job.id,
        status: job.status,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      });
    } catch (err) {
      fail(res, err, "Failed to complete job");
    }
  });

  // ─── Admin ──────────────────────────────────────────────────────────────────

  app.get("/api/admin/smart-tag-provisioners", requireAdmin, async (_req, res) => {
    try {
      res.json(await provisioning.listDevices());
    } catch (err) {
      fail(res, err, "Failed to load provisioners");
    }
  });

  app.post("/api/admin/smart-tag-provisioners", requireAdmin, async (req, res) => {
    try {
      const { deviceName } = z.object({ deviceName: z.string().trim().min(1, "Name the computer").max(80) }).strict().parse(req.body);
      const userId = (req.session as { userId?: string } | undefined)?.userId ?? null;
      res.status(201).json(await provisioning.createPairing(deviceName, userId));
    } catch (err) {
      fail(res, err, "Failed to create pairing code");
    }
  });

  app.post("/api/admin/smart-tag-provisioners/:id/revoke", requireAdmin, async (req, res) => {
    const id = uuidOr404(req.params.id, res);
    if (!id) return;
    try {
      const userId = (req.session as { userId?: string } | undefined)?.userId ?? null;
      res.json(await provisioning.revokeDevice(id, userId));
    } catch (err) {
      fail(res, err, "Failed to revoke provisioner");
    }
  });

  app.get("/api/admin/smart-tags/:id/provisioning", requireAdmin, async (req, res) => {
    const id = uuidOr404(req.params.id, res);
    if (!id) return;
    try {
      const state = await provisioning.getTagProvisioning(id);
      if (!state) return res.status(404).json({ message: "Tag not found" });
      res.json(state);
    } catch (err) {
      fail(res, err, "Failed to load provisioning");
    }
  });

  app.post("/api/admin/smart-tags/:id/provisioning-jobs", requireAdmin, async (req, res) => {
    const id = uuidOr404(req.params.id, res);
    if (!id) return;
    try {
      const { deviceId } = z.object({ deviceId: z.string().uuid().nullable().optional() }).strict().parse(req.body ?? {});
      const userId = (req.session as { userId?: string } | undefined)?.userId ?? null;
      await provisioning.createJob(id, userId, smartTagBaseUrl(), deviceId);
      res.status(201).json(await provisioning.getTagProvisioning(id));
    } catch (err) {
      fail(res, err, "Failed to create provisioning job");
    }
  });

  app.post("/api/admin/smart-tag-provisioning-jobs/:id/cancel", requireAdmin, async (req, res) => {
    const id = uuidOr404(req.params.id, res);
    if (!id) return;
    try {
      const userId = (req.session as { userId?: string } | undefined)?.userId ?? null;
      res.json(await provisioning.cancelJob(id, userId));
    } catch (err) {
      fail(res, err, "Failed to cancel job");
    }
  });
}
