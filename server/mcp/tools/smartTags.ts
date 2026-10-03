import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  SMART_TAG_PRODUCT_TYPES,
  buildManufacturingCsv,
  normalizeTagCode,
} from "#shared/smartTags.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";
import * as repo from "../../lib/smartTags/repository.js";
import { createJob } from "../../lib/smartTags/provisioning.js";
import * as journey from "../../lib/smartTags/journey.js";
import { JOURNEY_ENTRY_KINDS, JOURNEY_PRODUCTION_ACTIONS, PLAN_KINDS, PLAN_STATUSES } from "#shared/smartTagJourney.js";
import {
  actionSchema,
  assignSchema,
  batchCreateSchema,
  batchPatchSchema,
  customerSchema,
  listQuerySchema,
  smartTagBaseUrl,
  tagCreateSchema,
  tagPatchSchema,
} from "../../routes/smartTags.js";
import {
  journeyEntryCreateSchema,
  journeyEntryPatchSchema,
  journeyQuerySchema,
  planCreateSchema,
  planPatchSchema,
  planQuerySchema,
  toEntryInput,
} from "../../routes/smartTagJourney.js";

type AuditFn = typeof createAuditLog;
type AuditAction = "read" | "create" | "update";

// Some MCP clients serialize object parameters as JSON strings. Accept either.
const objectParam = z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}, z.record(z.unknown()));

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

/**
 * Smart Tags tools: the same repository and validation as the admin API
 * (server/routes/smartTags.ts), reachable with an MCP token. Built so the 3D
 * printing workflow can create a batch, read its manifest (the codes printed
 * as QR and serial on each piece) and queue the NFC chip writes without the
 * admin panel. There is no delete: tags are retired, never removed.
 * MCP calls have no session user, so history rows record no user id; the MCP
 * audit log records the token instead. Every mutation made here lands in the
 * Smart Tags Journey with source "mcp", and the journey tools let a session
 * record the steps the site never sees (art, slicing, printing, tests).
 */
