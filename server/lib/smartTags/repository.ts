import type { Request } from "express";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../db.js";
import {
  smartTagBatches,
  smartTagCustomers,
  smartTagDestinationHistory,
  smartTagEvents,
  smartTags,
  users,
  type InsertSmartTagEvent,
  type SmartTag,
} from "#shared/schema.js";
import {
  buildSmartTagUrls,
  planTransition,
  type SmartTagAction,
  type SmartTagStatus,
} from "#shared/smartTags.js";
import type {
  SmartTagAnalytics,
  SmartTagBatchItem,
  SmartTagCustomerItem,
  SmartTagDetail,
  SmartTagHistoryEntry,
  SmartTagListItem,
  SmartTagOverview,
} from "#shared/smartTagsApi.js";
import { generateUniqueCodes } from "./codes.js";
import type { PublicSmartTag } from "./publicHandler.js";

/** A 4xx the routes pass straight to the client. */
export class SmartTagError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

// "Interactions" are human redirects only: bots and scans of inactive tags are
// tracked but never counted as interactions.
const COUNTABLE = sql`e.event_type = 'redirect' AND NOT e.is_bot`;

// ─── Public lookups ───────────────────────────────────────────────────────────

export async function findPublicTagByCode(code: string): Promise<PublicSmartTag | null> {
  const [tag] = await db
    .select({
      id: smartTags.id,
      publicCode: smartTags.publicCode,
      customerId: smartTags.customerId,
      status: smartTags.status,
      destinationUrl: smartTags.destinationUrl,
      utmEnabled: smartTags.utmEnabled,
      utmCampaign: smartTags.utmCampaign,
    })
    .from(smartTags)
    .where(eq(smartTags.publicCode, code))
    .limit(1);
  return tag ?? null;
}

export async function recordSmartTagEvent(event: InsertSmartTagEvent): Promise<void> {
  await db.insert(smartTagEvents).values(event);
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  const userId = (req.session as { userId?: string } | undefined)?.userId;
  if (!userId) return false;
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return !!user?.isAdmin;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export interface TagListFilters {
  status?: string;
  productType?: string;
  customerId?: string;
  batchId?: string;
  method?: "qr" | "nfc";
  search?: string;
  limit?: number;
}

type TagRow = {
  id: string;
  public_code: string;
  serial_number: number | null;
  product_type: string;
  status: string;
  nfc_provisioning_status: string;
  label: string | null;
  destination_type: string | null;
  destination_url: string | null;
  customer_id: string | null;
  customer_name: string | null;
  batch_id: string | null;
  batch_code: string | null;
  qr: number;
  nfc: number;
  last_interaction_at: Date | null;
  activated_at: Date | null;
  created_at: Date;
};

function toListItem(r: TagRow): SmartTagListItem {
  return {
    id: r.id,
    publicCode: r.public_code,
    serialNumber: r.serial_number,
    productType: r.product_type,
    status: r.status,
    nfcStatus: r.nfc_provisioning_status,
    label: r.label,
    destinationType: r.destination_type,
    destinationUrl: r.destination_url,
    customerId: r.customer_id,
    customerName: r.customer_name,
    batchId: r.batch_id,
    batchCode: r.batch_code,
    qrInteractions: Number(r.qr ?? 0),
    nfcInteractions: Number(r.nfc ?? 0),
    lastInteractionAt: iso(r.last_interaction_at),
    activatedAt: iso(r.activated_at),
    createdAt: iso(r.created_at)!,
  };
}

function tagListQuery(where: SQL, limit: number): SQL {
  return sql`
    SELECT t.id, t.public_code, t.serial_number, t.product_type, t.status, t.nfc_provisioning_status, t.label,
           t.destination_type, t.destination_url, t.customer_id, c.business_name AS customer_name,
           t.batch_id, b.batch_code, t.activated_at, t.created_at,
           COALESCE(s.qr, 0)::int AS qr, COALESCE(s.nfc, 0)::int AS nfc, s.last_interaction_at
    FROM smart_tags t
    LEFT JOIN smart_tag_customers c ON c.id = t.customer_id
    LEFT JOIN smart_tag_batches b ON b.id = t.batch_id
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE e.access_method = 'qr') AS qr,
             count(*) FILTER (WHERE e.access_method = 'nfc') AS nfc,
             max(e.occurred_at) AS last_interaction_at
      FROM smart_tag_events e
      WHERE e.tag_id = t.id AND ${COUNTABLE}
    ) s ON true
    WHERE ${where}
    ORDER BY t.batch_id NULLS LAST, t.serial_number NULLS LAST, t.created_at DESC
    LIMIT ${limit}
  `;
}

export async function listTags(filters: TagListFilters): Promise<SmartTagListItem[]> {
  const conds: SQL[] = [sql`true`];
  if (filters.status) conds.push(sql`t.status = ${filters.status}`);
  if (filters.productType) conds.push(sql`t.product_type = ${filters.productType}`);
  if (filters.customerId) conds.push(sql`t.customer_id = ${filters.customerId}`);
  if (filters.batchId) conds.push(sql`t.batch_id = ${filters.batchId}`);
  if (filters.method === "qr") conds.push(sql`COALESCE(s.qr, 0) > 0`);
  if (filters.method === "nfc") conds.push(sql`COALESCE(s.nfc, 0) > 0`);
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`(t.public_code ILIKE ${term} OR c.business_name ILIKE ${term} OR t.label ILIKE ${term} OR b.batch_code ILIKE ${term})`);
  }
  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 2000);
  return (await rows<TagRow>(tagListQuery(sql.join(conds, sql` AND `), limit))).map(toListItem);
}

