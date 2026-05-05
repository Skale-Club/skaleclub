import { randomUUID } from "crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type { BlogPost, BlogRssItem, InsertBlogPost } from "#shared/schema.js";
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
  BLOG_GEMINI_TIMEOUT_MS,
  getBlogGeminiClient,
  resolveBlogGeminiApiKey,
} from "./blog-gemini.js";
import { selectNextRssItem } from "./rssTopicSelector.js";
import {
  GeminiEmptyResponseError,
  GeminiTimeoutError,
  getPlainTextLength,
  sanitizeBlogHtml,
  slugifyTitle as slugifyTitleNFD,
} from "./blogContentValidator.js";

const STALE_LOCK_MS = 10 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Phase 36 D-11/D-12/D-05: pt-BR prompt blocks (verbatim) + length bounds
const BRAND_VOICE_PT_BR = "Você é um redator da Skale Club, uma agência brasileira de marketing B2B.\nEscreva em português brasileiro (pt-BR). Público-alvo: donos de negócios B2B.\nTom: profissional, orientado a dados, acionável. Sem floreios.";
const FORMATTING_RULES_PT_BR = "REGRAS DE FORMATAÇÃO (obrigatórias):\n- Devolva APENAS HTML do corpo do post — sem <html>, <head>, <body>, sem ``` blocos.\n- Use SOMENTE estas tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>.\n- PROIBIDO: <script>, <iframe>, <form>, <style>, <link>, <img>, <video>, <table>, <h1>, <br>.\n- Links: <a href=\"...\"> apenas. Sem rel/target — o sistema adiciona.\n- Comprimento: entre 600 e 4000 caracteres de texto puro (sem contar tags).";
const MIN_PLAIN_TEXT_CHARS = 600;
const MAX_PLAIN_TEXT_CHARS = 4000;

const generatedPostSchema = z.object({ title: z.string().min(1), content: z.string().min(1), excerpt: z.string().nullable().optional(), metaDescription: z.string().nullable().optional(), focusKeyword: z.string().nullable().optional(), tags: z.union([z.array(z.string().min(1)), z.string().min(1)]) });

type SkipReason = "no_settings" | "disabled" | "posts_per_day_zero" | "too_soon" | "locked" | "no_rss_items";

type BlogGeneratorResult =
  | { skipped: true; reason: SkipReason }
  | { skipped: false; reason: null; jobId: number; postId: number; post: BlogPost };

type BlogGeneratorStorage = Pick<IStorage, "getBlogSettings" | "upsertBlogSettings" | "createBlogGenerationJob" | "updateBlogGenerationJob" | "createBlogPost" | "listPendingRssItems" | "markRssItemUsed">;

const defaultStorage: BlogGeneratorStorage = {
  getBlogSettings: async () => (await getStorage()).getBlogSettings(),
  upsertBlogSettings: async (data) => (await getStorage()).upsertBlogSettings(data),
  createBlogGenerationJob: async (data) => (await getStorage()).createBlogGenerationJob(data),
  updateBlogGenerationJob: async (id, data) => (await getStorage()).updateBlogGenerationJob(id, data),
  createBlogPost: async (data) => (await getStorage()).createBlogPost(data),
  listPendingRssItems: async (limit) => (await getStorage()).listPendingRssItems(limit),
  markRssItemUsed: async (itemId, postId) => (await getStorage()).markRssItemUsed(itemId, postId),
};

type PipelineSuccess = { jobId: number; postId: number; post: BlogPost };
type GeneratedPost = { title: string; content: string; excerpt: string | null; metaDescription: string | null; focusKeyword: string | null; tags: string[] };

type BlogGeneratorDeps = {
  storage: BlogGeneratorStorage;
  now: () => Date;
  acquireLock: (settings: BlogSettings, now: Date) => Promise<boolean>;
  releaseLock: (settings: BlogSettings) => Promise<void>;
  runPipeline: (ctx: { settings: BlogSettings; job: BlogGenerationJob; manual: boolean; rssItem: BlogRssItem }) => Promise<PipelineSuccess>;
  generateTopic: (ctx: { settings: BlogSettings; manual: boolean; rssItem: BlogRssItem }) => Promise<string>;
  generatePost: (ctx: { settings: BlogSettings; topic: string; manual: boolean; rssItem: BlogRssItem }) => Promise<GeneratedPost>;
  generateImage: (ctx: { settings: BlogSettings; post: GeneratedPost; manual: boolean }) => Promise<Buffer | null>;
  uploadImage: (ctx: { bytes: Buffer; path: string }) => Promise<string>;
};

