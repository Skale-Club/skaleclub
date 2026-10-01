// Smart Tags — dynamic QR/NFC redirects for physical products (review signs,
// NFC cards, keychains…). One `smart_tags` row per physical piece; its public
// code is printed (QR) and programmed (NFC) once and never changes, while the
// destination lives here and can change at any time.
//
// Enum-like columns are plain text guarded by CHECK constraints in the SQL
// migration (supabase/migrations/20261001120000_smart_tags.sql); the allowed
// values are the arrays in shared/smartTags.ts.

import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, bigserial, index, uniqueIndex } from "drizzle-orm/pg-core";
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

export type SmartTagCustomer = typeof smartTagCustomers.$inferSelect;
export type SmartTagBatch = typeof smartTagBatches.$inferSelect;
export type SmartTag = typeof smartTags.$inferSelect;
export type SmartTagDestinationChange = typeof smartTagDestinationHistory.$inferSelect;
export type SmartTagEvent = typeof smartTagEvents.$inferSelect;
export type InsertSmartTagEvent = typeof smartTagEvents.$inferInsert;
