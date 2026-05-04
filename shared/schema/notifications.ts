import { boolean, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

// notification_templates: one row per (event_key x channel) pair.
// event_key values: 'new_chat' | 'hot_lead' | 'low_perf_alert'
// channel values:   'sms' | 'telegram'  (D-05: text not enum)
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull(),
  channel: text("channel").notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  eventKeyIdx: index("notification_templates_event_key_idx").on(table.eventKey),
}));

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// Manual Zod schema (hub.ts pattern — not drizzle-zod)
export const insertNotificationTemplateSchema = z.object({
  eventKey: z.string().min(1).max(100),
  channel: z.enum(["sms", "telegram"]),
  body: z.string().min(1),
  active: z.boolean().default(true),
});

export const selectNotificationTemplateSchema = z.object({
  id: z.number().int(),
  eventKey: z.string(),
  channel: z.string(),
  body: z.string(),
  active: z.boolean(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});
