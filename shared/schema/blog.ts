import { boolean, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";
// The parity contract owns these enums now — declaring local copies is exactly
// how the five products drifted apart in the first place.
import {
  blogFeedbackChannelSchema,
  blogFeedbackVerdictSchema,
  blogJobSourceSchema,
  blogJobStatusSchema,
  blogJobTriggerSchema,
  blogRssItemStatusSchema,
  durationsMsSchema,
  type BlogFeedbackChannel,
  type BlogFeedbackVerdict,
  type BlogJobSource,
  type BlogJobTrigger,
  type DurationsMs,
} from "../blog-contract.js";

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

// durationsMs / status enums come from shared/blog-contract.ts (see imports),
// re-exported here so `#shared/schema.js` importers are unaffected.
export { durationsMsSchema } from "../blog-contract.js";
export type { DurationsMs } from "../blog-contract.js";

export const blogSettings = pgTable("blog_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  postsPerDay: integer("posts_per_day").notNull().default(0),
  seoKeywords: text("seo_keywords").notNull().default(""),
  enableTrendAnalysis: boolean("enable_trend_analysis").notNull().default(false),
  promptStyle: text("prompt_style").notNull().default(""),
  // Autopost port (Xkedule): editorial guide injected into every generation.
  systemPrompt: text("system_prompt").notNull().default(""),
  // true → generator publishes immediately; false → drafts wait in the approval queue.
  // (Named auto_approve until the parity work; auto_publish is what it controls.)
  autoPublish: boolean("auto_publish").notNull().default(false),
  // OpenRouter model ids picked in the admin panel. Automation cannot be
  // enabled until both are set AND an OpenRouter API key is configured.
  textModel: text("text_model").notNull().default(""),
  imageModel: text("image_model").notNull().default(""),
  // RSS is this repo's only topic source today, so unlike the other products
  // this defaults TRUE — turning it off here would stop generation until the
  // editorial pillar rotation lands (SC-05).
  rssEnabled: boolean("rss_enabled").notNull().default(true),
  // Anchor hour 0-23 in the site's timezone. NULL keeps the drifting cadence.
  postingHour: integer("posting_hour"),
  // Which timezone that hour is in. The multi-tenant products read this from
  // the tenant's company settings; this is a single site, and it has no such
  // field, so the blog owns it. Default matches where the team publishes from.
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
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
  errorMessage: text("error_message"),
  // Contract columns (MASTER §3.2). NULL on rows written before they existed.
  trigger: text("trigger").$type<BlogJobTrigger>(),
  source: text("source").$type<BlogJobSource>(),
  rssItemId: integer("rss_item_id"),
  pillarId: text("pillar_id"),
  // Phase 38 BLOG2-15: per-stage timing breakdown. NULL on skipped jobs.
  // Failed jobs populate stages that completed before failure.
  durationsMs: jsonb("durations_ms").$type<DurationsMs>(),
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
  systemPrompt: z.string().default(""),
  autoPublish: z.boolean().default(false),
  textModel: z.string().default(""),
  imageModel: z.string().default(""),
  rssEnabled: z.boolean().default(true),
  postingHour: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z.string().min(1).max(100).default("America/Sao_Paulo"),
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
  systemPrompt: z.string(),
  autoPublish: z.boolean(),
  textModel: z.string(),
  imageModel: z.string(),
  rssEnabled: z.boolean(),
  postingHour: z.number().int().nullable(),
  timezone: z.string(),
  lastRunAt: z.date().nullable(),
  lockAcquiredAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

// Kept as a named export because callers import it; the values themselves are
// the contract's (blogJobStatusSchema).
export const blogGenerationJobStatusSchema = blogJobStatusSchema;

export const insertBlogGenerationJobSchema = z.object({
  status: blogGenerationJobStatusSchema,
  reason: z.string().nullable().optional(),
  postId: z.number().int().nullable().optional(),
  startedAt: dateInputSchema,
  completedAt: nullableDateInputSchema,
  errorMessage: z.string().nullable().optional(),
  trigger: blogJobTriggerSchema.nullable().optional(),
  source: blogJobSourceSchema.nullable().optional(),
  rssItemId: z.number().int().nullable().optional(),
  pillarId: z.string().nullable().optional(),
  durationsMs: durationsMsSchema.nullable().optional(),
});

export const selectBlogGenerationJobSchema = z.object({
  id: z.number().int(),
  status: blogGenerationJobStatusSchema,
  reason: z.string().nullable(),
  postId: z.number().int().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  trigger: blogJobTriggerSchema.nullable(),
  source: blogJobSourceSchema.nullable(),
  rssItemId: z.number().int().nullable(),
  pillarId: z.string().nullable(),
  durationsMs: durationsMsSchema.nullable(),
});


// ─── AI usage + cost log (autoblog-parity SC-08, ported from Websites) ──────
//
// One row per AI call the blog pipeline makes. Single-site, so no tenant_id.
// Writing a row must never be able to fail a generation.

export const aiGenerationLogs = pgTable("ai_generation_logs", {
  id: serial("id").primaryKey(),
  step: text("step").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  prompt: text("prompt"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
  status: text("status").notNull(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  createdIdx: index("ai_generation_logs_created_idx").on(table.createdAt),
}));

export type AiGenerationLog = typeof aiGenerationLogs.$inferSelect;
export type InsertAiGenerationLog = typeof aiGenerationLogs.$inferInsert;

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

// status stays text + a Zod enum at the app layer (not pgEnum); the enum itself
// now lives in the shared contract and is re-exported so existing importers of
// `#shared/schema.js` keep working.
export { blogRssItemStatusSchema } from "../blog-contract.js";
export type { BlogRssItemStatus } from "../blog-contract.js";

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

// ─── Post Feedback (Autopost port — approve/reject learning loop) ──────────
//
// Approving a generated post records a positive signal; rejecting records a
// negative one (with an optional reason) and deletes the post. Title/topic are
// snapshotted so the learning survives post deletion. The generator injects
// the most recent signals into its prompts ("more like these / avoid these").

export const blogPostFeedback = pgTable("blog_post_feedback", {
  id: serial("id").primaryKey(),
  // No FK on purpose: rejected posts are deleted but their feedback must survive.
  postId: integer("post_id"),
  postTitle: text("post_title").notNull(),
  postExcerpt: text("post_excerpt"),
  // Was rss_item_title: the origin of a topic stops being always-an-RSS-item
  // once the pillar rotation lands.
  sourceTitle: text("source_title"),
  verdict: text("verdict").$type<BlogFeedbackVerdict>().notNull(),
  reason: text("reason"),
  decidedBy: text("decided_by").$type<BlogFeedbackChannel>().notNull().default("admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  verdictCreatedIdx: index("blog_post_feedback_signal_created_idx").on(table.verdict, table.createdAt),
}));

export type BlogPostFeedback = typeof blogPostFeedback.$inferSelect;
export type InsertBlogPostFeedback = typeof blogPostFeedback.$inferInsert;

export const insertBlogPostFeedbackSchema = z.object({
  postId: z.number().int().nullable().optional(),
  postTitle: z.string().min(1).max(500),
  postExcerpt: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  verdict: blogFeedbackVerdictSchema,
  reason: z.string().max(1000).nullable().optional(),
  decidedBy: blogFeedbackChannelSchema.optional(),
});

export const selectBlogPostFeedbackSchema = z.object({
  id: z.number().int(),
  postId: z.number().int().nullable(),
  postTitle: z.string(),
  postExcerpt: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  verdict: blogFeedbackVerdictSchema,
  reason: z.string().nullable(),
  decidedBy: blogFeedbackChannelSchema,
  createdAt: z.date(),
});
