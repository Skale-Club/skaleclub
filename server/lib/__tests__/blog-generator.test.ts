import { strict as assert } from "node:assert";

import type { BlogPost } from "#shared/schema.js";
import type {
  BlogGenerationJob,
  BlogSettings,
  InsertBlogGenerationJob,
} from "#shared/schema.js";

import {
  BlogGenerator,
  __resetBlogGeneratorTestDeps,
  __setBlogGeneratorTestDeps,
} from "../blog-generator.js";

type StorageStub = {
  getBlogSettings(): Promise<BlogSettings | undefined>;
  createBlogGenerationJob(data: InsertBlogGenerationJob): Promise<BlogGenerationJob>;
  updateBlogGenerationJob(id: number, data: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob>;
};

function createSettings(overrides: Partial<BlogSettings> = {}): BlogSettings {
  return {
    id: 1,
    enabled: true,
    postsPerDay: 2,
    seoKeywords: "seo",
    enableTrendAnalysis: false,
    promptStyle: "brief",
    lastRunAt: null,
    lockAcquiredAt: null,
    updatedAt: new Date("2026-04-22T00:00:00Z"),
    ...overrides,
  };
}

function createJob(overrides: Partial<BlogGenerationJob> = {}): BlogGenerationJob {
  return {
    id: 1,
    status: "running",
    reason: null,
    postId: null,
    startedAt: new Date("2026-04-22T00:00:00Z"),
    completedAt: null,
    error: null,
    ...overrides,
  };
}

function createStorageStub(settings?: BlogSettings): StorageStub {
  return {
    async getBlogSettings() {
      return settings;
    },
    async createBlogGenerationJob(data) {
      return createJob(data);
    },
    async updateBlogGenerationJob(id, data) {
      return createJob({ id, ...data });
    },
  };
}

async function expectSkip(
  label: string,
  options: {
    manual: boolean;
    settings?: BlogSettings;
    acquireLock?: () => Promise<boolean>;
  },
  reason: "no_settings" | "disabled" | "posts_per_day_zero" | "too_soon" | "locked",
) {
  __setBlogGeneratorTestDeps({
    storage: createStorageStub(options.settings),
    acquireLock: options.acquireLock,
    releaseLock: async () => {},
    runPipeline: async () => {
      throw new Error(`${label} should have skipped before pipeline`);
    },
    now: () => new Date("2026-04-22T12:00:00Z"),
  });

  const result = await BlogGenerator.generate({ manual: options.manual });
  assert.deepEqual(result, { skipped: true, reason }, label);
  __resetBlogGeneratorTestDeps();
}

async function expectManualBypass() {
  const settings = createSettings({
    enabled: false,
    postsPerDay: 0,
    lastRunAt: new Date("2026-04-22T11:59:00Z"),
  });

  __setBlogGeneratorTestDeps({
    storage: createStorageStub(settings),
    acquireLock: async () => true,
    releaseLock: async () => {},
    runPipeline: async ({ job }) => ({
      jobId: job.id,
      postId: 42,
      post: {
        id: 42,
        title: "Manual Run",
        slug: "manual-run",
        content: "content",
        excerpt: null,
        metaDescription: null,
        focusKeyword: null,
        tags: null,
        featureImageUrl: null,
        status: "draft",
        authorName: "AI Assistant",
        publishedAt: null,
        createdAt: new Date("2026-04-22T12:00:00Z"),
        updatedAt: new Date("2026-04-22T12:00:00Z"),
      } satisfies BlogPost,
    }),
    now: () => new Date("2026-04-22T12:00:00Z"),
  });

  const result = await BlogGenerator.generate({ manual: true });
  assert.equal(result.skipped, false);
  __resetBlogGeneratorTestDeps();
}

async function main() {
  await expectSkip("automatic run skips with no settings", { manual: false }, "no_settings");
  await expectSkip(
    "automatic run skips when disabled",
    { manual: false, settings: createSettings({ enabled: false }) },
    "disabled",
  );
  await expectSkip(
    "automatic run skips when posts per day is zero",
    { manual: false, settings: createSettings({ postsPerDay: 0 }) },
    "posts_per_day_zero",
  );
  await expectSkip(
    "automatic run skips when cadence window has not elapsed",
    {
      manual: false,
      settings: createSettings({
        postsPerDay: 2,
        lastRunAt: new Date("2026-04-22T02:00:00Z"),
      }),
    },
    "too_soon",
  );
  await expectSkip(
    "automatic run skips when another runner holds the lock",
    {
      manual: false,
      settings: createSettings(),
      acquireLock: async () => false,
    },
    "locked",
  );
  await expectSkip("manual run still requires a settings row", { manual: true }, "no_settings");
  await expectManualBypass();

  console.log("PASS: BlogGenerator skip and lock behavior matches the phase contract");
}

main().catch((error) => {
  console.error("FAIL: BlogGenerator contract regression");
  console.error(error);
  process.exit(1);
});
