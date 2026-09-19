import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One row per self-applying maintenance task (see server/lib/bootstrapTasks.ts).
 * A task with `completedAt` set is skipped on later boots; one without it is
 * retried, with the last failure kept for the admin to read.
 */
export const bootstrapTasks = pgTable("bootstrap_tasks", {
  name: text("name").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BootstrapTask = typeof bootstrapTasks.$inferSelect;