export async function getTagRow(id: string): Promise<SmartTag | null> {
  const [tag] = await db.select().from(smartTags).where(eq(smartTags.id, id)).limit(1);
  return tag ?? null;
}

export async function getTagByCode(code: string): Promise<SmartTag | null> {
  const [tag] = await db.select().from(smartTags).where(eq(smartTags.publicCode, code)).limit(1);
  return tag ?? null;
}

async function historyFor(where: SQL, limit: number): Promise<Array<SmartTagHistoryEntry & { tagId: string; publicCode: string }>> {
  const list = await rows<{
    id: string; tag_id: string; public_code: string; previous_url: string | null; new_url: string | null;
    previous_destination_type: string | null; new_destination_type: string | null;
    changed_by_user_id: string | null; changed_by_email: string | null; reason: string | null; created_at: Date;
  }>(sql`
    SELECT h.id, h.tag_id, t.public_code, h.previous_url, h.new_url, h.previous_destination_type,
           h.new_destination_type, h.changed_by_user_id, u.email AS changed_by_email, h.reason, h.created_at
    FROM smart_tag_destination_history h
    JOIN smart_tags t ON t.id = h.tag_id
    LEFT JOIN users u ON u.id = h.changed_by_user_id
    WHERE ${where}
    ORDER BY h.created_at DESC
    LIMIT ${limit}
  `);
  return list.map((h) => ({
    id: h.id,
    tagId: h.tag_id,
    publicCode: h.public_code,
    previousUrl: h.previous_url,
    newUrl: h.new_url,
    previousDestinationType: h.previous_destination_type,
    newDestinationType: h.new_destination_type,
    changedByUserId: h.changed_by_user_id,
    changedByEmail: h.changed_by_email,
    reason: h.reason,
    createdAt: iso(h.created_at)!,
  }));
}

