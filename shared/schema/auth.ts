import { pgTable, text, serial, timestamp, boolean, jsonb, index, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table
export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table
export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  // E.164 ("+15085550100"). A verified phone is a sign-in method; unique when set.
  phone: text("phone"),
  // Stamped on every successful sign-in (shown as "last sign-in" in Users).
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Binds a Google Identity Platform subject (a phone or a Google account) to the
// local user it signs in. The Firebase ID token is only proof of that identity;
// who may do what stays in `users`.
export const authGoogleIdentities = pgTable(
  "auth_google_identities",
  {
    projectId: text("project_id").notNull(),
    subject: text("subject").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.subject] }),
    index("auth_google_identities_user").on(table.userId),
  ],
);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// System heartbeats table
export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemHeartbeatSchema = z.object({
  source: z.string().default("vercel-cron"),
  note: z.string().optional().default(""),
});

export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
export type InsertSystemHeartbeat = typeof systemHeartbeats.$inferInsert;
