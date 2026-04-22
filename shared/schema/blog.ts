import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

const nullableDateInputSchema = z.union([z.string(), z.date(), z.null()]).optional().transform((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
});

const dateInputSchema = z.union([z.string(), z.date()]).optional().transform((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
});

export const blogSettings = pgTable("blog_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  postsPerDay: integer("posts_per_day").notNull().default(0),
  seoKeywords: text("seo_keywords").notNull().default(""),
  enableTrendAnalysis: boolean("enable_trend_analysis").notNull().default(false),
  promptStyle: text("prompt_style").notNull().default(""),
  lastRunAt: timestamp("last_run_at"),
  lockAcquiredAt: timestamp("lock_acquired_at"),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export const blogGenerationJobs = pgTable("blog_generation_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  reason: text("reason"),
  postId: integer("post_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
});

export type BlogSettings = typeof blogSettings.$inferSelect;
export type InsertBlogSettings = typeof blogSettings.$inferInsert;
export type BlogGenerationJob = typeof blogGenerationJobs.$inferSelect;
export type InsertBlogGenerationJob = typeof blogGenerationJobs.$inferInsert;

export const insertBlogSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  postsPerDay: z.number().int().default(0),
  seoKeywords: z.string().default(""),
  enableTrendAnalysis: z.boolean().default(false),
  promptStyle: z.string().default(""),
  lastRunAt: nullableDateInputSchema,
  lockAcquiredAt: nullableDateInputSchema,
});

export const selectBlogSettingsSchema = z.object({
  id: z.number().int(),
  enabled: z.boolean(),
  postsPerDay: z.number().int(),
  seoKeywords: z.string(),
  enableTrendAnalysis: z.boolean(),
  promptStyle: z.string(),
  lastRunAt: z.date().nullable(),
  lockAcquiredAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const blogGenerationJobStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);

export const insertBlogGenerationJobSchema = z.object({
  status: blogGenerationJobStatusSchema,
  reason: z.string().nullable().optional(),
  postId: z.number().int().nullable().optional(),
  startedAt: dateInputSchema,
  completedAt: nullableDateInputSchema,
  error: z.string().nullable().optional(),
});

export const selectBlogGenerationJobSchema = z.object({
  id: z.number().int(),
  status: blogGenerationJobStatusSchema,
  reason: z.string().nullable(),
  postId: z.number().int().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  error: z.string().nullable(),
});
