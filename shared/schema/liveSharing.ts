import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import type { LiveSnapshot, LiveLanguage, LiveKind } from "../liveSharing.js";

// Server-only snapshots; never expose credentials through the public schema API.
export const liveSessions = pgTable("live_sessions", {
  id: uuid("id").primaryKey(),
  sourceKind: text("source_kind").$type<LiveKind>().notNull(),
  sourceId: text("source_id").notNull(),
  createdBy: text("created_by").notNull(),
  snapshot: jsonb("snapshot").$type<LiveSnapshot>().notNull(),
  controllerHash: text("controller_hash").notNull(),
  audienceHash: text("audience_hash"),
  accessCodeHash: text("access_code_hash"),
  slideIndex: integer("slide_index").notNull().default(0),
  language: text("language").$type<LiveLanguage>().notNull(),
  revision: integer("revision").notNull().default(0),
  status: text("status").$type<"live" | "ended">().notNull().default("live"),
  lastCommandId: text("last_command_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => ({ expiresIdx: index("live_sessions_expires_idx").on(table.expiresAt) }));

export type LiveSessionRecord = typeof liveSessions.$inferSelect;
