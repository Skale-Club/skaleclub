import { boolean, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

// notification_templates: a notification message for a trigger event on a channel.
// Multiple templates may target the same (event_key, channel) pair.
// event_key values: 'new_chat' | 'hot_lead' | 'low_perf_alert'
// channel values:   'sms' | 'telegram' | 'email'  (D-05: text not enum)
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  name: text("name"),               // human label shown in the admin tab strip
  eventKey: text("event_key").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject"),         // used by the email channel only
  body: text("body").notNull().default(""),
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
  name: z.string().max(200).optional(),
  eventKey: z.string().min(1).max(100),
  channel: z.enum(["sms", "telegram", "email"]),
  subject: z.string().max(300).optional(),
  body: z.string().default(""),
  active: z.boolean().default(true),
});

export const selectNotificationTemplateSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  eventKey: z.string(),
  channel: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  active: z.boolean(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});
