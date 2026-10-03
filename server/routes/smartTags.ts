import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  SMART_TAG_BATCH_STATUSES,
  SMART_TAG_DEFAULT_PUBLIC_BASE_URL,
  SMART_TAG_DESTINATION_TYPES,
  SMART_TAG_MAX_BATCH_QUANTITY,
  SMART_TAG_PRODUCT_TYPES,
  SMART_TAG_STATUSES,
  buildManufacturingCsv,
  buildSmartTagUrls,
  normalizeTagCode,
  validateDestinationUrl,
} from "#shared/smartTags.js";
import { requireAdmin, sendError } from "./_shared.js";
import { createSmartTagHandler } from "../lib/smartTags/publicHandler.js";
import { buildBatchZip, qrPng, qrSvg } from "../lib/smartTags/qrAssets.js";
import * as repo from "../lib/smartTags/repository.js";
import { registerSmartTagJourneyRoutes } from "./smartTagJourney.js";

// Smart Tags: public QR/NFC redirects (/q/:code, /n/:code) and the admin API
// behind /api/admin/smart-tags*, /api/admin/smart-tag-customers*,
// /api/admin/smart-tag-batches*.

/** Where printed QR / programmed NFC URLs point. V1: always skale.club. */
export function smartTagBaseUrl(): string {
  return (process.env.SMART_TAG_PUBLIC_BASE_URL?.trim() || SMART_TAG_DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, "");
}

const allowHttp = () => process.env.NODE_ENV !== "production";

export function registerSmartTagPublicRoutes(app: Express) {
  const deps = {
    findByCode: repo.findPublicTagByCode,
    recordEvent: repo.recordSmartTagEvent,
    isAdminRequest: repo.isAdminRequest,
  };
  app.get("/q/:code", createSmartTagHandler("qr", deps));
  app.get("/n/:code", createSmartTagHandler("nfc", deps));
}

// ─── Validation ───────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v),
    z.string().max(max).nullable().optional(),
  );

const uuidParam = z.string().uuid();

const destinationUrlField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === "") return null;
    const result = validateDestinationUrl(value, { allowHttp: allowHttp() });
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error, path: ["destinationUrl"] });
      return z.NEVER;
    }
    return result.url;
  });

export const tagCreateSchema = z.object({
  productType: z.enum(SMART_TAG_PRODUCT_TYPES),
  label: optionalText(120),
});

export const tagPatchSchema = z.object({
  label: optionalText(120),
  productType: z.enum(SMART_TAG_PRODUCT_TYPES).optional(),
  destinationType: z.enum(SMART_TAG_DESTINATION_TYPES).nullable().optional(),
  destinationUrl: destinationUrlField,
  utmEnabled: z.boolean().optional(),
  utmCampaign: optionalText(80),
  metadata: z.record(z.unknown()).nullable().optional(),
  reason: optionalText(300),
}).strict();

export const customerSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  slug: optionalText(80),
  contactName: optionalText(200),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v),
    z.string().email("Invalid email").max(200).nullable().optional(),
  ),
  phone: optionalText(40),
  externalCrmId: optionalText(120),
  notes: optionalText(2000),
}).strict();

export const assignSchema = z.union([
  z.object({ customerId: z.string().uuid() }).strict(),
  z.object({ customer: customerSchema }).strict(),
]);

export const actionSchema = z.object({ reason: optionalText(300) }).strict();

export const batchCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  batchCode: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v),
    z.string().regex(/^[A-Z0-9._-]{1,40}$/, "Batch code: letters, numbers, dot, dash or underscore").optional(),
  ),
  productType: z.enum(SMART_TAG_PRODUCT_TYPES),
  vendor: optionalText(120),
  quantity: z.coerce.number().int().min(1).max(SMART_TAG_MAX_BATCH_QUANTITY),
  notes: optionalText(2000),
}).strict();

export const batchPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  vendor: optionalText(120),
  notes: optionalText(2000),
  status: z.enum(SMART_TAG_BATCH_STATUSES).optional(),
}).strict();

export const listQuerySchema = z.object({
  status: z.enum(SMART_TAG_STATUSES).optional(),
  productType: z.enum(SMART_TAG_PRODUCT_TYPES).optional(),
  customerId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  method: z.enum(["qr", "nfc"]).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

const MAX_RANGE_MS = 366 * 86_400_000;
const PRESET_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

const analyticsQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  customerId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  productType: z.enum(SMART_TAG_PRODUCT_TYPES).optional(),
});