export function registerSmartTagTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  const base = () => smartTagBaseUrl();

  async function run(
    toolName: string,
    action: AuditAction,
    targetType: string | undefined,
    targetId: string | undefined,
    fn: () => Promise<unknown>,
  ) {
    try {
      const out = await fn();
      await audit({ tokenId, tokenPrefix, toolName, targetType, targetId, action, result: "success", ipAddress: ip });
      return text(out);
    } catch (err) {
      let message = "Unexpected error";
      let issues: unknown;
      if (err instanceof repo.SmartTagError) message = err.message;
      else if (err instanceof z.ZodError) {
        message = "Validation error";
        issues = err.issues;
      } else console.error(`[mcp] ${toolName} failed:`, err);
      await audit({ tokenId, tokenPrefix, toolName, targetType, targetId, action, result: "error", errorMessage: message, ipAddress: ip });
      return text(issues ? { error: message, issues } : { error: message });
    }
  }

  /** A tag id (uuid) or its public code, as printed on the piece. */
  async function resolveTagId(ref: string): Promise<string> {
    if (z.string().uuid().safeParse(ref).success) return ref;
    const code = normalizeTagCode(ref);
    const tag = code ? await repo.getTagByCode(code) : null;
    if (!tag) throw new repo.SmartTagError("No tag with that id or code", 404);
    return tag.id;
  }

  async function detail(id: string) {
    const d = await repo.getTagDetail(id, base());
    if (!d) throw new repo.SmartTagError("Tag not found", 404);
    return d;
  }

  const tagRef = z.string().min(1).describe("Tag uuid or its public code (e.g. A7K3P9X2; case and Crockford look-alikes are normalised)");

  // ─── Overview and tags ──────────────────────────────────────────────────────

  server.tool(
    "smart_tags_overview",
    "Smart Tags dashboard numbers: tags by status, batches, recent activity.",
    {},
    async () => run("smart_tags_overview", "read", undefined, undefined, () => repo.getOverview()),
  );

  server.tool(
    "smart_tags_list",
    `List tags. Optional filters: status (inventory|assigned|active|disabled|retired), productType (${SMART_TAG_PRODUCT_TYPES.join("|")}), customerId, batchId, method (qr|nfc), search (code, label, customer), limit (1-2000).`,
    { filters: objectParam.optional() },
    async ({ filters }) =>
      run("smart_tags_list", "read", undefined, undefined, () => repo.listTags(listQuerySchema.parse(filters ?? {}))),
  );

  server.tool(
    "smart_tags_get",
    "One tag in full: status, customer, destination, QR and NFC URLs, batch, serial, NFC provisioning state, destination history.",
    { tag: tagRef },
    async ({ tag }) => run("smart_tags_get", "read", "smart_tag", tag, async () => detail(await resolveTagId(tag))),
  );

  server.tool(
    "smart_tags_create",
    `Create one standalone tag in inventory (not part of a batch). \`tag\`: { productType (${SMART_TAG_PRODUCT_TYPES.join("|")}), label? }.`,
    { tag: objectParam },
    async ({ tag }) =>
      run("smart_tags_create", "create", "smart_tag", undefined, async () => {
        const created = await repo.createSingleTag(tagCreateSchema.parse(tag));
        return detail(created.id);
      }),
  );

  server.tool(
    "smart_tags_update",
    "Patch a tag: label, productType (inventory only), destinationType, destinationUrl (https), utmEnabled, utmCampaign, metadata, reason. Every destination change is written to the immutable history. An active tag must keep a destination.",
    { tag: tagRef, patch: objectParam },
    async ({ tag, patch }) =>
      run("smart_tags_update", "update", "smart_tag", tag, async () => {
        const id = await resolveTagId(tag);
        await repo.updateTag(id, tagPatchSchema.parse(patch), null, "mcp");
        return detail(id);
      }),
  );

  server.tool(
    "smart_tags_assign",
    "Assign a tag to a customer. `to` is { customerId } or { customer: { businessName, slug?, contactName?, email?, phone?, externalCrmId?, notes? } } to create the customer on the way. A new owner never inherits the old destination.",
    { tag: tagRef, to: objectParam },
    async ({ tag, to }) =>
      run("smart_tags_assign", "update", "smart_tag", tag, async () => {
        const id = await resolveTagId(tag);
        const body = assignSchema.parse(to);
        const customerId = "customerId" in body ? body.customerId : (await repo.createCustomer(body.customer, null, "mcp")).id;
        await repo.assignTag(id, customerId, null, "mcp");
        return detail(id);
      }),
  );

  server.tool(
    "smart_tags_transition",
    "Lifecycle action on a tag: activate (needs a customer and a destination), disable, retire, restore, unassign (back to clean inventory, destination cleared). Optional reason.",
    {
      tag: tagRef,
      action: z.enum(["activate", "disable", "retire", "restore", "unassign"]),
      reason: z.string().max(300).optional(),
    },
    async ({ tag, action, reason }) =>
      run("smart_tags_transition", "update", "smart_tag", tag, async () => {
        const id = await resolveTagId(tag);
        const { reason: r } = actionSchema.parse({ reason });
        await repo.transitionTag(id, action, null, r, "mcp");
        return detail(id);
      }),
  );

  server.tool(
    "smart_tags_nfc_job_create",
    "Queue an NFC chip write for a tag: the paired Skale NFC Provisioner picks it up, writes https://skale.club/n/<CODE>, reads it back and the site verifies. Replaces any open job for the tag. Optional targetDeviceId pins it to one provisioner.",
    { tag: tagRef, targetDeviceId: z.string().uuid().optional() },
    async ({ tag, targetDeviceId }) =>
      run("smart_tags_nfc_job_create", "create", "smart_tag", tag, async () =>
        createJob(await resolveTagId(tag), null, base(), targetDeviceId ?? null)),
  );

  // ─── Customers ──────────────────────────────────────────────────────────────

  server.tool(
    "smart_tags_customers_list",
    "List Smart Tags customers with their tag counts.",
    {},
    async () => run("smart_tags_customers_list", "read", undefined, undefined, () => repo.listCustomers()),
  );

  server.tool(
    "smart_tags_customer_create",
    "Create a Smart Tags customer: { businessName, slug?, contactName?, email?, phone?, externalCrmId?, notes? }.",
    { customer: objectParam },
    async ({ customer }) =>
      run("smart_tags_customer_create", "create", "smart_tag_customer", undefined, () =>
        repo.createCustomer(customerSchema.parse(customer), null, "mcp")),
  );

  // ─── Batches ────────────────────────────────────────────────────────────────

  server.tool(
    "smart_tags_batches_list",
    "List manufacturing batches with counts (inventory, assigned, active, NFC verified).",
    {},
    async () => run("smart_tags_batches_list", "read", undefined, undefined, () => repo.listBatches()),
  );

  server.tool(
    "smart_tags_batch_create",
    `Create a manufacturing batch and its N inventory tags with fresh codes and serials 1..N. \`batch\`: { name, productType (${SMART_TAG_PRODUCT_TYPES.join("|")}), quantity (1-1000), batchCode? (default <PREFIX>-<YEAR>-<NNN>), vendor?, notes? }. Returns the batch, its tags and the manufacturing manifest.`,
    { batch: objectParam },
    async ({ batch }) =>
      run("smart_tags_batch_create", "create", "smart_tag_batch", undefined, async () => {
        const created = await repo.createBatch(batchCreateSchema.parse(batch), null, "mcp");
        return batchWithManifest(created.id);
      }),
  );

  server.tool(
    "smart_tags_batch_get",
    "One batch with its tags and its manufacturing manifest: the same CSV as manifest.csv in the admin's QR assets ZIP (batch_code, serial_number, public_code, qr_url, nfc_url, qr_asset_filename).",
    { batchId: z.string().uuid() },
    async ({ batchId }) =>
      run("smart_tags_batch_get", "read", "smart_tag_batch", batchId, () => batchWithManifest(batchId)),
  );

  server.tool(
    "smart_tags_batch_update",
    "Patch a batch: name, vendor, notes, status (draft|generated|ordered|received|completed|cancelled).",
    { batchId: z.string().uuid(), patch: objectParam },
    async ({ batchId, patch }) =>
      run("smart_tags_batch_update", "update", "smart_tag_batch", batchId, () =>
        repo.updateBatch(batchId, batchPatchSchema.parse(patch), null, "mcp")),
  );

  // ─── Journey ────────────────────────────────────────────────────────────────

  const ctx = journey.journeyContext(null, "mcp");

  /** `batch` (uuid or batch code) and `tag` (uuid or public code) → batchId / tagId. */
  async function withScopeRefs(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { batch, tag, ...rest } = input;
    if (typeof batch === "string" && batch.trim()) rest.batchId = await journey.resolveBatchId(batch);
    if (typeof tag === "string" && tag.trim()) rest.tagId = await resolveTagId(tag);
    return rest;
  }

  const scope = "`batch` (uuid or batch code, e.g. REV-2026-001), `tag` (uuid or public code) and/or `customerId`";

  server.tool(
    "smart_tags_journey_get",
    `The story of the Smart Tags: the journey timeline (executions with before → after, decisions, insights, observations, risks, results) and the plans. Scope with ${scope}; a tag's story includes its batch's batch-wide entries. Optional: kind (${JOURNEY_ENTRY_KINDS.join("|")}), planId, includeArchived, limit (1-500), planStatus (open|closed|all|<status>, default all), order (asc = oldest first, the default, to read it as a story; desc = newest first).`,
    { filters: objectParam.optional() },
    async ({ filters }) =>
      run("smart_tags_journey_get", "read", undefined, undefined, async () => {
        const { order, planStatus, ...rest } = (filters ?? {}) as Record<string, unknown>;
        const query = journeyQuerySchema.parse(await withScopeRefs(rest));
        const status = planQuerySchema.shape.status.parse(planStatus);
        const result = await journey.getJourney({ ...query, planStatus: status ?? "all" });
        if (order !== "desc") result.entries.reverse();
        return result;
      }),
  );

  server.tool(
    "smart_tags_journey_record",
    `Record a journey entry. \`entry\`: { kind (${JOURNEY_ENTRY_KINDS.join("|")}), title, content?, action? (snake_case; production steps: ${JOURNEY_PRODUCTION_ACTIONS.join(", ")}), batch? | tag? | customerId?, planId?, beforeValue?, afterValue?, metadata? (files, slice numbers, checks), occurredAt? (ISO, when it happened if earlier than now), proposed? (true → waits for admin review) }. The site already records its own mutations (batch created, assigned, activated, destination changed, NFC verified); use this for what happens outside it and for decisions and learnings.`,
    { entry: objectParam },
    async ({ entry }) =>
      run("smart_tags_journey_record", "create", "smart_tag_journey_entry", undefined, async () => {
        const body = journeyEntryCreateSchema.parse(await withScopeRefs(entry));
        return journey.createJourneyEntry(toEntryInput(body), ctx);
      }),
  );

  server.tool(
    "smart_tags_journey_review",
    "Change a journey entry's review status: active (approve a proposed entry), needs_review, archived, superseded (it was wrong; record the correction as a new entry). Entries are otherwise immutable.",
    { entryId: z.string().uuid(), status: z.enum(["active", "needs_review", "archived", "superseded"]) },
    async ({ entryId, status }) =>
      run("smart_tags_journey_review", "update", "smart_tag_journey_entry", entryId, () =>
        journey.setJourneyEntryStatus(entryId, journeyEntryPatchSchema.parse({ status }).status)),
  );

  server.tool(
    "smart_tags_plans_list",
    `List plans. Optional filters: status (open = draft|active|paused, the default; closed; all; or one of ${PLAN_STATUSES.join("|")}), ${scope}, limit.`,
    { filters: objectParam.optional() },
    async ({ filters }) =>
      run("smart_tags_plans_list", "read", undefined, undefined, async () =>
        journey.listPlans(planQuerySchema.parse(await withScopeRefs(filters ?? {})))),
  );

  server.tool(
    "smart_tags_plan_create",
    `Create a plan. \`plan\`: { kind (${PLAN_KINDS.join("|")}), title, description?, batch? | tag? | customerId?, status? (default active), dueDate? (YYYY-MM-DD), metadata? }. Written to the journey as a decision.`,
    { plan: objectParam },
    async ({ plan }) =>
      run("smart_tags_plan_create", "create", "smart_tag_plan", undefined, async () =>
        journey.createPlan(planCreateSchema.parse(await withScopeRefs(plan)), ctx)),
  );

  server.tool(
    "smart_tags_plan_update",
    `Patch a plan: title, description, status (${PLAN_STATUSES.join("|")}), outcome (what closing it showed), dueDate, metadata. A status change is written to the journey (validated / invalidated / done as a result, with the outcome).`,
    { planId: z.string().uuid(), patch: objectParam },
    async ({ planId, patch }) =>
      run("smart_tags_plan_update", "update", "smart_tag_plan", planId, () =>
        journey.updatePlan(planId, planPatchSchema.parse(patch), ctx)),
  );

  async function batchWithManifest(batchId: string) {
    const batch = await repo.getBatch(batchId);
    if (!batch) throw new repo.SmartTagError("Batch not found", 404);
    const [tags, exportTags] = await Promise.all([
      repo.listTags({ batchId, limit: 2000 }),
      repo.getBatchTagsForExport(batchId),
    ]);
    return { batch, tags, manifestCsv: buildManufacturingCsv(batch, exportTags, base(), "svg") };
  }
}
