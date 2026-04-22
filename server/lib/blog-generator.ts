import { randomUUID } from "crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type { BlogPost, InsertBlogPost } from "#shared/schema.js";
import type {
  BlogGenerationJob,
  BlogSettings,
  InsertBlogGenerationJob,
  InsertBlogSettings,
} from "#shared/schema.js";
import { blogSettings } from "#shared/schema.js";

import type { IStorage } from "../storage.js";
import { getSupabaseAdmin } from "./supabase.js";
import {
  BLOG_CONTENT_MODEL,
  BLOG_IMAGE_MODEL,
  getBlogGeminiClient,
  resolveBlogGeminiApiKey,
} from "./blog-gemini.js";

const STALE_LOCK_MS = 10 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const generatedPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  focusKeyword: z.string().nullable().optional(),
  tags: z.union([z.array(z.string().min(1)), z.string().min(1)]),
});

type SkipReason = "no_settings" | "disabled" | "posts_per_day_zero" | "too_soon" | "locked";

type BlogGeneratorResult =
  | { skipped: true; reason: SkipReason }
  | { skipped: false; reason: null; jobId: number; postId: number; post: BlogPost };

type BlogGeneratorStorage = Pick<
  IStorage,
  | "getBlogSettings"
  | "upsertBlogSettings"
  | "createBlogGenerationJob"
  | "updateBlogGenerationJob"
  | "createBlogPost"
>;

const defaultStorage: BlogGeneratorStorage = {
  async getBlogSettings() {
    return (await getStorage()).getBlogSettings();
  },
  async upsertBlogSettings(data) {
    return (await getStorage()).upsertBlogSettings(data);
  },
  async createBlogGenerationJob(data) {
    return (await getStorage()).createBlogGenerationJob(data);
  },
  async updateBlogGenerationJob(id, data) {
    return (await getStorage()).updateBlogGenerationJob(id, data);
  },
  async createBlogPost(data) {
    return (await getStorage()).createBlogPost(data);
  },
};

type PipelineSuccess = { jobId: number; postId: number; post: BlogPost };

type GeneratedPost = {
  title: string;
  content: string;
  excerpt: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  tags: string[];
};

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
  generateTopic: (context: {
    settings: BlogSettings;
    manual: boolean;
  }) => Promise<string>;
  generatePost: (context: {
    settings: BlogSettings;
    topic: string;
    manual: boolean;
  }) => Promise<GeneratedPost>;
  generateImage: (context: {
    settings: BlogSettings;
    post: GeneratedPost;
    manual: boolean;
  }) => Promise<Buffer | null>;
  uploadImage: (context: { bytes: Buffer; path: string }) => Promise<string>;
};

const defaultDeps: BlogGeneratorDeps = {
  storage: defaultStorage,
  now: () => new Date(),
  acquireLock: acquireDatabaseLock,
  releaseLock: releaseDatabaseLock,
  runPipeline,
  generateTopic: generateTopicWithGemini,
  generatePost: generatePostWithGemini,
  generateImage: generateImageWithGemini,
  uploadImage: uploadFeatureImage,
};

let testDeps: Partial<BlogGeneratorDeps> | null = null;

function getDeps(): BlogGeneratorDeps {
  return {
    ...defaultDeps,
    ...testDeps,
    storage: testDeps?.storage ?? defaultDeps.storage,
  };
}

async function getDb() {
  const module = await import("../db.js");
  return module.db;
}

async function getStorage(): Promise<BlogGeneratorStorage> {
  const module = await import("../storage.js");
  return module.storage as BlogGeneratorStorage;
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
  const db = await getDb();
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
  const db = await getDb();
  await db
    .update(blogSettings)
    .set({
      lockAcquiredAt: null,
      updatedAt: new Date(),
    })
    .where(eq(blogSettings.id, settings.id));
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "blog-post"
  );
}

function buildSlug(title: string, now: Date): string {
  const baseSlug = slugifyTitle(title);
  return `${baseSlug}-${now.getTime()}`;
}

function buildSettingsUpdate(settings: BlogSettings, updates: Partial<InsertBlogSettings>): InsertBlogSettings {
  return {
    enabled: settings.enabled,
    postsPerDay: settings.postsPerDay,
    seoKeywords: settings.seoKeywords,
    enableTrendAnalysis: settings.enableTrendAnalysis,
    promptStyle: settings.promptStyle,
    lastRunAt: settings.lastRunAt,
    lockAcquiredAt: settings.lockAcquiredAt,
    ...updates,
  };
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw.trim();
}

function parseGeneratedPostResponse(raw: string): GeneratedPost {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJsonPayload(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini blog generation returned invalid JSON: ${message}`);
  }

  const result = generatedPostSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini blog generation returned incomplete content: ${result.error.issues[0]?.message ?? "unknown validation error"}`);
  }

  const tags = Array.isArray(result.data.tags)
    ? result.data.tags.map((tag) => tag.trim()).filter(Boolean)
    : result.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);

  if (tags.length === 0) {
    throw new Error("Gemini blog generation returned incomplete content: tags are required");
  }

  return {
    title: result.data.title.trim(),
    content: result.data.content.trim(),
    excerpt: result.data.excerpt?.trim() || null,
    metaDescription: result.data.metaDescription?.trim() || null,
    focusKeyword: result.data.focusKeyword?.trim() || null,
    tags,
  };
}

