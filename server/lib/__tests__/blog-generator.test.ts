import { strict as assert } from "node:assert";

import type { BlogPost } from "#shared/schema.js";
import type {
  BlogGenerationJob,
  BlogSettings,
  InsertBlogGenerationJob,
  InsertBlogPost,
  InsertBlogSettings,
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
  createBlogPost(data: InsertBlogPost): Promise<BlogPost>;
  upsertBlogSettings(data: InsertBlogSettings): Promise<BlogSettings>;
};

type StorageSpies = {
  onCreateJob?: (data: InsertBlogGenerationJob) => void;
  onUpdateJob?: (id: number, data: Partial<InsertBlogGenerationJob>) => void;
  onCreatePost?: (data: InsertBlogPost) => void;
  onUpsertSettings?: (data: InsertBlogSettings) => void;
};

function createSettings(overrides: Partial<BlogSettings> = {}): BlogSettings {
  return {
    id: 1,
    enabled: true,
    postsPerDay: 2,
    seoKeywords: "seo, local rankings",
    enableTrendAnalysis: true,
    promptStyle: "confident but practical",
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

function createPostRecord(data: InsertBlogPost, id = 77): BlogPost {
  return {
    id,
    title: data.title,
    slug: data.slug,
    content: data.content,
    excerpt: data.excerpt ?? null,
    metaDescription: data.metaDescription ?? null,
    focusKeyword: data.focusKeyword ?? null,
    tags: data.tags ?? null,
    featureImageUrl: data.featureImageUrl ?? null,
    status: data.status ?? "draft",
    authorName: data.authorName ?? "Admin",
    publishedAt: data.publishedAt ?? null,
    createdAt: new Date("2026-04-22T12:00:00Z"),
    updatedAt: new Date("2026-04-22T12:00:00Z"),
  };
}

function createStorageStub(settings?: BlogSettings, spies: StorageSpies = {}): StorageStub {
  return {
    async getBlogSettings() {
      return settings;
    },
    async createBlogGenerationJob(data) {
      spies.onCreateJob?.(data);
      return createJob(data);
    },
    async updateBlogGenerationJob(id, data) {
      spies.onUpdateJob?.(id, data);
      return createJob({ id, ...data });
    },
    async createBlogPost(data) {
      spies.onCreatePost?.(data);
      return createPostRecord(data);
    },
    async upsertBlogSettings(data) {
      spies.onUpsertSettings?.(data);
      return createSettings({ ...settings, ...data, id: settings?.id ?? 1 });
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
        slug: "manual-run-1713787200000",
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
  assert.equal(result.skipped, false, "manual runs can bypass automatic gates when pipeline succeeds");
  const successResult = result as Extract<typeof result, { skipped: false }>;
  assert.deepEqual(result, {
    skipped: false,
    reason: null,
    jobId: 1,
    postId: 42,
    post: successResult.post,
  });
  __resetBlogGeneratorTestDeps();
}

async function expectSuccessfulGeneration() {
  process.env.BLOG_GEMINI_API_KEY = "test-key";

  const callOrder: string[] = [];
  let createdPostInput: InsertBlogPost | null = null;
  let completedJobUpdate: Partial<InsertBlogGenerationJob> | null = null;
  let finalizedSettings: InsertBlogSettings | null = null;

  __setBlogGeneratorTestDeps({
    storage: createStorageStub(createSettings(), {
      onCreateJob: (data) => {
        callOrder.push(`createJob:${data.status}`);
      },
      onCreatePost: (data) => {
        createdPostInput = data;
        callOrder.push("createPost");
      },
      onUpdateJob: (_id, data) => {
        completedJobUpdate = data;
        callOrder.push(`updateJob:${data.status}`);
      },
      onUpsertSettings: (data) => {
        finalizedSettings = data;
        callOrder.push("finalizeSettings:success");
      },
    }),
    acquireLock: async () => true,
    releaseLock: async () => {
      callOrder.push("releaseLock");
    },
    now: () => new Date("2026-04-22T12:00:00Z"),
    generateTopic: async ({ settings }: { settings: BlogSettings }) => {
      callOrder.push("generateTopic");
      assert.equal(settings.enableTrendAnalysis, true);
      return "2026 local SEO trends for service businesses";
    },
    generatePost: async ({ topic }: { topic: string }) => {
      callOrder.push("generatePost");
      assert.match(topic, /local SEO trends/i);
      return {
        title: "5 Local SEO Trends Service Businesses Should Act On in 2026",
        content: "<p>Strong HTML-ready content.</p>",
        excerpt: "Actionable trend summary for service businesses.",
        metaDescription: "Use these local SEO trends to win more nearby customers in 2026.",
        focusKeyword: "local SEO trends",
        tags: ["SEO", "Local Marketing", "AI Content"],
      };
    },
    generateImage: async () => {
      callOrder.push("generateImage");
      return Buffer.from([255, 216, 255]);
    },
    uploadImage: async ({ bytes, path }: { bytes: Buffer; path: string }) => {
      callOrder.push("uploadImage");
      assert.equal(bytes.length, 3);
      assert.match(path, /^blog-images\/\d+-[0-9a-f-]+\.jpg$/);
      return `https://cdn.example.com/${path}`;
    },
  } as never);

  const result = await BlogGenerator.generate({ manual: false });

  assert.equal(result.skipped, false, "successful runs do not skip");
  const successResult = result as Extract<typeof result, { skipped: false }>;
  assert.equal(result.reason, null, "successful runs return reason null");
  assert.equal(result.jobId, 1, "successful runs return the running job id");
  assert.equal(result.postId, 77, "successful runs return the created post id");
  assert.ok(createdPostInput, "successful runs create a draft post");

  const createdPost = createdPostInput as InsertBlogPost;
  assert.equal(createdPost.status, "draft", "created post is saved as a draft");
  assert.equal(createdPost.authorName, "AI Assistant", "created post is attributed to AI Assistant");
  assert.equal(createdPost.tags, "SEO, Local Marketing, AI Content", "tags are serialized before insertion");
  assert.match(
    createdPost.featureImageUrl ?? "",
    /^https:\/\/cdn\.example\.com\/blog-images\/\d+-[0-9a-f-]+\.jpg$/,
    "successful image uploads populate featureImageUrl",
  );
  assert.match(
    createdPost.slug ?? "",
    /^5-local-seo-trends-service-businesses-should-act-on-in-2026-\d+$/,
    "slug uses title slug plus timestamp",
  );

  assert.ok(completedJobUpdate, "successful runs mark the job completed");
  const completedUpdate = completedJobUpdate as Partial<InsertBlogGenerationJob>;
  assert.equal(completedUpdate.status, "completed", "job status becomes completed after post creation");
  assert.equal(completedUpdate.postId, 77, "job stores the created post id after the post exists");
  assert.equal(completedUpdate.reason, null, "successful runs clear any prior reason");
  assert.equal(completedUpdate.error, null, "successful runs clear any prior error");

  assert.ok(finalizedSettings, "successful runs finalize the singleton settings row");
  const successSettings = finalizedSettings as InsertBlogSettings;
  assert.equal(successSettings.lockAcquiredAt, null, "successful runs clear the lock timestamp");
  assert.ok(successSettings.lastRunAt instanceof Date, "successful runs set lastRunAt");

  assert.deepEqual(
    callOrder,
    [
      "createJob:running",
      "generateTopic",
      "generatePost",
      "generateImage",
      "uploadImage",
      "createPost",
      "updateJob:completed",
      "finalizeSettings:success",
    ],
    "draft post creation happens before the completed job update and settings finalization",
  );

  assert.equal(successResult.post.status, "draft", "result returns the draft post record");
  assert.equal(successResult.post.authorName, "AI Assistant", "result returns the AI author");
  __resetBlogGeneratorTestDeps();
}

async function expectImageFailureFallback() {
  process.env.BLOG_GEMINI_API_KEY = "test-key";

  let createdPostInput: InsertBlogPost | null = null;

  __setBlogGeneratorTestDeps({
    storage: createStorageStub(createSettings(), {
      onCreatePost: (data) => {
        createdPostInput = data;
      },
    }),
    acquireLock: async () => true,
    releaseLock: async () => {},
    now: () => new Date("2026-04-22T12:00:00Z"),
    generateTopic: async () => "Image fallback topic",
    generatePost: async () => ({
      title: "Image Fallback Topic",
      content: "<p>Fallback content.</p>",
      excerpt: "Fallback excerpt",
      metaDescription: "Fallback meta",
      focusKeyword: "fallback keyword",
      tags: ["Fallback"],
    }),
    generateImage: async () => {
      throw new Error("image generation exploded");
    },
    uploadImage: async () => {
      throw new Error("upload should not run after image failure");
    },
  } as never);

  const result = await BlogGenerator.generate({ manual: false });
  assert.equal(result.skipped, false, "image failures remain non-blocking");
  const successResult = result as Extract<typeof result, { skipped: false }>;
  assert.ok(createdPostInput, "draft post still gets created when image generation fails");
  const createdPost = createdPostInput as InsertBlogPost;
  assert.equal(createdPost.featureImageUrl, null, "image failure stores featureImageUrl as null");
  assert.equal(successResult.post.featureImageUrl, null, "result post exposes the null image url");
  __resetBlogGeneratorTestDeps();
}

async function expectFailureCleanup() {
  process.env.BLOG_GEMINI_API_KEY = "test-key";

  const previousRunAt = new Date("2026-04-20T09:30:00Z");
  let createdJobCount = 0;
  let failedUpdate: Partial<InsertBlogGenerationJob> | null = null;
  let finalizedSettings: InsertBlogSettings | null = null;

  __setBlogGeneratorTestDeps({
    storage: createStorageStub(createSettings({ lastRunAt: previousRunAt }), {
      onCreateJob: () => {
        createdJobCount += 1;
      },
      onUpdateJob: (_id, data) => {
        failedUpdate = data;
      },
      onUpsertSettings: (data) => {
        finalizedSettings = data;
      },
    }),
    acquireLock: async () => true,
    releaseLock: async () => {
      throw new Error("releaseLock should be replaced by settings finalization");
    },
    now: () => new Date("2026-04-22T12:00:00Z"),
    generateTopic: async () => {
      throw new Error("topic generation exploded");
    },
  } as never);

  await assert.rejects(
    () => BlogGenerator.generate({ manual: false }),
    /topic generation exploded/,
  );

  assert.equal(createdJobCount, 1, "a running job exists before pipeline failures are recorded");
  assert.ok(failedUpdate, "failed runs update the job record");
  const failureUpdate = failedUpdate as Partial<InsertBlogGenerationJob>;
  assert.equal(failureUpdate.status, "failed", "failed runs mark the job as failed");
  assert.ok(failureUpdate.completedAt instanceof Date, "failed runs stamp completedAt");
  assert.equal(failureUpdate.error, "topic generation exploded", "failed runs persist the error message");
  assert.equal(failureUpdate.postId, undefined, "failed runs do not assign a post id");

  assert.ok(finalizedSettings, "failed runs still finalize singleton settings");
  const failureSettings = finalizedSettings as InsertBlogSettings;
  assert.equal(failureSettings.lockAcquiredAt, null, "failed runs clear the lock timestamp");
  assert.equal(failureSettings.lastRunAt, previousRunAt, "failed runs preserve the previous lastRunAt");
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
  await expectSuccessfulGeneration();
  await expectImageFailureFallback();
  await expectFailureCleanup();

  console.log("PASS: BlogGenerator success, fallback, and finalization behavior matches the phase contract");
}

main().catch((error) => {
  console.error("FAIL: BlogGenerator contract regression");
  console.error(error);
  process.exit(1);
});