export function analyticsWindow(query: { range?: string; from?: string; to?: string }, now = new Date()): { from: Date; to: Date } {
  if (query.from || query.to) {
    const to = query.to ? new Date(query.to) : now;
    let from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86_400_000);
    if (from > to) from = new Date(to.getTime() - 86_400_000);
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) from = new Date(to.getTime() - MAX_RANGE_MS);
    return { from, to };
  }
  if (query.range === "today") {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), to: now };
  }
  const days = PRESET_DAYS[query.range ?? "30d"] ?? 30;
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userIdOf(req: Request): string | null {
  return (req.session as { userId?: string } | undefined)?.userId ?? null;
}

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof repo.SmartTagError) return res.status(err.status).json({ message: err.message });
  if (err instanceof z.ZodError) {
    return res.status(400).json({ message: err.issues[0]?.message ?? "Validation error", errors: err.errors });
  }
  return sendError(res, err, fallback);
}

function idParam(req: Request, res: Response): string | null {
  const parsed = uuidParam.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(404).json({ message: "Not found" });
    return null;
  }
  return parsed.data;
}

function fileSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export function registerSmartTagAdminRoutes(app: Express) {
  const base = "/api/admin/smart-tags";
  registerSmartTagJourneyRoutes(app);

  app.get(`${base}/overview`, requireAdmin, async (_req, res) => {
    try {
      res.json(await repo.getOverview());
    } catch (err) {
      fail(res, err, "Failed to load overview");
    }
  });

  // Aggregated analytics, optionally scoped to a customer, batch or product type.
  app.get(`${base}/analytics`, requireAdmin, async (req, res) => {
    try {
      const q = analyticsQuerySchema.parse(req.query);
      const { from, to } = analyticsWindow(q);
      res.json(await repo.getAnalytics({ customerId: q.customerId, batchId: q.batchId, productType: q.productType }, from, to));
    } catch (err) {
      fail(res, err, "Failed to load analytics");
    }
  });

  // Mobile activation: type the code printed on the piece, get its record.
  app.get(`${base}/lookup/:code`, requireAdmin, async (req, res) => {
    try {
      const code = normalizeTagCode(req.params.code);
      const tag = code ? await repo.getTagByCode(code) : null;
      if (!tag) return res.status(404).json({ message: "No tag with that code" });
      res.json({ id: tag.id, publicCode: tag.publicCode });
    } catch (err) {
      fail(res, err, "Failed to look up tag");
    }
  });

  app.get(base, requireAdmin, async (req, res) => {
    try {
      res.json(await repo.listTags(listQuerySchema.parse(req.query)));
    } catch (err) {
      fail(res, err, "Failed to load tags");
    }
  });

  app.post(base, requireAdmin, async (req, res) => {
    try {
      const input = tagCreateSchema.parse(req.body);
      const tag = await repo.createSingleTag(input);
      res.status(201).json(await repo.getTagDetail(tag.id, smartTagBaseUrl()));
    } catch (err) {
      fail(res, err, "Failed to create tag");
    }
  });

  app.get(`${base}/:id`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const detail = await repo.getTagDetail(id, smartTagBaseUrl());
      if (!detail) return res.status(404).json({ message: "Tag not found" });
      res.json(detail);
    } catch (err) {
      fail(res, err, "Failed to load tag");
    }
  });

  app.patch(`${base}/:id`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const patch = tagPatchSchema.parse(req.body);
      await repo.updateTag(id, patch, userIdOf(req));
      res.json(await repo.getTagDetail(id, smartTagBaseUrl()));
    } catch (err) {
      fail(res, err, "Failed to update tag");
    }
  });

  app.post(`${base}/:id/assign`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const body = assignSchema.parse(req.body);
      const customerId = "customerId" in body ? body.customerId : (await repo.createCustomer(body.customer, userIdOf(req))).id;
      await repo.assignTag(id, customerId, userIdOf(req));
      res.json(await repo.getTagDetail(id, smartTagBaseUrl()));
    } catch (err) {
      fail(res, err, "Failed to assign tag");
    }
  });

  for (const action of ["unassign", "activate", "disable", "retire", "restore"] as const) {
    app.post(`${base}/:id/${action}`, requireAdmin, async (req, res) => {
      const id = idParam(req, res);
      if (!id) return;
      try {
        const { reason } = actionSchema.parse(req.body ?? {});
        await repo.transitionTag(id, action, userIdOf(req), reason);
        res.json(await repo.getTagDetail(id, smartTagBaseUrl()));
      } catch (err) {
        fail(res, err, `Failed to ${action} tag`);
      }
    });
  }

  app.get(`${base}/:id/analytics`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const q = analyticsQuerySchema.parse(req.query);
      const { from, to } = analyticsWindow(q);
      res.json(await repo.getAnalytics({ tagId: id }, from, to));
    } catch (err) {
      fail(res, err, "Failed to load tag analytics");
    }
  });

  // QR image for one tag (always the QR URL; NFC chips are programmed, not printed).
  for (const format of ["svg", "png"] as const) {
    app.get(`${base}/:id/qr.${format}`, requireAdmin, async (req, res) => {
      const id = idParam(req, res);
      if (!id) return;
      try {
        const tag = await repo.getTagRow(id);
        if (!tag) return res.status(404).json({ message: "Tag not found" });
        const { qrUrl } = buildSmartTagUrls(smartTagBaseUrl(), tag.publicCode);
        res.set("Cache-Control", "private, max-age=300");
        if (req.query.download) res.attachment(`${tag.publicCode}.${format}`);
        if (format === "svg") res.type("image/svg+xml").send(await qrSvg(qrUrl));
        else res.type("image/png").send(await qrPng(qrUrl));
      } catch (err) {
        fail(res, err, "Failed to render QR");
      }
    });
  }

  // ─── Customers ──────────────────────────────────────────────────────────────

  app.get("/api/admin/smart-tag-customers", requireAdmin, async (_req, res) => {
    try {
      res.json(await repo.listCustomers());
    } catch (err) {
      fail(res, err, "Failed to load customers");
    }
  });

  app.get("/api/admin/smart-tag-customers/:id", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const customer = await repo.getCustomer(id);
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(customer);
    } catch (err) {
      fail(res, err, "Failed to load customer");
    }
  });

  app.post("/api/admin/smart-tag-customers", requireAdmin, async (req, res) => {
    try {
      res.status(201).json(await repo.createCustomer(customerSchema.parse(req.body), userIdOf(req)));
    } catch (err) {
      fail(res, err, "Failed to create customer");
    }
  });

  app.patch("/api/admin/smart-tag-customers/:id", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      res.json(await repo.updateCustomer(id, customerSchema.partial().parse(req.body)));
    } catch (err) {
      fail(res, err, "Failed to update customer");
    }
  });

  // ─── Batches ────────────────────────────────────────────────────────────────

  app.get("/api/admin/smart-tag-batches", requireAdmin, async (_req, res) => {
    try {
      res.json(await repo.listBatches());
    } catch (err) {
      fail(res, err, "Failed to load batches");
    }
  });

  app.post("/api/admin/smart-tag-batches", requireAdmin, async (req, res) => {
    try {
      const batch = await repo.createBatch(batchCreateSchema.parse(req.body), userIdOf(req));
      res.status(201).json(batch);
    } catch (err) {
      fail(res, err, "Failed to create batch");
    }
  });

  app.get("/api/admin/smart-tag-batches/:id", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const batch = await repo.getBatch(id);
      if (!batch) return res.status(404).json({ message: "Batch not found" });
      res.json({ ...batch, tags: await repo.listTags({ batchId: id, limit: 2000 }) });
    } catch (err) {
      fail(res, err, "Failed to load batch");
    }
  });

  app.patch("/api/admin/smart-tag-batches/:id", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      res.json(await repo.updateBatch(id, batchPatchSchema.parse(req.body), userIdOf(req)));
    } catch (err) {
      fail(res, err, "Failed to update batch");
    }
  });

  app.get("/api/admin/smart-tag-batches/:id/export.csv", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const batch = await repo.getBatch(id);
      if (!batch) return res.status(404).json({ message: "Batch not found" });
      const tags = await repo.getBatchTagsForExport(id);
      res.set("Cache-Control", "no-store");
      res.attachment(`${fileSafe(batch.batchCode)}.csv`);
      res.type("text/csv").send(buildManufacturingCsv(batch, tags, smartTagBaseUrl()));
    } catch (err) {
      console.error("[smart-tags] CSV export failed:", err);
      res.status(500).json({ message: "Failed to export batch" });
    }
  });

  app.get("/api/admin/smart-tag-batches/:id/qr-assets.zip", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      const batch = await repo.getBatch(id);
      if (!batch) return res.status(404).json({ message: "Batch not found" });
      const tags = await repo.getBatchTagsForExport(id);
      const zip = await buildBatchZip({
        batch,
        tags,
        baseUrl: smartTagBaseUrl(),
        includePng: req.query.png === "1" || req.query.png === "true",
      });
      res.set("Cache-Control", "no-store");
      res.attachment(`${fileSafe(batch.batchCode)}-qr.zip`);
      res.type("application/zip").send(Buffer.from(zip));
    } catch (err) {
      console.error("[smart-tags] QR package export failed:", err);
      res.status(500).json({ message: "Failed to build QR package" });
    }
  });
}
