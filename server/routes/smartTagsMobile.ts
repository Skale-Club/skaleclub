import type { Express, Request, Response } from "express";
import { z } from "zod";
import { SMART_TAG_DESTINATION_TYPES, validateDestinationUrl } from "#shared/smartTags.js";
import { DIRECT_WRITE_METHODS } from "#shared/nfcApp.js";
import { requireAdmin, sendError } from "./_shared.js";
import { smartTagBaseUrl } from "./smartTags.js";
import * as mobile from "../lib/smartTags/mobile.js";
import * as repo from "../lib/smartTags/repository.js";

// Skale NFC phone app (/nfc): the one-shot operations behind "tap the piece,
// paste the link, done". Admin session only, same as the rest of Smart Tags.

const allowHttp = () => process.env.NODE_ENV !== "production";

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());

const destinationUrl = z.string().transform((value, ctx) => {
  const result = validateDestinationUrl(value, { allowHttp: allowHttp() });
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.url;
});

const customerFields = {
  customerId: z.string().uuid().nullable().optional(),
  customerName: optionalText(200),
};

const quickActivateSchema = z.object({
  destinationUrl,
  destinationType: z.enum(SMART_TAG_DESTINATION_TYPES),
  label: optionalText(120),
  ...customerFields,
}).strict();

const nfcWrittenSchema = z.object({
  readbackUrl: z.string().max(2048).nullable().optional(),
  method: z.enum(DIRECT_WRITE_METHODS),
}).strict();

const directWriteSchema = z.object({
  url: destinationUrl,
  label: optionalText(120),
  method: z.enum(DIRECT_WRITE_METHODS),
  verified: z.boolean(),
  ...customerFields,
}).strict();

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
  const parsed = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success) {
    res.status(404).json({ message: "Not found" });
    return null;
  }
  return parsed.data;
}

export function registerSmartTagMobileRoutes(app: Express) {
  // Link + customer + activation in one step.
  app.post("/api/admin/smart-tags/:id/quick-activate", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      await mobile.quickActivateTag(id, quickActivateSchema.parse(req.body), userIdOf(req));
      res.json(await repo.getTagDetail(id, smartTagBaseUrl()));
    } catch (err) {
      fail(res, err, "Failed to activate tag");
    }
  });

  // The phone (or NFC Tools, by hand) wrote this tag's NFC URL into its chip.
  app.post("/api/admin/smart-tags/:id/nfc-written", requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      await mobile.recordPhoneWrite(id, nfcWrittenSchema.parse(req.body), smartTagBaseUrl(), userIdOf(req));
      res.json(await repo.getTagDetail(id, smartTagBaseUrl()));
    } catch (err) {
      fail(res, err, "Failed to record chip write");
    }
  });

  // Direct pieces: chips holding the customer's own link.
  app.get("/api/admin/smart-tag-direct-writes", requireAdmin, async (_req, res) => {
    try {
      res.json(await mobile.listDirectWrites());
    } catch (err) {
      fail(res, err, "Failed to load direct links");
    }
  });

  app.post("/api/admin/smart-tag-direct-writes", requireAdmin, async (req, res) => {
    try {
      res.status(201).json(await mobile.recordDirectWrite(directWriteSchema.parse(req.body), userIdOf(req)));
    } catch (err) {
      fail(res, err, "Failed to record direct link");
    }
  });
}
