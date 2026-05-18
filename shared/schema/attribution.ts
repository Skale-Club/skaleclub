// Phase 45 — Marketing Attribution (single-tenant adaptation of skaleclub-websites v1.2).
// Source: skaleclub-websites/shared/schema.ts (visitorSessions + attributionConversions).
// All `tenant_id` columns and tenant-scoped indexes are intentionally dropped.

import { pgTable, text, serial, integer, timestamp, boolean, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { formLeads } from "./forms.js";

// === VISITOR SESSIONS ===
// First-touch columns are written once on INSERT and NEVER updated by upsert.
// Last-touch columns are updated on every subsequent visit.
export const visitorSessions = pgTable("visitor_sessions", {
  id: serial("id").primaryKey(),
  visitorId: uuid("visitor_id").notNull(),
  // First-touch (immutable after first insert)
  ftSource: text("ft_source"),
  ftMedium: text("ft_medium"),
  ftCampaign: text("ft_campaign"),
  ftTerm: text("ft_term"),
  ftContent: text("ft_content"),
  ftId: text("ft_id"),
  ftLandingPage: text("ft_landing_page"),
  ftReferrer: text("ft_referrer"),
  ftSourceChannel: text("ft_source_channel"),
  // Last-touch (updated on every upsert)
  ltSource: text("lt_source"),
  ltMedium: text("lt_medium"),
  ltCampaign: text("lt_campaign"),
  ltTerm: text("lt_term"),
  ltContent: text("lt_content"),
  ltId: text("lt_id"),
  ltLandingPage: text("lt_landing_page"),
  ltReferrer: text("lt_referrer"),
  ltSourceChannel: text("lt_source_channel"),
  // Metadata
  deviceType: text("device_type"),
  converted: boolean("converted").default(false),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
}, (table) => ({
  visitorIdIdx: uniqueIndex("visitor_sessions_visitor_id_unique").on(table.visitorId),
  ftSourceChannelIdx: index("visitor_sessions_ft_source_channel_idx").on(table.ftSourceChannel),
  convertedIdx: index("visitor_sessions_converted_idx").on(table.converted),
  firstSeenAtIdx: index("visitor_sessions_first_seen_at_idx").on(table.firstSeenAt),
  lastSeenAtIdx: index("visitor_sessions_last_seen_at_idx").on(table.lastSeenAt),
}));

// === ATTRIBUTION CONVERSIONS ===
// Denormalized: stores ft_*/lt_* attribution at the moment of conversion.
// Optimized for GROUP BY source/campaign aggregation without joins.
export const attributionConversions = pgTable("attribution_conversions", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id").references(() => visitorSessions.id, { onDelete: "set null" }),
  leadId: integer("lead_id").references(() => formLeads.id, { onDelete: "set null" }),
  conversionType: text("conversion_type").$type<'lead_created' | 'phone_click' | 'form_submitted' | 'booking_started'>().notNull(),
  ftSource: text("ft_source"),
  ftMedium: text("ft_medium"),
  ftCampaign: text("ft_campaign"),
  ftLandingPage: text("ft_landing_page"),
  ltSource: text("lt_source"),
  ltMedium: text("lt_medium"),
  ltCampaign: text("lt_campaign"),
  ltLandingPage: text("lt_landing_page"),
  pagePath: text("page_path"),
  convertedAt: timestamp("converted_at").defaultNow().notNull(),
}, (table) => ({
  visitorIdIdx: index("attribution_conversions_visitor_id_idx").on(table.visitorId),
  leadIdIdx: index("attribution_conversions_lead_id_idx").on(table.leadId),
  conversionTypeIdx: index("attribution_conversions_conversion_type_idx").on(table.conversionType),
  convertedAtIdx: index("attribution_conversions_converted_at_idx").on(table.convertedAt),
}));

export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export const insertAttributionConversionSchema = createInsertSchema(attributionConversions).omit({
  id: true,
  convertedAt: true,
});

export type VisitorSession = typeof visitorSessions.$inferSelect;
export type InsertVisitorSession = typeof visitorSessions.$inferInsert;
export type AttributionConversion = typeof attributionConversions.$inferSelect;
export type InsertAttributionConversion = typeof attributionConversions.$inferInsert;
