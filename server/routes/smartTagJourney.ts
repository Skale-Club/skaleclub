import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  JOURNEY_ACTION_PATTERN,
  JOURNEY_ENTRY_KINDS,
  JOURNEY_ENTRY_STATUSES,
  JOURNEY_MAX_FUTURE_MS,
  PLAN_KINDS,
  PLAN_STATUSES,
} from "#shared/smartTagJourney.js";
import { requireAdmin, sendError } from "./_shared.js";
import { SmartTagError } from "../lib/smartTags/errors.js";
import * as journey from "../lib/smartTags/journey.js";

// Smart Tags Journey admin API: /api/admin/smart-tag-journey* (the timeline)
// and /api/admin/smart-tag-plans* (plans). The MCP tools reuse these schemas.

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v),
    z.string().max(max).nullable().optional(),
  );

const optionalUuid = z.string().uuid().nullable().optional();

const occurredAtField = z
  .string()
  .datetime({ offset: true })
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (date.getTime() > Date.now() + JOURNEY_MAX_FUTURE_MS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "occurredAt cannot be in the future", path: ["occurredAt"] });
      return z.NEVER;
    }
    return date;
  });

export const journeyEntryCreateSchema = z.object({
  kind: z.enum(JOURNEY_ENTRY_KINDS),
  action: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : v),
    z.string().regex(JOURNEY_ACTION_PATTERN, "action: a short snake_case word, e.g. printed").nullable().optional(),
  ),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: optionalText(4000),
  batchId: optionalUuid,
  tagId: optionalUuid,
  customerId: optionalUuid,
  planId: optionalUuid,
  beforeValue: optionalText(500),
  afterValue: optionalText(500),
  /** true → the entry waits for an admin's review (needs_review). */
  proposed: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  occurredAt: occurredAtField,
}).strict();

export const journeyEntryPatchSchema = z.object({
  status: z.enum(JOURNEY_ENTRY_STATUSES),
}).strict();

export const journeyQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  kind: z.enum(JOURNEY_ENTRY_KINDS).optional(),
  includeArchived: z.preprocess((v) => v === true || v === "1" || v === "true", z.boolean()).optional(),
  before: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const dueDateField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate: YYYY-MM-DD").nullable().optional(),
);

export const planCreateSchema = z.object({
  kind: z.enum(PLAN_KINDS),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText(4000),
  batchId: optionalUuid,
  tagId: optionalUuid,
  customerId: optionalUuid,
  status: z.enum(PLAN_STATUSES).optional(),
  dueDate: dueDateField,
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

export const planPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(4000),
  status: z.enum(PLAN_STATUSES).optional(),
  outcome: optionalText(4000),
  dueDate: dueDateField,
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

export const planQuerySchema = z.object({
  status: z.enum(["open", "closed", "all", ...PLAN_STATUSES]).optional(),
  batchId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/** The repository input for a parsed create body. */
export function toEntryInput(body: z.infer<typeof journeyEntryCreateSchema>): journey.JourneyEntryInput {
  const { proposed, ...rest } = body;
  return { ...rest, status: proposed ? "needs_review" : "active" };
}

function userIdOf(req: Request): string | null {
  return (req.session as { userId?: string } | undefined)?.userId ?? null;
}

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof SmartTagError) return res.status(err.status).json({ message: err.message });
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

export function registerSmartTagJourneyRoutes(app: Express) {
  const entries = "/api/admin/smart-tag-journey";
  const plans = "/api/admin/smart-tag-plans";

  // Timeline (newest first) plus the plans of the same scope.
  app.get(entries, requireAdmin, async (req, res) => {
    try {
      res.json(await journey.getJourney(journeyQuerySchema.parse(req.query)));
    } catch (err) {
      fail(res, err, "Failed to load journey");
    }
  });

  app.post(entries, requireAdmin, async (req, res) => {
    try {
      const input = toEntryInput(journeyEntryCreateSchema.parse(req.body));
      res.status(201).json(await journey.createJourneyEntry(input, journey.journeyContext(userIdOf(req), "admin")));
    } catch (err) {
      fail(res, err, "Failed to record journey entry");
    }
  });

  // Review only: approve a proposed entry, archive it, or mark it superseded.
  app.patch(`${entries}/:id`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      res.json(await journey.setJourneyEntryStatus(id, journeyEntryPatchSchema.parse(req.body).status));
    } catch (err) {
      fail(res, err, "Failed to update journey entry");
    }
  });

  app.get(plans, requireAdmin, async (req, res) => {
    try {
      res.json(await journey.listPlans(planQuerySchema.parse(req.query)));
    } catch (err) {
      fail(res, err, "Failed to load plans");
    }
  });

  app.post(plans, requireAdmin, async (req, res) => {
    try {
      const plan = await journey.createPlan(planCreateSchema.parse(req.body), journey.journeyContext(userIdOf(req), "admin"));
      res.status(201).json(plan);
    } catch (err) {
      fail(res, err, "Failed to create plan");
    }
  });

  app.patch(`${plans}/:id`, requireAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    try {
      res.json(await journey.updatePlan(id, planPatchSchema.parse(req.body), journey.journeyContext(userIdOf(req), "admin")));
    } catch (err) {
      fail(res, err, "Failed to update plan");
    }
  });
}
