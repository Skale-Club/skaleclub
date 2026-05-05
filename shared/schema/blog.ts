import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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

// ─── RSS Sources & Items (Phase 34 — RSS-01, RSS-02, RSS-03) ───────────────

export const blogRssSources = pgTable("blog_rss_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastFetchedStatus: text("last_fetched_status"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  enabledIdx: index("blog_rss_sources_enabled_idx").on(table.enabled),
}));

export const blogRssItems = pgTable("blog_rss_items", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => blogRssSources.id, { onDelete: "cascade" }),
  guid: text("guid").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  publishedAt: timestamp("published_at"),
  status: text("status").notNull().default("pending"),
  usedAt: timestamp("used_at"),
  usedPostId: integer("used_post_id"),
  skipReason: text("skip_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sourceIdStatusIdx: index("blog_rss_items_source_id_status_idx").on(table.sourceId, table.status),
  sourceIdGuidUniq: uniqueIndex("blog_rss_items_source_id_guid_uniq").on(table.sourceId, table.guid),
}));

export type BlogRssSource = typeof blogRssSources.$inferSelect;
export type InsertBlogRssSource = typeof blogRssSources.$inferInsert;
export type BlogRssItem = typeof blogRssItems.$inferSelect;
export type InsertBlogRssItem = typeof blogRssItems.$inferInsert;

// D-05: status is text + Zod enum at app layer (not pgEnum)
export const blogRssItemStatusSchema = z.enum(["pending", "used", "skipped"]);
export type BlogRssItemStatus = z.infer<typeof blogRssItemStatusSchema>;

// Manual Zod (project convention for nullable/defaulted fields — STATE.md Phase 21)
export const insertBlogRssSourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  enabled: z.boolean().default(true),
  lastFetchedAt: nullableDateInputSchema,
  lastFetchedStatus: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const selectBlogRssSourceSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  url: z.string(),
  enabled: z.boolean(),
  lastFetchedAt: z.date().nullable(),
  lastFetchedStatus: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertBlogRssItemSchema = z.object({
  sourceId: z.number().int().positive(),
  guid: z.string().min(1).max(2000),
  url: z.string().url().max(2000),
  title: z.string().min(1).max(1000),
  summary: z.string().nullable().optional(),
  publishedAt: nullableDateInputSchema,
  status: blogRssItemStatusSchema.default("pending"),
  usedAt: nullableDateInputSchema,
  usedPostId: z.number().int().nullable().optional(),
  skipReason: z.string().nullable().optional(),
});

export const selectBlogRssItemSchema = z.object({
  id: z.number().int(),
  sourceId: z.number().int(),
  guid: z.string(),
  url: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  publishedAt: z.date().nullable(),
  status: blogRssItemStatusSchema,
  usedAt: z.date().nullable(),
  usedPostId: z.number().int().nullable(),
  skipReason: z.string().nullable(),
  createdAt: z.date(),
});