export async function getTagDetail(id: string, baseUrl: string): Promise<SmartTagDetail | null> {
  const tag = await getTagRow(id);
  if (!tag) return null;
  const [item] = (await rows<TagRow>(tagListQuery(sql`t.id = ${id}`, 1))).map(toListItem);
  const history = await historyFor(sql`h.tag_id = ${id}`, 100);
  return {
    ...item,
    utmEnabled: tag.utmEnabled,
    utmCampaign: tag.utmCampaign,
    metadata: tag.metadata ?? null,
    assignedAt: iso(tag.assignedAt),
    disabledAt: iso(tag.disabledAt),
    updatedAt: iso(tag.updatedAt)!,
    ...buildSmartTagUrls(baseUrl, tag.publicCode),
    history: history.map(({ tagId: _t, publicCode: _p, ...h }) => h),
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockTag(tx: Tx, id: string): Promise<SmartTag> {
  const [tag] = await tx.select().from(smartTags).where(eq(smartTags.id, id)).for("update");
  if (!tag) throw new SmartTagError("Tag not found", 404);
  return tag;
}

async function writeHistory(
  tx: Tx,
  before: Pick<SmartTag, "id" | "destinationUrl" | "destinationType">,
  after: { destinationUrl: string | null; destinationType: string | null },
  userId: string | null,
  reason: string | null,
) {
  if (before.destinationUrl === after.destinationUrl && before.destinationType === after.destinationType) return;
  await tx.insert(smartTagDestinationHistory).values({
    tagId: before.id,
    previousUrl: before.destinationUrl,
    newUrl: after.destinationUrl,
    previousDestinationType: before.destinationType,
    newDestinationType: after.destinationType,
    changedByUserId: userId,
    reason,
  });
}

export interface TagUpdate {
  label?: string | null;
  productType?: string;
  destinationType?: string | null;
  destinationUrl?: string | null;
  utmEnabled?: boolean;
  utmCampaign?: string | null;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
}

/** Edits a tag; any destination change is written to the immutable history. */
export async function updateTag(id: string, patch: TagUpdate, userId: string | null): Promise<SmartTag> {
  return db.transaction(async (tx) => {
    const tag = await lockTag(tx, id);
    if (tag.status === "retired") throw new SmartTagError("A retired tag cannot be edited");
    const next = {
      destinationUrl: patch.destinationUrl !== undefined ? patch.destinationUrl : tag.destinationUrl,
      destinationType: patch.destinationType !== undefined ? patch.destinationType : tag.destinationType,
    };
    if (tag.status === "active" && (!next.destinationUrl || !next.destinationType)) {
      throw new SmartTagError("An active tag must keep a destination; disable it first");
    }
    if (patch.productType && patch.productType !== tag.productType && tag.status !== "inventory") {
      throw new SmartTagError("Product type can only change while the tag is in inventory");
    }
    await writeHistory(tx, tag, next, userId, patch.reason ?? null);
    const [updated] = await tx
      .update(smartTags)
      .set({
        ...next,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.productType ? { productType: patch.productType } : {}),
        ...(patch.utmEnabled !== undefined ? { utmEnabled: patch.utmEnabled } : {}),
        ...(patch.utmCampaign !== undefined ? { utmCampaign: patch.utmCampaign } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        updatedAt: new Date(),
      })
      .where(eq(smartTags.id, id))
      .returning();
    return updated;
  });
}

/**
 * Runs one lifecycle action under a row lock. The state machine lives in
 * shared/smartTags.ts (planTransition) so the UI and server agree on it.
 */
export async function transitionTag(
  id: string,
  action: Exclude<SmartTagAction, "assign">,
  userId: string | null,
  reason?: string | null,
): Promise<SmartTag> {
  return db.transaction(async (tx) => {
    const tag = await lockTag(tx, id);
    const plan = planTransition(tag, action);
    if (!plan.ok) throw new SmartTagError(plan.error, 409);
    const now = new Date();
    const set: Partial<SmartTag> = { status: plan.status, updatedAt: now };
    if (action === "activate") Object.assign(set, { activatedAt: now, disabledAt: null });
    if (action === "disable") set.disabledAt = now;
    if (action === "retire") set.disabledAt = tag.disabledAt ?? now;
    if (action === "unassign") {
      // Back to clean inventory: the previous customer's destination must not
      // follow the piece to whoever gets it next.
      Object.assign(set, {
        customerId: null, destinationUrl: null, destinationType: null, utmEnabled: false, utmCampaign: null,
        assignedAt: null, activatedAt: null, disabledAt: null,
      });
      await writeHistory(tx, tag, { destinationUrl: null, destinationType: null }, userId, reason ?? "Unassigned");
    }
    const [updated] = await tx.update(smartTags).set(set).where(eq(smartTags.id, id)).returning();
    console.log(`[smart-tags] ${action} ${tag.publicCode}: ${tag.status} → ${plan.status} (user ${userId ?? "?"})`);
    return updated;
  });
}

export async function assignTag(id: string, customerId: string, userId: string | null): Promise<SmartTag> {
  return db.transaction(async (tx) => {
    const tag = await lockTag(tx, id);
    const plan = planTransition(tag, "assign");
    if (!plan.ok) throw new SmartTagError(plan.error, 409);
    const [customer] = await tx.select({ id: smartTagCustomers.id }).from(smartTagCustomers).where(eq(smartTagCustomers.id, customerId));
    if (!customer) throw new SmartTagError("Customer not found", 404);
    const changingOwner = tag.customerId !== customerId;
    const set: Partial<SmartTag> = {
      customerId,
      status: plan.status,
      assignedAt: changingOwner || !tag.assignedAt ? new Date() : tag.assignedAt,
      updatedAt: new Date(),
    };
    // A new owner never inherits the old owner's destination.
    if (changingOwner && tag.customerId && (tag.destinationUrl || tag.destinationType)) {
      if (tag.status === "active") {
        throw new SmartTagError("Disable the tag before moving it to another customer", 409);
      }
      Object.assign(set, { destinationUrl: null, destinationType: null, utmEnabled: false, utmCampaign: null });
      await writeHistory(tx, tag, { destinationUrl: null, destinationType: null }, userId, "Re-assigned to another customer");
    }
    const [updated] = await tx.update(smartTags).set(set).where(eq(smartTags.id, id)).returning();
    console.log(`[smart-tags] assign ${tag.publicCode} → customer ${customerId} (user ${userId ?? "?"})`);
    return updated;
  });
}

/** One standalone tag (not part of a manufacturing batch). */
export async function createSingleTag(input: { productType: string; label?: string | null }): Promise<SmartTag> {
  const [code] = await generateUniqueCodes(1, findExistingCodes);
  const [tag] = await db
    .insert(smartTags)
    .values({ publicCode: code, productType: input.productType, label: input.label ?? null, status: "inventory" })
    .returning();
  console.log(`[smart-tags] created standalone tag ${code}`);
  return tag;
}

async function findExistingCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const found = await db.select({ code: smartTags.publicCode }).from(smartTags).where(inArray(smartTags.publicCode, codes));
  return new Set(found.map((r) => r.code));
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function listCustomers(): Promise<SmartTagCustomerItem[]> {
  const list = await rows<{
    id: string; business_name: string; slug: string | null; contact_name: string | null; email: string | null;
    phone: string | null; external_crm_id: string | null; notes: string | null; created_at: Date;
    tag_count: number; active_tags: number; interactions: number; last_interaction_at: Date | null;
  }>(sql`
    SELECT c.*,
      (SELECT count(*)::int FROM smart_tags t WHERE t.customer_id = c.id) AS tag_count,
      (SELECT count(*)::int FROM smart_tags t WHERE t.customer_id = c.id AND t.status = 'active') AS active_tags,
      (SELECT count(*)::int FROM smart_tag_events e WHERE e.customer_id = c.id AND ${COUNTABLE}) AS interactions,
      (SELECT max(e.occurred_at) FROM smart_tag_events e WHERE e.customer_id = c.id AND ${COUNTABLE}) AS last_interaction_at
    FROM smart_tag_customers c
    ORDER BY c.business_name ASC
  `);
  return list.map((c) => ({
    id: c.id,
    businessName: c.business_name,
    slug: c.slug,
    contactName: c.contact_name,
    email: c.email,
    phone: c.phone,
    externalCrmId: c.external_crm_id,
    notes: c.notes,
    tagCount: Number(c.tag_count),
    activeTags: Number(c.active_tags),
    interactions: Number(c.interactions),
    lastInteractionAt: iso(c.last_interaction_at),
    createdAt: iso(c.created_at)!,
  }));
}

export interface CustomerInput {
  businessName: string;
  slug?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  externalCrmId?: string | null;
  notes?: string | null;
}

export async function createCustomer(input: CustomerInput) {
  const [customer] = await db.insert(smartTagCustomers).values(input).returning();
  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
  const [customer] = await db
    .update(smartTagCustomers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(smartTagCustomers.id, id))
    .returning();
  if (!customer) throw new SmartTagError("Customer not found", 404);
  return customer;
}

export async function getCustomer(id: string) {
  const [customer] = await db.select().from(smartTagCustomers).where(eq(smartTagCustomers.id, id)).limit(1);
  return customer ?? null;
}

// ─── Batches ──────────────────────────────────────────────────────────────────

const BATCH_PREFIX: Record<string, string> = {
  google_review_sign: "REV",
  business_card: "CARD",
  keychain: "KEY",
  safety_tag: "SAFE",
  menu_tag: "MENU",
  booking_tag: "BOOK",
  custom: "TAG",
};

async function nextBatchCode(productType: string): Promise<string> {
  const prefix = `${BATCH_PREFIX[productType] ?? "TAG"}-${new Date().getUTCFullYear()}-`;
  const [row] = await rows<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM smart_tag_batches WHERE batch_code LIKE ${`${prefix}%`}
  `);
  return `${prefix}${String(Number(row?.n ?? 0) + 1).padStart(3, "0")}`;
}

export interface BatchInput {
  name: string;
  batchCode?: string | null;
  productType: string;
  vendor?: string | null;
  quantity: number;
  notes?: string | null;
}

/**
 * Creates the batch and its N inventory tags in one transaction. Codes are
 * checked against the database before insert; a race that still collides on
 * the unique index rolls the whole batch back and is retried.
 */
export async function createBatch(input: BatchInput, userId: string | null) {
  const batchCode = input.batchCode?.trim() || (await nextBatchCode(input.productType));
  for (let attempt = 1; ; attempt++) {
    const codes = await generateUniqueCodes(input.quantity, findExistingCodes);
    try {
      const batch = await db.transaction(async (tx) => {
        const [batch] = await tx
          .insert(smartTagBatches)
          .values({
            batchCode,
            name: input.name,
            productType: input.productType,
            vendor: input.vendor ?? null,
            quantity: input.quantity,
            status: "generated",
            notes: input.notes ?? null,
            createdByUserId: userId,
          })
          .returning();
        await tx.insert(smartTags).values(
          codes.map((publicCode, index) => ({
            publicCode,
            serialNumber: index + 1,
            batchId: batch.id,
            productType: input.productType,
            status: "inventory",
          })),
        );
        return batch;
      });
      console.log(`[smart-tags] batch ${batch.batchCode} created with ${input.quantity} tags (user ${userId ?? "?"})`);
      return batch;
    } catch (err) {
      const pg = err as { code?: string; constraint?: string };
      if (pg.code === "23505" && pg.constraint === "smart_tags_public_code_unique" && attempt < 3) continue;
      if (pg.code === "23505") throw new SmartTagError(`Batch code ${batchCode} already exists`, 409);
      throw err;
    }
  }
}

export async function updateBatch(id: string, input: Partial<Pick<BatchInput, "name" | "vendor" | "notes">> & { status?: string }) {
  const [batch] = await db
    .update(smartTagBatches)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(smartTagBatches.id, id))
    .returning();
  if (!batch) throw new SmartTagError("Batch not found", 404);
  return batch;
}

export async function listBatches(): Promise<SmartTagBatchItem[]> {
  const list = await rows<{
    id: string; batch_code: string; name: string; product_type: string; vendor: string | null; quantity: number;
    status: string; notes: string | null; created_at: Date; tag_count: number; inventory_count: number;
    assigned_count: number; active_count: number; nfc_verified_count: number;
  }>(sql`
    SELECT b.id, b.batch_code, b.name, b.product_type, b.vendor, b.quantity, b.status, b.notes, b.created_at,
      count(t.id)::int AS tag_count,
      count(t.id) FILTER (WHERE t.status = 'inventory')::int AS inventory_count,
      count(t.id) FILTER (WHERE t.status IN ('assigned', 'active', 'disabled'))::int AS assigned_count,
      count(t.id) FILTER (WHERE t.status = 'active')::int AS active_count,
      count(t.id) FILTER (WHERE t.nfc_provisioning_status IN ('verified', 'locked'))::int AS nfc_verified_count
    FROM smart_tag_batches b
    LEFT JOIN smart_tags t ON t.batch_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
  return list.map((b) => ({
    id: b.id,
    batchCode: b.batch_code,
    name: b.name,
    productType: b.product_type,
    vendor: b.vendor,
    quantity: b.quantity,
    status: b.status,
    notes: b.notes,
    createdAt: iso(b.created_at)!,
    tagCount: Number(b.tag_count),
    inventoryCount: Number(b.inventory_count),
    assignedCount: Number(b.assigned_count),
    activeCount: Number(b.active_count),
    nfcVerifiedCount: Number(b.nfc_verified_count),
  }));
}

export async function getBatch(id: string) {
  const [batch] = await db.select().from(smartTagBatches).where(eq(smartTagBatches.id, id)).limit(1);
  return batch ?? null;
}

export async function getBatchTagsForExport(batchId: string) {
  return db
    .select({ publicCode: smartTags.publicCode, serialNumber: smartTags.serialNumber })
    .from(smartTags)
    .where(eq(smartTags.batchId, batchId))
    .orderBy(smartTags.serialNumber, smartTags.publicCode);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsScope {
  tagId?: string;
  customerId?: string;
  batchId?: string;
  productType?: string;
}

function scopeSql(scope: AnalyticsScope): SQL {
  const conds: SQL[] = [sql`true`];
  if (scope.tagId) conds.push(sql`e.tag_id = ${scope.tagId}`);
  // Customer analytics follow who owned the piece at event time.
  if (scope.customerId) conds.push(sql`e.customer_id = ${scope.customerId}`);
  if (scope.batchId) conds.push(sql`t.batch_id = ${scope.batchId}`);
  if (scope.productType) conds.push(sql`t.product_type = ${scope.productType}`);
  return sql.join(conds, sql` AND `);
}

export async function getAnalytics(scope: AnalyticsScope, from: Date, to: Date): Promise<SmartTagAnalytics> {
  const where = sql`${scopeSql(scope)} AND e.occurred_at >= ${from} AND e.occurred_at < ${to}`;
  const base = sql`FROM smart_tag_events e JOIN smart_tags t ON t.id = e.tag_id WHERE ${where}`;

  const [totals] = await rows<{
    interactions: number; qr: number; nfc: number; approx_unique: number; last_at: Date | null;
    bot_hits: number; inactive_scans: number;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE ${COUNTABLE})::int AS interactions,
      count(*) FILTER (WHERE ${COUNTABLE} AND e.access_method = 'qr')::int AS qr,
      count(*) FILTER (WHERE ${COUNTABLE} AND e.access_method = 'nfc')::int AS nfc,
      count(DISTINCT (e.tag_id, e.visitor_day_key)) FILTER (WHERE ${COUNTABLE})::int AS approx_unique,
      max(e.occurred_at) FILTER (WHERE ${COUNTABLE}) AS last_at,
      count(*) FILTER (WHERE e.is_bot)::int AS bot_hits,
      count(*) FILTER (WHERE e.event_type <> 'redirect' AND NOT e.is_bot)::int AS inactive_scans
    ${base}
  `);

  const daily = await rows<{ day: string; qr: number; nfc: number; approx_unique: number }>(sql`
    SELECT to_char(date_trunc('day', e.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      count(*) FILTER (WHERE e.access_method = 'qr')::int AS qr,
      count(*) FILTER (WHERE e.access_method = 'nfc')::int AS nfc,
      count(DISTINCT (e.tag_id, e.visitor_day_key))::int AS approx_unique
    ${base} AND ${COUNTABLE}
    GROUP BY 1 ORDER BY 1
  `);

  const devices = await rows<{ device_type: string | null; count: number }>(sql`
    SELECT e.device_type, count(*)::int AS count ${base} AND ${COUNTABLE}
    GROUP BY 1 ORDER BY 2 DESC
  `);

  const topTags = scope.tagId ? [] : await rows<{ id: string; public_code: string; customer_name: string | null; qr: number; nfc: number }>(sql`
    SELECT t.id, t.public_code, c.business_name AS customer_name,
      count(*) FILTER (WHERE e.access_method = 'qr')::int AS qr,
      count(*) FILTER (WHERE e.access_method = 'nfc')::int AS nfc
    FROM smart_tag_events e
    JOIN smart_tags t ON t.id = e.tag_id
    LEFT JOIN smart_tag_customers c ON c.id = t.customer_id
    WHERE ${where} AND ${COUNTABLE}
    GROUP BY t.id, t.public_code, c.business_name
    ORDER BY count(*) DESC
    LIMIT 10
  `);

  // Fill missing days so charts show gaps as zero.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const points: SmartTagAnalytics["daily"] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let d = start; d < to && points.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    points.push({ day: key, qr: Number(hit?.qr ?? 0), nfc: Number(hit?.nfc ?? 0), approxUnique: Number(hit?.approx_unique ?? 0) });
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      interactions: Number(totals?.interactions ?? 0),
      qr: Number(totals?.qr ?? 0),
      nfc: Number(totals?.nfc ?? 0),
      approxUnique: Number(totals?.approx_unique ?? 0),
      lastInteractionAt: iso(totals?.last_at),
      botHits: Number(totals?.bot_hits ?? 0),
      inactiveScans: Number(totals?.inactive_scans ?? 0),
    },
    daily: points,
    devices: devices.map((d) => ({ deviceType: d.device_type ?? "unknown", count: Number(d.count) })),
    topTags: topTags.map((t) => ({ id: t.id, publicCode: t.public_code, customerName: t.customer_name, qr: Number(t.qr), nfc: Number(t.nfc) })),
  };
}

export async function getOverview(now: Date = new Date()): Promise<SmartTagOverview> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since7 = new Date(now.getTime() - 7 * 86_400_000);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const statusRows = await db
    .select({ status: smartTags.status, count: sql<number>`count(*)::int` })
    .from(smartTags)
    .groupBy(smartTags.status);
  const counts: SmartTagOverview["counts"] = { total: 0, inventory: 0, assigned: 0, active: 0, disabled: 0, retired: 0 };
  for (const r of statusRows) {
    counts.total += Number(r.count);
    if (r.status in counts) counts[r.status as SmartTagStatus] = Number(r.count);
  }

  const [m] = await rows<{ today: number; last7: number; last30: number; qr30: number; nfc30: number; unique30: number }>(sql`
    SELECT
      count(*) FILTER (WHERE e.occurred_at >= ${dayStart})::int AS today,
      count(*) FILTER (WHERE e.occurred_at >= ${since7})::int AS last7,
      count(*)::int AS last30,
      count(*) FILTER (WHERE e.access_method = 'qr')::int AS qr30,
      count(*) FILTER (WHERE e.access_method = 'nfc')::int AS nfc30,
      count(DISTINCT (e.tag_id, e.visitor_day_key))::int AS unique30
    FROM smart_tag_events e
    WHERE e.occurred_at >= ${since30} AND ${COUNTABLE}
  `);

  const recentEvents = await rows<{
    id: number; tag_id: string; public_code: string; customer_name: string | null; access_method: string;
    event_type: string; device_type: string | null; occurred_at: Date;
  }>(sql`
    SELECT e.id, e.tag_id, t.public_code, c.business_name AS customer_name, e.access_method, e.event_type,
           e.device_type, e.occurred_at
    FROM smart_tag_events e
    JOIN smart_tags t ON t.id = e.tag_id
    LEFT JOIN smart_tag_customers c ON c.id = e.customer_id
    WHERE NOT e.is_bot
    ORDER BY e.occurred_at DESC
    LIMIT 15
  `);

  const recentActivations = await db
    .select({
      id: smartTags.id,
      publicCode: smartTags.publicCode,
      customerName: smartTagCustomers.businessName,
      activatedAt: smartTags.activatedAt,
    })
    .from(smartTags)
    .leftJoin(smartTagCustomers, eq(smartTagCustomers.id, smartTags.customerId))
    .where(and(eq(smartTags.status, "active")))
    .orderBy(desc(smartTags.activatedAt))
    .limit(5);

  return {
    counts,
    interactions: { today: Number(m?.today ?? 0), last7: Number(m?.last7 ?? 0), last30: Number(m?.last30 ?? 0) },
    split30: { qr: Number(m?.qr30 ?? 0), nfc: Number(m?.nfc30 ?? 0) },
    approxUnique30: Number(m?.unique30 ?? 0),
    recentEvents: recentEvents.map((e) => ({
      id: Number(e.id),
      tagId: e.tag_id,
      publicCode: e.public_code,
      customerName: e.customer_name,
      accessMethod: e.access_method,
      eventType: e.event_type,
      deviceType: e.device_type,
      occurredAt: iso(e.occurred_at)!,
    })),
    recentActivations: recentActivations
      .filter((a) => a.activatedAt)
      .map((a) => ({ id: a.id, publicCode: a.publicCode, customerName: a.customerName, activatedAt: iso(a.activatedAt)! })),
    recentChanges: await historyFor(sql`true`, 10),
  };
}