const defaultDeps: BlogGeneratorDeps = { storage: defaultStorage, now: () => new Date(), acquireLock: acquireDatabaseLock, releaseLock: releaseDatabaseLock, runPipeline, generateTopic: generateTopicWithGemini, generatePost: generatePostWithGemini, generateImage: generateImageWithGemini, uploadImage: uploadFeatureImage };

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
  if (!settings.lastRunAt || settings.postsPerDay <= 0) return false;
  return now.getTime() - settings.lastRunAt.getTime() < getCadenceWindowMs(settings.postsPerDay);
}

async function acquireDatabaseLock(settings: BlogSettings, now: Date): Promise<boolean> {
  const db = await getDb();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const [lockedSettings] = await db
    .update(blogSettings)
    .set({ lockAcquiredAt: now, updatedAt: now })
    .where(and(eq(blogSettings.id, settings.id), or(isNull(blogSettings.lockAcquiredAt), lt(blogSettings.lockAcquiredAt, staleBefore))))
    .returning({ id: blogSettings.id });
  return Boolean(lockedSettings);
}

async function releaseDatabaseLock(settings: BlogSettings): Promise<void> {
  const db = await getDb();
  await db.update(blogSettings).set({ lockAcquiredAt: null, updatedAt: new Date() }).where(eq(blogSettings.id, settings.id));
}

function buildSlug(title: string, now: Date): string {
  return `${slugifyTitleNFD(title) || "blog-post"}-${now.getTime()}`;
}