async function generateTopicWithGemini({ settings, manual }: { settings: BlogSettings; manual: boolean }): Promise<string> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = [
    "You are an SEO strategist for Skale Club.",
    `Create exactly one timely blog topic idea for these keywords: ${settings.seoKeywords}.`,
    `Prompt style: ${settings.promptStyle || "clear and practical"}.`,
    `Trend analysis enabled: ${settings.enableTrendAnalysis ? "yes" : "no"}.`,
    `Run type: ${manual ? "manual" : "scheduled"}.`,
    "Return only the topic title as plain text.",
  ].join("\n");

  const response = await getGeminiText(client, BLOG_CONTENT_MODEL, prompt);
  const topic = response.trim();

  if (!topic) {
    throw new Error("Gemini did not return a blog topic");
  }

  return topic;
}

async function generatePostWithGemini({ settings, topic, manual }: { settings: BlogSettings; topic: string; manual: boolean }): Promise<GeneratedPost> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = [
    "You are an SEO content writer for Skale Club.",
    `Write an HTML-ready blog draft about: ${topic}`,
    `Primary SEO keywords: ${settings.seoKeywords}.`,
    `Prompt style: ${settings.promptStyle || "clear and practical"}.`,
    `Trend analysis enabled: ${settings.enableTrendAnalysis ? "yes" : "no"}.`,
    `Run type: ${manual ? "manual" : "scheduled"}.`,
    "Return valid JSON only with these exact fields:",
    '{"title":"","content":"","excerpt":"","metaDescription":"","focusKeyword":"","tags":[""]}',
    "The content field must be HTML-ready body content.",
  ].join("\n");

  const response = await getGeminiText(client, BLOG_CONTENT_MODEL, prompt);
  return parseGeneratedPostResponse(response);
}

async function generateImageWithGemini({ post }: { settings: BlogSettings; post: GeneratedPost; manual: boolean }): Promise<Buffer | null> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = [
    "Create a cinematic blog feature image.",
    `Title: ${post.title}`,
    `Excerpt: ${post.excerpt ?? post.metaDescription ?? ""}`,
    `Focus keyword: ${post.focusKeyword ?? ""}`,
    "Return a single high-quality JPEG-style image response.",
  ].join("\n");

  const response = await (client.models as any).generateContent({
    model: BLOG_IMAGE_MODEL,
    contents: prompt,
  });

  const parts = response?.candidates?.flatMap((candidate: any) => candidate?.content?.parts ?? []) ?? [];

  for (const part of parts) {
    const inlineData = part?.inlineData;
    if (inlineData?.data) {
      return Buffer.from(inlineData.data, "base64");
    }
  }

  return null;
}

async function uploadFeatureImage({ bytes, path }: { bytes: Buffer; path: string }): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from("images").upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload blog image: ${error.message}`);
  }

  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

async function getGeminiText(client: ReturnType<typeof getBlogGeminiClient>, model: string, prompt: string): Promise<string> {
  const response = await (client.models as any).generateContent({
    model,
    contents: prompt,
  });

  const text = response?.text;
  if (typeof text === "string" && text.trim()) {
    return text;
  }

  const fallback = response?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text)
    .filter((value: unknown): value is string => typeof value === "string")
    .join("\n")
    .trim();

  if (!fallback) {
    throw new Error(`Gemini ${model} returned no text output`);
  }

  return fallback;
}

async function runPipeline({ settings, job, manual }: { settings: BlogSettings; job: BlogGenerationJob; manual: boolean }): Promise<PipelineSuccess> {
  const deps = getDeps();
  const now = deps.now();

  const topic = await deps.generateTopic({ settings, manual });
  const generatedPost = await deps.generatePost({ settings, topic, manual });

  let featureImageUrl: string | null = null;

  try {
    const imageBytes = await deps.generateImage({ settings, post: generatedPost, manual });
    if (imageBytes?.length) {
      const path = `blog-images/${now.getTime()}-${randomUUID()}.jpg`;
      featureImageUrl = await deps.uploadImage({ bytes: imageBytes, path });
    } else {
      console.warn("Blog generator image generation returned no bytes; continuing without feature image");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Blog generator image pipeline failed; continuing without feature image: ${message}`);
  }

  const postInput: InsertBlogPost = {
    title: generatedPost.title,
    slug: buildSlug(generatedPost.title, now),
    content: generatedPost.content,
    excerpt: generatedPost.excerpt,
    metaDescription: generatedPost.metaDescription,
    focusKeyword: generatedPost.focusKeyword,
    tags: generatedPost.tags.join(", "),
    featureImageUrl,
    status: "draft",
    authorName: "AI Assistant",
  };

  const post = await deps.storage.createBlogPost(postInput);

  await deps.storage.updateBlogGenerationJob(job.id, {
    status: "completed",
    postId: post.id,
    completedAt: now,
    reason: null,
    error: null,
  });

  await deps.storage.upsertBlogSettings(
    buildSettingsUpdate(settings, {
      lastRunAt: now,
      lockAcquiredAt: null,
    }),
  );

  return {
    jobId: job.id,
    postId: post.id,
    post,
  };
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
      await deps.storage.upsertBlogSettings(
        buildSettingsUpdate(settings, {
          lastRunAt: settings.lastRunAt,
          lockAcquiredAt: null,
        }),
      );

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
