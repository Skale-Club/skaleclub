// Smart Tags — dynamic QR/NFC redirects for physical products (review signs,
// NFC cards, keychains…). One `smart_tags` row per physical piece; its public
// code is printed (QR) and programmed (NFC) once and never changes, while the
// destination lives here and can change at any time.
//
// Enum-like columns are plain text guarded by CHECK constraints in the SQL
// migration (supabase/migrations/20261001120000_smart_tags.sql); the allowed
// values are the arrays in shared/smartTags.ts.

import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, date, bigserial, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const smartTagCustomers = pgTable("smart_tag_customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull(),
  slug: text("slug"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  externalCrmId: text("external_crm_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smartTagBatches = pgTable("smart_tag_batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  batchCode: text("batch_code").notNull(),
  name: text("name").notNull(),
  productType: text("product_type").notNull(),
  vendor: text("vendor"),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("generated"),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchCodeIdx: uniqueIndex("smart_tag_batches_batch_code_unique").on(table.batchCode),
}));

export const smartTags = pgTable("smart_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  publicCode: text("public_code").notNull(),
  // Position inside its batch (1-based); the manufacturing CSV's serial_number.
  serialNumber: integer("serial_number"),
  batchId: uuid("batch_id").references(() => smartTagBatches.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => smartTagCustomers.id, { onDelete: "set null" }),
  productType: text("product_type").notNull(),
  status: text("status").notNull().default("inventory"),
  destinationType: text("destination_type"),
  destinationUrl: text("destination_url"),
  utmEnabled: boolean("utm_enabled").notNull().default(false),
  utmCampaign: text("utm_campaign"),
  label: text("label"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  // Physical NFC chip state, written by the desktop provisioner flow.
  nfcProvisioningStatus: text("nfc_provisioning_status").notNull().default("not_programmed"),
  nfcProgrammedAt: timestamp("nfc_programmed_at", { withTimezone: true }),
  nfcVerifiedAt: timestamp("nfc_verified_at", { withTimezone: true }),
  nfcLockedAt: timestamp("nfc_locked_at", { withTimezone: true }),
  nfcProvisioningDeviceId: uuid("nfc_provisioning_device_id").references(() => smartTagProvisioningDevices.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  publicCodeIdx: uniqueIndex("smart_tags_public_code_unique").on(table.publicCode),
  customerIdx: index("smart_tags_customer_id_idx").on(table.customerId),
  batchIdx: index("smart_tags_batch_id_idx").on(table.batchId),
  statusIdx: index("smart_tags_status_idx").on(table.status),
}));

// Append-only: every destination/type change writes one row, never updated.
export const smartTagDestinationHistory = pgTable("smart_tag_destination_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: uuid("tag_id").notNull().references(() => smartTags.id, { onDelete: "cascade" }),
  previousUrl: text("previous_url"),
  newUrl: text("new_url"),
  previousDestinationType: text("previous_destination_type"),
  newDestinationType: text("new_destination_type"),
  changedByUserId: text("changed_by_user_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tagIdx: index("smart_tag_destination_history_tag_idx").on(table.tagId, table.createdAt.desc()),
}));

// One row per public QR scan / NFC tap. No raw IP is ever stored: approximate
// uniques use `visitor_day_key`, a daily-rotating HMAC (server/lib/smartTags/requestInfo.ts).
export const smartTagEvents = pgTable("smart_tag_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tagId: uuid("tag_id").notNull().references(() => smartTags.id, { onDelete: "cascade" }),
  // Owner at the time of the event, so a re-assigned piece never moves past
  // interactions onto its new customer's numbers.
  customerId: uuid("customer_id").references(() => smartTagCustomers.id, { onDelete: "set null" }),
  accessMethod: text("access_method").notNull(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  visitorDayKey: text("visitor_day_key"),
  deviceType: text("device_type"),
  osFamily: text("os_family"),
  browserFamily: text("browser_family"),
  countryCode: text("country_code"),
  referrer: text("referrer"),
  isBot: boolean("is_bot").notNull().default(false),
  requestId: text("request_id"),
}, (table) => ({
  tagOccurredIdx: index("smart_tag_events_tag_occurred_idx").on(table.tagId, table.occurredAt),
  methodOccurredIdx: index("smart_tag_events_method_occurred_idx").on(table.accessMethod, table.occurredAt),
  visitorOccurredIdx: index("smart_tag_events_visitor_occurred_idx").on(table.visitorDayKey, table.occurredAt),
  occurredIdx: index("smart_tag_events_occurred_idx").on(table.occurredAt),
  customerOccurredIdx: index("smart_tag_events_customer_occurred_idx").on(table.customerId, table.occurredAt),
}));

// ─── NFC provisioning (desktop "Skale NFC Provisioner") ──────────────────────
// SQL: supabase/migrations/20261001130000_smart_tag_provisioning.sql