function buildSettingsUpdate(settings: BlogSettings, updates: Partial<InsertBlogSettings>): InsertBlogSettings {
  return { enabled: settings.enabled, postsPerDay: settings.postsPerDay, seoKeywords: settings.seoKeywords, enableTrendAnalysis: settings.enableTrendAnalysis, promptStyle: settings.promptStyle, lastRunAt: settings.lastRunAt, lockAcquiredAt: settings.lockAcquiredAt, ...updates };
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

// Phase 36 D-07: race Gemini against BLOG_GEMINI_TIMEOUT_MS via Promise.race
// (@google/genai 1.50.x has no native AbortSignal support). Controller is
// forward-compat — calling .abort() is a no-op today.
async function withGeminiTimeout<T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GeminiTimeoutError(`Gemini ${label} exceeded ${BLOG_GEMINI_TIMEOUT_MS}ms`));
    }, BLOG_GEMINI_TIMEOUT_MS);
  });
  try {
    return await Promise.race([run(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

async function generateTopicWithGemini({
  settings,
  manual,
  rssItem,
}: {
  settings: BlogSettings;
  manual: boolean;
  rssItem: BlogRssItem;
}): Promise<string> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = `${BRAND_VOICE_PT_BR}\n\nTarefa: refine o item de RSS abaixo em UMA ideia de pauta de blog em pt-BR alinhada às palavras-chave de SEO.\n\nItem de RSS de origem:\n- Título: ${rssItem.title}\n- Resumo: ${rssItem.summary ?? "(sem resumo)"}\n\nPalavras-chave de SEO: ${settings.seoKeywords}.\nEstilo de prompt: ${settings.promptStyle || "claro e prático"}.\nAnálise de tendências habilitada: ${settings.enableTrendAnalysis ? "sim" : "não"}.\nTipo de execução: ${manual ? "manual" : "agendada"}.\n\nDevolva APENAS o título da pauta como texto puro em pt-BR. Sem aspas, sem pontuação final, sem comentários.`;
  const response = await withGeminiTimeout("topic", () => getGeminiText(client, BLOG_CONTENT_MODEL, prompt));
  const topic = response.trim();
  if (!topic) throw new Error("Gemini did not return a blog topic");
  return topic;
}

async function generatePostWithGemini({
  settings,
  topic,
  manual,
  rssItem,
}: {
  settings: BlogSettings;
  topic: string;
  manual: boolean;
  rssItem: BlogRssItem;
}): Promise<GeneratedPost> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = `${BRAND_VOICE_PT_BR}\n\nTarefa: escreva um rascunho de post de blog em pt-BR a partir da pauta abaixo.\n\nItem de RSS de origem:\n- Título: ${rssItem.title}\n- Resumo: ${rssItem.summary ?? "(sem resumo)"}\n- URL: ${rssItem.url}\n\nPauta: ${topic}\nPalavras-chave de SEO primárias: ${settings.seoKeywords}.\nEstilo de prompt: ${settings.promptStyle || "claro e prático"}.\nAnálise de tendências habilitada: ${settings.enableTrendAnalysis ? "sim" : "não"}.\nTipo de execução: ${manual ? "manual" : "agendada"}.\n\nDevolva JSON válido com EXATAMENTE estes campos (todos em pt-BR):\n{"title":"","content":"","excerpt":"","metaDescription":"","focusKeyword":"","tags":[""]}\nO campo "content" deve ser HTML pronto para publicação seguindo as regras abaixo.\n\n${FORMATTING_RULES_PT_BR}`;
  const response = await withGeminiTimeout("post", () => getGeminiText(client, BLOG_CONTENT_MODEL, prompt));
  return parseGeneratedPostResponse(response);
}

async function generateImageWithGemini({ post }: { settings: BlogSettings; post: GeneratedPost; manual: boolean }): Promise<Buffer | null> {
  resolveBlogGeminiApiKey();
  const client = getBlogGeminiClient();
  const prompt = [
    "Crie uma imagem de capa cinematográfica para um post de blog brasileiro.",
    `Título: ${post.title}`,
    `Resumo: ${post.excerpt ?? post.metaDescription ?? ""}`,
    `Palavra-chave foco: ${post.focusKeyword ?? ""}`,
    "Devolva uma única imagem JPEG de alta qualidade.",
  ].join("\n");

  const response = await withGeminiTimeout<any>("image", () =>
    (client.models as any).generateContent({
      model: BLOG_IMAGE_MODEL,
      contents: prompt,
    }),
  );

  if (!response?.candidates || response.candidates.length === 0) {
    throw new GeminiEmptyResponseError(`Gemini ${BLOG_IMAGE_MODEL} returned empty candidates`);
  }

  const parts = response.candidates.flatMap((candidate: any) => candidate?.content?.parts ?? []);

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

  // D-08: distinct typed error when Gemini returns no candidates (content
  // filter, model outage). Mapped to reason 'gemini_empty_response' upstream.
  if (!response?.candidates || response.candidates.length === 0) {
    throw new GeminiEmptyResponseError(`Gemini ${model} returned empty candidates`);
  }

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

async function runPipeline({
  settings,
  job,
  manual,
  rssItem,
}: {
  settings: BlogSettings;
  job: BlogGenerationJob;
  manual: boolean;
  rssItem: BlogRssItem;
}): Promise<PipelineSuccess> {
  const deps = getDeps();
  const now = deps.now();

  const topic = await deps.generateTopic({ settings, manual, rssItem });
  const generatedPost = await deps.generatePost({ settings, topic, manual, rssItem });

  // Phase 36 BLOG2-02/BLOG2-04 (D-05/D-06): sanitize, then length-validate
  const sanitizedContent = sanitizeBlogHtml(generatedPost.content);
  const plainTextLen = getPlainTextLength(sanitizedContent);
  if (plainTextLen < MIN_PLAIN_TEXT_CHARS) {
    const originalPlainTextLen = getPlainTextLength(generatedPost.content);
    throw new Error(
      originalPlainTextLen >= MIN_PLAIN_TEXT_CHARS ? "invalid_html" : "content_length_out_of_bounds",
    );
  }
  if (plainTextLen > MAX_PLAIN_TEXT_CHARS) {
    throw new Error("content_length_out_of_bounds");
  }
  generatedPost.content = sanitizedContent;

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

  // RSS-07: mark item used AFTER post insert succeeds (non-fatal on failure)
  try {
    await deps.storage.markRssItemUsed(rssItem.id, post.id);
  } catch (markErr) {
    const message = markErr instanceof Error ? markErr.message : String(markErr);
    console.warn(`[blog-generator] markRssItemUsed failed for item ${rssItem.id}: ${message}`);
  }

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

// Phase 37 D-07: preview-without-commit. Reuses generateTopic + generatePost
// + sanitize + length validate + (best-effort) image from the same dep table
// runPipeline uses, but RETURNS the content instead of persisting it. No lock,
// no blog_generation_jobs row.
export interface PreviewResult {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  tags: string[];
  featureImageUrl: string | null;
  rssItem: BlogRssItem;
}

export type RunPreviewResponse =
  | { skipped: true; reason: SkipReason | "invalid_html" | "content_length_out_of_bounds" | "gemini_timeout" | "gemini_empty_response" }
  | { skipped: false; result: PreviewResult };

export async function runPreview(options?: { rssItemId?: number }): Promise<RunPreviewResponse> {
  const deps = getDeps();
  const settings = await deps.storage.getBlogSettings();
  if (!settings) return { skipped: true, reason: "no_settings" };

  let rssItem: BlogRssItem | null;
  if (typeof options?.rssItemId === "number") {
    const all = await deps.storage.listPendingRssItems();
    rssItem = all.find((i) => i.id === options.rssItemId) ?? null;
  } else {
    rssItem = await selectNextRssItem(settings, deps.now());
  }
  if (!rssItem) return { skipped: true, reason: "no_rss_items" };

  try {
    const topic = await deps.generateTopic({ settings, manual: true, rssItem });
    const generatedPost = await deps.generatePost({ settings, topic, manual: true, rssItem });
    const sanitizedContent = sanitizeBlogHtml(generatedPost.content);
    const plainTextLen = getPlainTextLength(sanitizedContent);
    if (plainTextLen < MIN_PLAIN_TEXT_CHARS) {
      const originalLen = getPlainTextLength(generatedPost.content);
      return { skipped: true, reason: originalLen >= MIN_PLAIN_TEXT_CHARS ? "invalid_html" : "content_length_out_of_bounds" };
    }
    if (plainTextLen > MAX_PLAIN_TEXT_CHARS) return { skipped: true, reason: "content_length_out_of_bounds" };

    let featureImageUrl: string | null = null;
    try {
      const imageBytes = await deps.generateImage({ settings, post: generatedPost, manual: true });
      if (imageBytes?.length) {
        const path = `blog-images/${deps.now().getTime()}-${randomUUID()}.jpg`;
        featureImageUrl = await deps.uploadImage({ bytes: imageBytes, path });
      }
    } catch (imgErr) {
      const m = imgErr instanceof Error ? imgErr.message : String(imgErr);
      console.warn(`[blog-preview] image step failed (non-fatal): ${m}`);
    }

    return {
      skipped: false,
      result: {
        title: generatedPost.title,
        slug: slugifyTitleNFD(generatedPost.title) || "blog-post",
        content: sanitizedContent,
        excerpt: generatedPost.excerpt,
        metaDescription: generatedPost.metaDescription,
        focusKeyword: generatedPost.focusKeyword,
        tags: generatedPost.tags,
        featureImageUrl,
        rssItem,
      },
    };
  } catch (err) {
    if (err instanceof GeminiTimeoutError) return { skipped: true, reason: "gemini_timeout" };
    if (err instanceof GeminiEmptyResponseError) return { skipped: true, reason: "gemini_empty_response" };
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_html") return { skipped: true, reason: "invalid_html" };
    if (msg === "content_length_out_of_bounds") return { skipped: true, reason: "content_length_out_of_bounds" };
    throw err;
  }
}

export class BlogGenerator {
  static async generate({ manual, rssItemId }: { manual: boolean; rssItemId?: number }): Promise<BlogGeneratorResult> {
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

    // D-09/D-10: pick RSS item BEFORE lock + Gemini; empty queue → skip + return
    // Phase 37 D-09: retry path passes rssItemId to bypass the selector.
    let rssItem: BlogRssItem | null;
    if (typeof rssItemId === "number") {
      const candidates = await deps.storage.listPendingRssItems();
      rssItem = candidates.find((i) => i.id === rssItemId) ?? null;
    } else {
      rssItem = await selectNextRssItem(settings, now);
    }
    if (!rssItem) {
      await deps.storage.createBlogGenerationJob({
        status: "skipped",
        reason: "no_rss_items",
        startedAt: now,
        completedAt: now,
      });
      return { skipped: true, reason: "no_rss_items" };
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
      const result = await deps.runPipeline({ settings, job, manual, rssItem });

      return {
        skipped: false,
        reason: null,
        jobId: result.jobId,
        postId: result.postId,
        post: result.post,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // D-13: map Phase-36 typed/value errors to the reason taxonomy.
      let reason: string | null = null;
      if (error instanceof GeminiTimeoutError) {
        reason = "gemini_timeout";
      } else if (error instanceof GeminiEmptyResponseError) {
        reason = "gemini_empty_response";
      } else if (message === "invalid_html" || message === "content_length_out_of_bounds") {
        reason = message;
      }

      await deps.storage.updateBlogGenerationJob(job.id, {
        status: "failed",
        reason,
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
