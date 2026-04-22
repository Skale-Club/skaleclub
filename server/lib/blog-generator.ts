import { and, eq, isNull, lt, or } from "drizzle-orm";

import type { BlogPost } from "#shared/schema.js";
import type {
  BlogGenerationJob,
  BlogSettings,
  InsertBlogGenerationJob,
} from "#shared/schema.js";
import { blogSettings } from "#shared/schema.js";

import { db } from "../db.js";
import { getBlogGeminiClient, resolveBlogGeminiApiKey } from "./blog-gemini.js";
import { storage } from "../storage.js";

const STALE_LOCK_MS = 10 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type SkipReason = "no_settings" | "disabled" | "posts_per_day_zero" | "too_soon" | "locked";

type BlogGeneratorResult =
  | { skipped: true; reason: SkipReason }
  | { skipped: false; reason: null; jobId: number; postId: number; post: BlogPost };

type BlogGeneratorStorage = Pick<
  typeof storage,
  "getBlogSettings" | "createBlogGenerationJob" | "updateBlogGenerationJob"
>;

type PipelineSuccess = { jobId: number; postId: number; post: BlogPost };

type BlogGeneratorDeps = {
  storage: BlogGeneratorStorage;
  now: () => Date;
  acquireLock: (settings: BlogSettings, now: Date) => Promise<boolean>;
  releaseLock: (settings: BlogSettings) => Promise<void>;
  runPipeline: (context: {
    settings: BlogSettings;
    job: BlogGenerationJob;
    manual: boolean;
  }) => Promise<PipelineSuccess>;
};

const defaultDeps: BlogGeneratorDeps = {
  storage,
  now: () => new Date(),
  acquireLock: acquireDatabaseLock,
  releaseLock: releaseDatabaseLock,
  runPipeline: runPipeline,
};

let testDeps: Partial<BlogGeneratorDeps> | null = null;

function getDeps(): BlogGeneratorDeps {
  return {
    ...defaultDeps,
    ...testDeps,
    storage: testDeps?.storage ?? defaultDeps.storage,
  };
}

function getCadenceWindowMs(postsPerDay: number): number {
  return DAY_IN_MS / postsPerDay;
}

function shouldSkipTooSoon(settings: BlogSettings, now: Date): boolean {
  if (!settings.lastRunAt || settings.postsPerDay <= 0) {
    return false;
  }

  const elapsedMs = now.getTime() - settings.lastRunAt.getTime();
  return elapsedMs < getCadenceWindowMs(settings.postsPerDay);
}

async function acquireDatabaseLock(settings: BlogSettings, now: Date): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const [lockedSettings] = await db
    .update(blogSettings)
    .set({
      lockAcquiredAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(blogSettings.id, settings.id),
        or(isNull(blogSettings.lockAcquiredAt), lt(blogSettings.lockAcquiredAt, staleBefore)),
      ),
    )
    .returning({ id: blogSettings.id });

  return Boolean(lockedSettings);
}

async function releaseDatabaseLock(settings: BlogSettings): Promise<void> {
  await db
    .update(blogSettings)
    .set({
      lockAcquiredAt: null,
      updatedAt: new Date(),
    })
    .where(eq(blogSettings.id, settings.id));
}

async function runPipeline({ job }: { settings: BlogSettings; job: BlogGenerationJob; manual: boolean }): Promise<PipelineSuccess> {
  resolveBlogGeminiApiKey();
  getBlogGeminiClient();

  throw new Error(
    `Blog generation pipeline is not implemented yet for job ${job.id}; Phase 22 Plan 02 will replace this placeholder`,
  );
}

export class BlogGenerator {
  static async generate({ manual }: { manual: boolean }): Promise<BlogGeneratorResult> {
    const deps = getDeps();
    const now = deps.now();
    const settings = await deps.storage.getBlogSettings();

    if (!settings) {
      return { skipped: true, reason: "no_settings" };
    }

    if (!manual && !settings.enabled) {
      return { skipped: true, reason: "disabled" };
    }

    if (!manual && settings.postsPerDay <= 0) {
      return { skipped: true, reason: "posts_per_day_zero" };
    }

    if (!manual && shouldSkipTooSoon(settings, now)) {
      return { skipped: true, reason: "too_soon" };
    }

    const lockAcquired = await deps.acquireLock(settings, now);
    if (!lockAcquired) {
      return { skipped: true, reason: "locked" };
    }

    const job = await deps.storage.createBlogGenerationJob({
      status: "running",
      startedAt: now,
    });

    try {
      const result = await deps.runPipeline({ settings, job, manual });
      await deps.releaseLock(settings);

      return {
        skipped: false,
        reason: null,
        jobId: result.jobId,
        postId: result.postId,
        post: result.post,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await deps.storage.updateBlogGenerationJob(job.id, {
        status: "failed",
        error: message,
        completedAt: deps.now(),
      });
      await deps.releaseLock(settings);

      throw error;
    }
  }
}

export function __setBlogGeneratorTestDeps(overrides: Partial<BlogGeneratorDeps>) {
  testDeps = overrides;
}

export function __resetBlogGeneratorTestDeps() {
  testDeps = null;
}

export type { BlogGeneratorResult };
