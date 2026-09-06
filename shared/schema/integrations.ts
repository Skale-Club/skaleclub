import { pgTable, text, serial, integer, timestamp, boolean, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

// Xphere Integration Settings (singleton, quick 260906-g80).
// Booking slugs and the org id are admin-entered — no tenant-specific defaults here.
// `tenantRef` is sent as `source.tenant_ref` on every delivery; its default is this
// product's own identifier, not a customer's.
export const xphereSettings = pgTable("xphere_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  apiKey: text("api_key"),
  keyPrefix: text("key_prefix"),
  xphereOrgId: text("xphere_org_id"),
  xphereOrgName: text("xphere_org_name"),
  status: text("status").notNull().default("disconnected"),
  lastValidatedAt: timestamp("last_validated_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorCode: text("last_error_code"),
  bookingEnabled: boolean("booking_enabled").notNull().default(false),
  bookingProfileSlug: text("booking_profile_slug"),
  inPersonEventSlug: text("in_person_event_slug"),
  onlineEventSlug: text("online_event_slug"),
  visitTypeQuestionId: text("visit_type_question_id").notNull().default("tipoVisita"),
  inPersonAnswerValue: text("in_person_answer_value").notNull().default("presencial"),
  onlineAnswerValue: text("online_answer_value").notNull().default("online"),
  tenantRef: text("tenant_ref").notNull().default("skaleclub"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Durable outbox for provider deliveries (currently only provider = "xphere").
// Single-tenant repo: tenant_id defaults to 1 and has no FK (there is no tenants table).
export const integrationDeliveries = pgTable("integration_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: integer("tenant_id").notNull().default(1),
  provider: text("provider").notNull(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: integer("aggregate_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  responseStatus: integer("response_status"),
  providerReceiptId: text("provider_receipt_id"),
  providerContactId: text("provider_contact_id"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
}, (table) => ({
  aggregateUnique: uniqueIndex("integration_deliveries_aggregate_unique").on(
    table.tenantId, table.provider, table.eventType, table.aggregateType, table.aggregateId,
  ),
  dueIdx: index("integration_deliveries_due_idx").on(table.status, table.nextAttemptAt),
  tenantIdx: index("integration_deliveries_tenant_idx").on(table.tenantId, table.createdAt),
}));

export const insertXphereSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().nullable().optional(),
  keyPrefix: z.string().nullable().optional(),
  xphereOrgId: z.string().nullable().optional(),
  xphereOrgName: z.string().nullable().optional(),
  status: z.string().optional(),
  lastValidatedAt: z.date().nullable().optional(),
  lastSuccessAt: z.date().nullable().optional(),
  lastErrorAt: z.date().nullable().optional(),
  lastErrorCode: z.string().nullable().optional(),
  bookingEnabled: z.boolean().default(false),
  bookingProfileSlug: z.string().nullable().optional(),
  inPersonEventSlug: z.string().nullable().optional(),
  onlineEventSlug: z.string().nullable().optional(),
  visitTypeQuestionId: z.string().optional(),
  inPersonAnswerValue: z.string().optional(),
  onlineAnswerValue: z.string().optional(),
  tenantRef: z.string().trim().min(1).max(80).optional(),
});

export type XphereSettings = typeof xphereSettings.$inferSelect;
export type InsertXphereSettings = typeof xphereSettings.$inferInsert;
export type IntegrationDelivery = typeof integrationDeliveries.$inferSelect;
export type InsertIntegrationDelivery = typeof integrationDeliveries.$inferInsert;
