// Run: npx tsx server/lib/__tests__/blogSchema.test.ts
import { strict as assert } from "node:assert";

import {
  blogGenerationJobStatusSchema,
  blogGenerationJobs,
  blogSettings,
  insertBlogGenerationJobSchema,
  insertBlogSettingsSchema,
  selectBlogGenerationJobSchema,
  selectBlogSettingsSchema,
} from "../../../shared/schema.js";

const defaultSettings = insertBlogSettingsSchema.parse({});
assert.equal(defaultSettings.enabled, false);
assert.equal(defaultSettings.postsPerDay, 0);
assert.equal(defaultSettings.seoKeywords, "");
assert.equal(defaultSettings.enableTrendAnalysis, false);
assert.equal(defaultSettings.promptStyle, "");
assert.equal(defaultSettings.lastRunAt, undefined);
assert.equal(defaultSettings.lockAcquiredAt, undefined);

const selectedSettings = selectBlogSettingsSchema.parse({
  id: 1,
  enabled: false,
  postsPerDay: 0,
  seoKeywords: "seo",
  enableTrendAnalysis: false,
  promptStyle: "brief",
  lastRunAt: null,
  lockAcquiredAt: null,
  updatedAt: new Date(),
});
assert.equal(selectedSettings.id, 1);

assert.equal(blogGenerationJobStatusSchema.parse("pending"), "pending");

const insertedJob = insertBlogGenerationJobSchema.parse({
  status: "running",
  reason: null,
  postId: null,
  startedAt: new Date().toISOString(),
  completedAt: null,
  error: null,
});
assert.equal(insertedJob.status, "running");
assert.equal(insertedJob.postId, null);
assert.ok(insertedJob.startedAt instanceof Date);

const selectedJob = selectBlogGenerationJobSchema.parse({
  id: 1,
  status: "completed",
  reason: "manual",
  postId: 42,
  startedAt: new Date(),
  completedAt: null,
  error: null,
});
assert.equal(selectedJob.id, 1);

assert.equal(blogSettings[Symbol.for("drizzle:Name")], "blog_settings");
assert.equal(blogGenerationJobs[Symbol.for("drizzle:Name")], "blog_generation_jobs");

console.log("PASS: Blog automation schema exports and validators are wired correctly");