export const smartTagProvisioningDevices = pgTable("smart_tag_provisioning_devices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceName: text("device_name").notNull(),
  platform: text("platform"),
  appVersion: text("app_version"),
  status: text("status").notNull().default("pairing"),
  pairingCodeHash: text("pairing_code_hash"),
  pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
  tokenHash: text("token_hash"),
  tokenPrefix: text("token_prefix"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const smartTagProvisioningJobs = pgTable("smart_tag_provisioning_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: uuid("tag_id").notNull().references(() => smartTags.id, { onDelete: "cascade" }),
  expectedUrl: text("expected_url").notNull(),
  status: text("status").notNull().default("pending"),
  requestedByUserId: text("requested_by_user_id"),
  targetDeviceId: uuid("target_device_id").references(() => smartTagProvisioningDevices.id, { onDelete: "set null" }),
  claimedByDeviceId: uuid("claimed_by_device_id").references(() => smartTagProvisioningDevices.id, { onDelete: "set null" }),
  readbackUrl: text("readback_url"),
  tagType: text("tag_type"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tagIdx: index("smart_tag_provisioning_jobs_tag_idx").on(table.tagId, table.createdAt.desc()),
}));

export const smartTagProvisioningEvents = pgTable("smart_tag_provisioning_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  jobId: uuid("job_id").references(() => smartTagProvisioningJobs.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").references(() => smartTags.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => smartTagProvisioningDevices.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index("smart_tag_provisioning_events_job_idx").on(table.jobId, table.createdAt),
}));

// ─── Direct pieces (Skale NFC app) ───────────────────────────────────────────
// Chips written with the customer's own URL, no redirect. Log only.
// SQL: supabase/migrations/20261003120000_smart_tag_direct_writes.sql

export const smartTagDirectWrites = pgTable("smart_tag_direct_writes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").references(() => smartTagCustomers.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  label: text("label"),
  method: text("method").notNull().default("web_nfc"),
  verified: boolean("verified").notNull().default(false),
  writtenByUserId: text("written_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdIdx: index("smart_tag_direct_writes_created_idx").on(table.createdAt.desc()),
  customerIdx: index("smart_tag_direct_writes_customer_idx").on(table.customerId, table.createdAt.desc()),
}));

// ─── Journey (story, planning, execution) ────────────────────────────────────
// SQL: supabase/migrations/20261003150000_smart_tag_journey.sql
// Allowed values: shared/smartTagJourney.ts.

export const smartTagPlans = pgTable("smart_tag_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  batchId: uuid("batch_id").references(() => smartTagBatches.id, { onDelete: "set null" }),
  tagId: uuid("tag_id").references(() => smartTags.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => smartTagCustomers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  outcome: text("outcome"),
  dueDate: date("due_date", { mode: "string" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("smart_tag_plans_status_idx").on(table.status, table.createdAt.desc()),
}));

// Append-only timeline; a DB trigger lets UPDATE change `status` only.
export const smartTagJourneyEntries = pgTable("smart_tag_journey_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: text("kind").notNull(),
  action: text("action"),
  title: text("title").notNull(),
  content: text("content"),
  batchId: uuid("batch_id").references(() => smartTagBatches.id, { onDelete: "set null" }),
  tagId: uuid("tag_id").references(() => smartTags.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => smartTagCustomers.id, { onDelete: "set null" }),
  planId: uuid("plan_id").references(() => smartTagPlans.id, { onDelete: "set null" }),
  beforeValue: text("before_value"),
  afterValue: text("after_value"),
  source: text("source").notNull(),
  actor: text("actor").notNull(),
  actorUserId: text("actor_user_id"),
  status: text("status").notNull().default("active"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  occurredIdx: index("smart_tag_journey_entries_occurred_idx").on(table.occurredAt.desc()),
}));

export type SmartTagPlan = typeof smartTagPlans.$inferSelect;
export type SmartTagJourneyEntry = typeof smartTagJourneyEntries.$inferSelect;
export type InsertSmartTagJourneyEntry = typeof smartTagJourneyEntries.$inferInsert;

export type SmartTagProvisioningDevice =typeof smartTagProvisioningDevices.$inferSelect;
export type SmartTagProvisioningJob = typeof smartTagProvisioningJobs.$inferSelect;

export type SmartTagCustomer = typeof smartTagCustomers.$inferSelect;
export type SmartTagBatch = typeof smartTagBatches.$inferSelect;
export type SmartTag = typeof smartTags.$inferSelect;
export type SmartTagDestinationChange = typeof smartTagDestinationHistory.$inferSelect;
export type SmartTagEvent = typeof smartTagEvents.$inferSelect;
export type InsertSmartTagEvent = typeof smartTagEvents.$inferInsert;
