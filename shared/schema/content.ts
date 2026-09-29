// Content revisions: point-in-time snapshots of admin-editable rows
// (pages, forms, company_settings) so an overwrite (admin edit, seed, restore)
// can always be rolled back.

import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const contentRevisionEntities = ["page", "form", "company_settings"] as const;
export type ContentRevisionEntity = (typeof contentRevisionEntities)[number];

export const contentRevisionSources = ["admin", "seed", "restore", "script"] as const;
export type ContentRevisionSource = (typeof contentRevisionSources)[number];

export const contentRevisions = pgTable("content_revisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  source: text("source").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdx: index("content_revisions_entity_idx").on(table.entity, table.entityId, table.createdAt.desc()),
}));

export type ContentRevision = typeof contentRevisions.$inferSelect;
