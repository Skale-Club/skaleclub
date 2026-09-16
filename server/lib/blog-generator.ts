import { randomUUID } from "crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type { BlogPost, BlogPostFeedback, BlogRssItem, InsertBlogPost, BlogGenerationJob, BlogSettings, DurationsMs, InsertBlogGenerationJob, InsertBlogSettings } from "#shared/schema.js";
import { blogSettings } from "#shared/schema.js";
import type { IStorage } from "../storage.js";
import { getSupabaseAdmin } from "./supabase.js";
import { generateOpenRouterImage, generateOpenRouterText, resolveBlogAiConfig, type BlogAiConfig } from "./blog-openrouter.js";
import { withAiRetry } from "../blog/ai-retry.js";
import { selectNextRssItem } from "../blog/rss-selector.js";
import {
  assignPillar,
  buildCatalogSection,
  buildInternalLinksSection,
  buildKeywordDedupSection,
  buildPillarSection,
  todaySection,
  sanitizeGeneratedLinks,
  type InternalLink,
  type PillarAssignment,
} from "#shared/blog-prompt.js";
import { isRunDue } from "#shared/blog-schedule.js";
import { AiEmptyResponseError, AiTimeoutError, getPlainTextLength, sanitizeBlogHtml, slugifyTitle as slugifyTitleNFD } from "../blog/content-validator.js";

const STALE_LOCK_MS = 10 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Phase 36 D-11/D-12/D-05: pt-BR prompt blocks (verbatim) + length bounds.
// BRAND_VOICE_PT_BR is the fallback editorial voice — the admin-configured
// blog_settings.systemPrompt takes precedence when set (autopost port).
const BRAND_VOICE_PT_BR = "Você é um redator da Skale Club, uma agência brasileira de marketing B2B.\nEscreva em português brasileiro (pt-BR). Público-alvo: donos de negócios B2B.\nTom: profissional, orientado a dados, acionável. Sem floreios.";
const FORMATTING_RULES_PT_BR = "REGRAS DE FORMATAÇÃO (obrigatórias):\n- Devolva APENAS HTML do corpo do post — sem <html>, <head>, <body>, sem ``` blocos.\n- Use SOMENTE estas tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>.\n- PROIBIDO: <script>, <iframe>, <form>, <style>, <link>, <img>, <video>, <table>, <h1>, <br>.\n- Links: <a href=\"...\"> apenas. Sem rel/target — o sistema adiciona.\n- Comprimento: entre 600 e 4000 caracteres de texto puro (sem contar tags).";
const MIN_PLAIN_TEXT_CHARS = 600;
const MAX_PLAIN_TEXT_CHARS = 4000;

// Autopost port: how many recent approve/reject signals feed the prompts.
const FEEDBACK_PROMPT_LIMIT = 10;

const generatedPostSchema = z.object({ title: z.string().min(1), content: z.string().min(1), excerpt: z.string().nullable().optional(), metaDescription: z.string().nullable().optional(), focusKeyword: z.string().nullable().optional(), tags: z.union([z.array(z.string().min(1)), z.string().min(1)]) });

// "no_rss_items" is gone: RSS stopped being the only topic source (SC-04), so
// an empty queue is no longer a reason to publish nothing.
type SkipReason = "no_settings" | "disabled" | "posts_per_day_zero" | "too_soon" | "locked" | "not_configured";

/**
 * Everything the editorial assignment needs, assembled once per run.
 *
 * Until SC-05 this repo had one prompt shape — "refine this RSS item into a
 * post" — which produced a consistent voice and almost no structural variety.
 * The pillar decides HOW the post is written; the RSS item, when there is one,
 * supplies WHAT it is about.
 */
type EditorialContext = {
  assignment: PillarAssignment;
  /** The full system message: pillar, date, catalogue, links, keyword dedup. */
  systemMessage: string;
  /** The only hrefs the generated body may keep. */
  allowedLinkPaths: string[];
};

type BlogGeneratorResult =
  | { skipped: true; reason: SkipReason }
  | { skipped: false; reason: null; jobId: number; postId: number; post: BlogPost };

type BlogGeneratorStorage = Pick<IStorage, "getBlogSettings" | "upsertBlogSettings" | "createBlogGenerationJob" | "updateBlogGenerationJob" | "createBlogPost" | "listPendingRssItems" | "markRssItemUsed" | "listBlogPostFeedback">;

const defaultStorage: BlogGeneratorStorage = {
  getBlogSettings: async () => (await getStorage()).getBlogSettings(),
  upsertBlogSettings: async (data) => (await getStorage()).upsertBlogSettings(data),
  createBlogGenerationJob: async (data) => (await getStorage()).createBlogGenerationJob(data),
  updateBlogGenerationJob: async (id, data) => (await getStorage()).updateBlogGenerationJob(id, data),
  createBlogPost: async (data) => (await getStorage()).createBlogPost(data),
  listPendingRssItems: async (limit) => (await getStorage()).listPendingRssItems(limit),
  markRssItemUsed: async (itemId, postId) => (await getStorage()).markRssItemUsed(itemId, postId),
  listBlogPostFeedback: async (limit) => (await getStorage()).listBlogPostFeedback(limit),
};

type PipelineSuccess = { jobId: number; postId: number; post: BlogPost };
type GeneratedPost = { title: string; content: string; excerpt: string | null; metaDescription: string | null; focusKeyword: string | null; tags: string[] };
type GeneratedImage = { bytes: Buffer; mime: string };

type PipelineContext = { settings: BlogSettings; job: BlogGenerationJob; manual: boolean; rssItem: BlogRssItem | null; aiConfig: BlogAiConfig; feedback: BlogPostFeedback[]; editorial: EditorialContext };

type BlogGeneratorDeps = {
  storage: BlogGeneratorStorage;
  now: () => Date;
  acquireLock: (settings: BlogSettings, now: Date) => Promise<boolean>;
  releaseLock: (settings: BlogSettings) => Promise<void>;
  resolveAiConfig: (settings: BlogSettings) => Promise<BlogAiConfig | null>;
  selectRssItem: (settings: BlogSettings, now: Date) => Promise<BlogRssItem | null>;
  buildEditorial: (ctx: { settings: BlogSettings; jobSeed: number; rssItem: BlogRssItem | null }) => Promise<EditorialContext>;
  runPipeline: (ctx: PipelineContext) => Promise<PipelineSuccess>;
  generateTopic: (ctx: { settings: BlogSettings; manual: boolean; rssItem: BlogRssItem | null; aiConfig: BlogAiConfig; feedback: BlogPostFeedback[]; editorial: EditorialContext }) => Promise<string>;
  generatePost: (ctx: { settings: BlogSettings; topic: string; manual: boolean; rssItem: BlogRssItem | null; aiConfig: BlogAiConfig; feedback: BlogPostFeedback[]; editorial: EditorialContext }) => Promise<GeneratedPost>;
  generateImage: (ctx: { settings: BlogSettings; post: GeneratedPost; manual: boolean; aiConfig: BlogAiConfig }) => Promise<GeneratedImage | null>;
  uploadImage: (ctx: { bytes: Buffer; mime: string; path: string }) => Promise<string>;
};

const defaultDeps: BlogGeneratorDeps = { storage: defaultStorage, now: () => new Date(), acquireLock: acquireDatabaseLock, releaseLock: releaseDatabaseLock, resolveAiConfig: resolveBlogAiConfig, selectRssItem: selectNextRssItem, buildEditorial: buildEditorialContext, runPipeline, generateTopic: generateTopicWithAi, generatePost: generatePostWithAi, generateImage: generateImageWithAi, uploadImage: uploadFeatureImage };

let testDeps: Partial<BlogGeneratorDeps> | null = null;

function getDeps(): BlogGeneratorDeps {
  return { ...defaultDeps, ...testDeps, storage: testDeps?.storage ?? defaultDeps.storage };
}

async function getDb() {
  const module = await import("../db.js");
  return module.db;
}

/** The full storage, for the editorial reads that are outside the narrow dep table. */
async function getFullStorage(): Promise<IStorage> {
  const module = await import("../storage.js");
  return module.storage;
}

async function getStorage(): Promise<BlogGeneratorStorage> {
  const module = await import("../storage.js");
  return module.storage as BlogGeneratorStorage;
}

function getCadenceWindowMs(postsPerDay: number): number { return DAY_IN_MS / postsPerDay; }

/**
 * Autoblog-parity SC-06: a pinned hour beats the elapsed-time cadence.
 *
 * The old rule only ever said "at least 24/postsPerDay hours since the last
 * run", so the time of day DRIFTED forward with every run — an 18:00 post
 * pushed tomorrow's to 18:00-or-later, a delayed run moved every run after it,
 * and nothing in the product could answer "when is the next post?".
 *
 * With posting_hour set, a run is due when the site's LOCAL clock is in one of
 * the slots, and only once per slot. Leaving it NULL keeps the old behaviour
 * exactly, so nothing changes until someone picks an hour.
 */
function resolveSkipReason(settings: BlogSettings, now: Date): SkipReason | null {
  if (settings.postingHour !== null && settings.postingHour !== undefined) {
    const decision = isRunDue({
      now,
      timeZone: settings.timezone || "UTC",
      postingHour: settings.postingHour,
      postsPerDay: settings.postsPerDay,
      lastRunAt: settings.lastRunAt ?? null,
    });
    // Both of isRunDue's reasons mean the same thing to a caller: not now.
    return decision.due ? null : "too_soon";
  }

  if (!settings.lastRunAt || settings.postsPerDay <= 0) return null;
  return now.getTime() - settings.lastRunAt.getTime() < getCadenceWindowMs(settings.postsPerDay)
    ? "too_soon"
    : null;
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

function buildSlug(title: string, now: Date): string { return `${slugifyTitleNFD(title) || "blog-post"}-${now.getTime()}`; }

// Autopost port: finalization writes ONLY the timing/lock fields. The previous
// full-snapshot write-back could clobber admin edits made while a (30-90s)
// generation run was in flight.
function buildRunFinalization(updates: Pick<InsertBlogSettings, "lastRunAt" | "lockAcquiredAt">): InsertBlogSettings {
  return { ...updates };
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  return raw.trim();
}

function parseGeneratedPostResponse(raw: string): GeneratedPost {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Blog generation returned invalid JSON: ${message}`);
  }
  const result = generatedPostSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Blog generation returned incomplete content: ${result.error.issues[0]?.message ?? "unknown validation error"}`);
  }
  const tags = Array.isArray(result.data.tags)
    ? result.data.tags.map((tag) => tag.trim()).filter(Boolean)
    : result.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length === 0) throw new Error("Blog generation returned incomplete content: tags are required");
  return {
    title: result.data.title.trim(),
    content: result.data.content.trim(),
    excerpt: result.data.excerpt?.trim() || null,
    metaDescription: result.data.metaDescription?.trim() || null,
    focusKeyword: result.data.focusKeyword?.trim() || null,
    tags,
  };
}

// Autopost port: the admin-authored system prompt is the editorial guide for
// every generation; the Phase-36 brand voice remains the fallback.
function resolveEditorialVoice(settings: BlogSettings): string {
  return settings.systemPrompt?.trim() || BRAND_VOICE_PT_BR;
}

// Autopost port: approve/reject signals feed back into the prompts so the
// generator self-improves — approved titles set the direction, rejected
// titles (with the editor's reason) mark angles and mistakes to avoid.
function buildFeedbackBlock(feedback: BlogPostFeedback[]): string {
  if (feedback.length === 0) return "";
  const approved = feedback.filter((f) => f.verdict === "approved").slice(0, 5);
  const rejected = feedback.filter((f) => f.verdict === "rejected").slice(0, 5);
  if (approved.length === 0 && rejected.length === 0) return "";

  const lines: string[] = ["HISTÓRICO EDITORIAL (aprenda com as decisões do editor):"];
  if (approved.length > 0) {
    lines.push("Posts recentes APROVADOS (produza mais conteúdo nessa direção):");
    for (const f of approved) lines.push(`- ${f.postTitle}`);
  }
  if (rejected.length > 0) {
    lines.push("Posts recentes REJEITADOS (evite repetir esses ângulos e erros):");
    for (const f of rejected) {
      lines.push(`- ${f.postTitle}${f.reason?.trim() ? ` — motivo da rejeição: ${f.reason.trim()}` : ""}`);
    }
  }
  return `\n\n${lines.join("\n")}`;
}


/**
 * Assemble this run's editorial assignment and system message.
 *
 * Every read is best-effort: the assignment is what makes the post varied, and
 * losing the catalogue or the FAQ list should narrow the choice of pillars, not
 * cost the day's post. A failed read simply means the pillars that require that
 * data are unavailable this run.
 */
async function buildEditorialContext({ settings, jobSeed, rssItem }: {
  settings: BlogSettings;
  jobSeed: number;
  rssItem: BlogRssItem | null;
}): Promise<EditorialContext> {
  const storage = await getFullStorage();

  let serviceNames: string[] = [];
  let faqQuestions: string[] = [];
  let recentPosts: BlogPost[] = [];
  let recentPillarIds: string[] = [];

  try { serviceNames = (await storage.getPortfolioServices()).map((s) => s.title).filter(Boolean); } catch { /* narrows pillars */ }
  try { faqQuestions = (await storage.getFaqs()).map((f) => f.question).filter(Boolean).slice(0, 10); } catch { /* narrows pillars */ }
  try { recentPosts = (await storage.getBlogPosts()).slice(0, 12); } catch { /* no history yet */ }
  try {
    // Newest-first, matching pickNextPillar's contract.
    recentPillarIds = (await storage.listBlogGenerationJobs(12))
      .map((j) => j.pillarId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch { /* rotation starts fresh */ }

  const assignment = assignPillar(
    recentPillarIds,
    { hasCatalog: serviceNames.length > 0, hasFaqs: faqQuestions.length > 0, hasRssItem: !!rssItem },
    jobSeed,
  );

  // The FAQ pillar works from real customer questions; every other pillar gets
  // no extras and follows its own guidance.
  const pillarExtras = assignment.pillar.id === "faq-deep-dive"
    ? "PERGUNTAS REAIS DE CLIENTES (escolha UMA):\n" + faqQuestions.map((q) => `- ${q}`).join("\n")
    : undefined;

  const internalLinks: InternalLink[] = [
    { label: "Nossos serviços", path: "/servicos" },
    { label: "Fale com a gente", path: "/contato" },
    ...recentPosts
      .filter((p) => p.status === "published" && p.slug)
      .slice(0, 4)
      .map((p) => ({ label: p.title, path: `/blog/${p.slug}` })),
  ];

  const sections: string[] = [
    resolveEditorialVoice(settings),
    todaySection(new Date(), settings.timezone || "UTC"),
    buildPillarSection(assignment, pillarExtras),
  ];

  if (rssItem) {
    sections.push([
      "FONTE. O assunto de hoje vem deste item do feed. Use-o como PONTO DE PARTIDA de um post original para os clientes desta agência — reaja a ele, explique o que muda para eles, acrescente o que a agência sabe. NÃO resuma nem parafraseie a fonte, e não se apresente como autor dela.",
      `- Manchete: ${rssItem.title}`,
      `- Resumo: ${rssItem.summary ?? "(sem resumo)"}`,
      `- Origem: ${rssItem.url}`,
    ].join("\n"));
  }

  const catalog = buildCatalogSection(serviceNames);
  if (catalog) sections.push(catalog);
  sections.push(buildInternalLinksSection(internalLinks));

  const keywordDedup = buildKeywordDedupSection(recentPosts.map((p) => p.focusKeyword || "").filter(Boolean));
  if (keywordDedup) sections.push(keywordDedup);

  if (recentPosts.length > 0) {
    sections.push(
      "POSTS EXISTENTES. NÃO repita nem reformule estes temas:\n" +
      recentPosts.map((p) => `- "${p.title}"`).join("\n"),
    );
  }

  return {
    assignment,
    systemMessage: sections.join("\n\n"),
    allowedLinkPaths: internalLinks.map((l) => l.path),
  };
}

async function generateTopicWithAi({ settings, manual, rssItem, aiConfig, feedback, editorial }: { settings: BlogSettings; manual: boolean; rssItem: BlogRssItem | null; aiConfig: BlogAiConfig; feedback: BlogPostFeedback[]; editorial: EditorialContext }): Promise<string> {
  const prompt = [
    rssItem
      ? "Tarefa: transforme a FONTE do system message em UMA ideia de pauta de blog em pt-BR, no formato que a PAUTA DESTE POST determina. A pauta tem que ser sobre o que a fonte significa para os clientes DESTA agência, não um recontar da fonte."
      : "Tarefa: proponha UMA ideia de pauta de blog em pt-BR que cumpra a PAUTA DESTE POST do system message: seu pilar, seu formato de título, um único assunto.",
    `Palavras-chave de SEO: ${settings.seoKeywords}.`,
    `Estilo de prompt: ${settings.promptStyle || "claro e prático"}.`,
    `Análise de tendências habilitada: ${settings.enableTrendAnalysis ? "sim" : "não"}.`,
    `Tipo de execução: ${manual ? "manual" : "agendada"}.${buildFeedbackBlock(feedback)}`,
    "Devolva APENAS o título da pauta como texto puro em pt-BR. Sem aspas, sem pontuação final, sem comentários.",
  ].join("\n\n");
  const response = await withAiRetry("topic", (signal) => generateOpenRouterText({ config: aiConfig, system: editorial.systemMessage, prompt, signal }));
  const topic = response.trim();
  if (!topic) throw new Error("AI provider did not return a blog topic");
  return topic;
}

async function generatePostWithAi({ settings, topic, manual, rssItem, aiConfig, feedback, editorial }: { settings: BlogSettings; topic: string; manual: boolean; rssItem: BlogRssItem | null; aiConfig: BlogAiConfig; feedback: BlogPostFeedback[]; editorial: EditorialContext }): Promise<GeneratedPost> {
  const prompt = [
    "Tarefa: escreva um rascunho de post de blog em pt-BR a partir da pauta abaixo, cumprindo a PAUTA DESTE POST do system message (pilar, formato do título, tamanho alvo).",
    `Pauta: ${topic}`,
    `Palavras-chave de SEO primárias: ${settings.seoKeywords}.`,
    `Estilo de prompt: ${settings.promptStyle || "claro e prático"}.`,
    `Análise de tendências habilitada: ${settings.enableTrendAnalysis ? "sim" : "não"}.`,
    `Tipo de execução: ${manual ? "manual" : "agendada"}.${buildFeedbackBlock(feedback)}`,
    'Devolva JSON válido com EXATAMENTE estes campos (todos em pt-BR):\n{"title":"","content":"","excerpt":"","metaDescription":"","focusKeyword":"","tags":[""]}\nO campo "content" deve ser HTML pronto para publicação seguindo as regras abaixo.',
    FORMATTING_RULES_PT_BR,
  ].join("\n\n");
  const response = await withAiRetry("post", (signal) => generateOpenRouterText({ config: aiConfig, system: editorial.systemMessage, prompt, signal }));
  const post = parseGeneratedPostResponse(response);
  // The model is told which links it may use; this is what enforces it. A
  // hallucinated href reaching a live post is worse than losing a real link.
  post.content = sanitizeGeneratedLinks(post.content, editorial.allowedLinkPaths);
  return post;
}

async function generateImageWithAi({ post, aiConfig }: { settings: BlogSettings; post: GeneratedPost; manual: boolean; aiConfig: BlogAiConfig }): Promise<GeneratedImage | null> {
  const prompt = [
    "Crie uma imagem de capa cinematográfica para um post de blog brasileiro.",
    `Título: ${post.title}`,
    `Resumo: ${post.excerpt ?? post.metaDescription ?? ""}`,
    `Palavra-chave foco: ${post.focusKeyword ?? ""}`,
    "Estilo: fotografia editorial profissional, limpa e convidativa. Proporção 16:9.",
    "Sem texto, marcas d'água ou logotipos na imagem.",
  ].join("\n");

  return await withAiRetry("image", (signal) => generateOpenRouterImage({ config: aiConfig, prompt, signal }));
}

function imageExtensionFromMime(mime: string): string {
  const subtype = mime.split("/")[1] ?? "png";
  return subtype === "jpeg" ? "jpg" : subtype;
}

async function uploadFeatureImage({ bytes, mime, path }: { bytes: Buffer; mime: string; path: string }): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from("images").upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Failed to upload blog image: ${error.message}`);
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

async function runPipeline({ settings, job, manual, rssItem, aiConfig, feedback, editorial }: PipelineContext): Promise<PipelineSuccess> {
  const deps = getDeps();
  const now = deps.now();
  const tStart = Date.now();

  // Phase 38 BLOG2-15: per-stage timing in outer scope so the catch in
  // BlogGenerator.generate can attach partial durations to thrown errors.
  const partial: Partial<DurationsMs> = {};

  try {
    const tTopic = Date.now();
    const topic = await deps.generateTopic({ settings, manual, rssItem, aiConfig, feedback, editorial });
    partial.topic = Date.now() - tTopic;

    const tContent = Date.now();
    const generatedPost = await deps.generatePost({ settings, topic, manual, rssItem, aiConfig, feedback, editorial });
    partial.content = Date.now() - tContent;

    // Phase 36 BLOG2-02/BLOG2-04 (D-05/D-06): sanitize, then length-validate
    const sanitizedContent = sanitizeBlogHtml(generatedPost.content);
    const plainTextLen = getPlainTextLength(sanitizedContent);
    if (plainTextLen < MIN_PLAIN_TEXT_CHARS) {
      const originalPlainTextLen = getPlainTextLength(generatedPost.content);
      throw new Error(originalPlainTextLen >= MIN_PLAIN_TEXT_CHARS ? "invalid_html" : "content_length_out_of_bounds");
    }
    if (plainTextLen > MAX_PLAIN_TEXT_CHARS) throw new Error("content_length_out_of_bounds");
    generatedPost.content = sanitizedContent;

    // Phase 38 BLOG2-15: image stage timing. null = stage gracefully skipped
    // (Phase 22 D-04 / Phase 38 D-03: post still saves on full retry exhaustion).
    let dImage: number | null = null;
    let dUpload = 0;
    let featureImageUrl: string | null = null;

    try {
      const tImage = Date.now();
      const image = await deps.generateImage({ settings, post: generatedPost, manual, aiConfig });
      dImage = Date.now() - tImage;
      if (image?.bytes.length) {
        const tUpload = Date.now();
        const path = `blog-images/${now.getTime()}-${randomUUID()}.${imageExtensionFromMime(image.mime)}`;
        featureImageUrl = await deps.uploadImage({ bytes: image.bytes, mime: image.mime, path });
        dUpload = Date.now() - tUpload;
      } else {
        console.warn("Blog generator image generation returned no bytes; continuing without feature image");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Blog generator image pipeline failed; continuing without feature image: ${message}`);
      dImage = null; // exhaustion-after-retry: leave image timing as null per D-04
      dUpload = 0;
    }
    partial.image = dImage;
    partial.upload = dUpload;

    // Autopost port: auto-approve publishes immediately; otherwise the draft
    // waits in the approval queue (Blog → Automation) for a human decision.
    const autoPublish = settings.autoPublish;

    const postInput: InsertBlogPost = {
      title: generatedPost.title,
      slug: buildSlug(generatedPost.title, now),
      content: generatedPost.content,
      excerpt: generatedPost.excerpt,
      metaDescription: generatedPost.metaDescription,
      focusKeyword: generatedPost.focusKeyword,
      tags: generatedPost.tags.join(", "),
      featureImageUrl,
      status: autoPublish ? "published" : "draft",
      publishedAt: autoPublish ? now : null,
      authorName: "AI Assistant",
    };

    const post = await deps.storage.createBlogPost(postInput);

    // Mark the item used AFTER the post insert succeeds, and only when this run
    // actually consumed one — a pillar-only run has nothing to mark.
    if (rssItem) {
      try {
        await deps.storage.markRssItemUsed(rssItem.id, post.id);
      } catch (markErr) {
        const message = markErr instanceof Error ? markErr.message : String(markErr);
        console.warn(`[blog-generator] markRssItemUsed failed for item ${rssItem.id}: ${message}`);
      }
    }

    const durationsMs: DurationsMs = {
      topic: partial.topic ?? 0,
      content: partial.content ?? 0,
      image: partial.image ?? null,
      upload: partial.upload ?? 0,
      total: Date.now() - tStart,
    };

    await deps.storage.updateBlogGenerationJob(job.id, {
      status: "completed",
      postId: post.id,
      completedAt: now,
      reason: null,
      errorMessage: null,
      durationsMs,
    });

    await deps.storage.upsertBlogSettings(buildRunFinalization({ lastRunAt: now, lockAcquiredAt: null }));

    return { jobId: job.id, postId: post.id, post };
  } catch (err) {
    // Phase 38 BLOG2-15 (Pitfall 2): attach partial durations so the outer catch
    // in BlogGenerator.generate can persist whatever stages completed.
    if (err && typeof err === "object") {
      (err as { partialDurationsMs?: Partial<DurationsMs> }).partialDurationsMs = {
        ...partial,
        total: Date.now() - tStart,
      };
    }
    throw err;
  }
}

// Phase 37 D-07: preview-without-commit. Reuses generateTopic + generatePost + sanitize +
// length validate + (best-effort) image from the same dep table runPipeline uses, but
// RETURNS the content instead of persisting it. No lock, no blog_generation_jobs row.
export interface PreviewResult {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  tags: string[];
  featureImageUrl: string | null;
  /** null when this preview ran on the pillar rotation alone. */
  rssItem: BlogRssItem | null;
}

export type RunPreviewResponse =
  | { skipped: true; reason: SkipReason | "invalid_html" | "content_length_out_of_bounds" | "ai_timeout" | "ai_empty_response" }
  | { skipped: false; result: PreviewResult };

async function listFeedbackSafe(deps: BlogGeneratorDeps): Promise<BlogPostFeedback[]> {
  try {
    return await deps.storage.listBlogPostFeedback(FEEDBACK_PROMPT_LIMIT);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[blog-generator] listBlogPostFeedback failed (continuing without feedback context): ${message}`);
    return [];
  }
}

export async function runPreview(options?: { rssItemId?: number }): Promise<RunPreviewResponse> {
  const deps = getDeps();
  const settings = await deps.storage.getBlogSettings();
  if (!settings) return { skipped: true, reason: "no_settings" };

  const aiConfig = await deps.resolveAiConfig(settings);
  if (!aiConfig) return { skipped: true, reason: "not_configured" };

  let rssItem: BlogRssItem | null;
  if (typeof options?.rssItemId === "number") {
    const all = await deps.storage.listPendingRssItems();
    rssItem = all.find((i) => i.id === options.rssItemId) ?? null;
  } else {
    rssItem = await deps.selectRssItem(settings, deps.now());
  }
  const feedback = await listFeedbackSafe(deps);
  // A preview needs no job row, so the rotation seed comes from the clock. It
  // only decides which pillar/title shape this preview demonstrates.
  const editorial = await deps.buildEditorial({ settings, jobSeed: deps.now().getTime(), rssItem });

  try {
    const topic = await deps.generateTopic({ settings, manual: true, rssItem, aiConfig, feedback, editorial });
    const generatedPost = await deps.generatePost({ settings, topic, manual: true, rssItem, aiConfig, feedback, editorial });
    const sanitizedContent = sanitizeBlogHtml(generatedPost.content);
    const plainTextLen = getPlainTextLength(sanitizedContent);
    if (plainTextLen < MIN_PLAIN_TEXT_CHARS) {
      const originalLen = getPlainTextLength(generatedPost.content);
      return { skipped: true, reason: originalLen >= MIN_PLAIN_TEXT_CHARS ? "invalid_html" : "content_length_out_of_bounds" };
    }
    if (plainTextLen > MAX_PLAIN_TEXT_CHARS) return { skipped: true, reason: "content_length_out_of_bounds" };

    let featureImageUrl: string | null = null;
    try {
      const image = await deps.generateImage({ settings, post: generatedPost, manual: true, aiConfig });
      if (image?.bytes.length) {
        const path = `blog-images/${deps.now().getTime()}-${randomUUID()}.${imageExtensionFromMime(image.mime)}`;
        featureImageUrl = await deps.uploadImage({ bytes: image.bytes, mime: image.mime, path });
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
    if (err instanceof AiTimeoutError) return { skipped: true, reason: "ai_timeout" };
    if (err instanceof AiEmptyResponseError) return { skipped: true, reason: "ai_empty_response" };
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

    if (!settings) return { skipped: true, reason: "no_settings" };
    if (!manual && !settings.enabled) return { skipped: true, reason: "disabled" };
    if (!manual && settings.postsPerDay <= 0) return { skipped: true, reason: "posts_per_day_zero" };
    if (!manual) {
      const skipReason = resolveSkipReason(settings, now);
      if (skipReason) return { skipped: true, reason: skipReason };
    }

    // Autopost port: no OpenRouter key or missing text/image models → skip
    // (belt-and-braces on top of the settings-save validation; the key can be
    // removed from Integrations after automation was enabled).
    const aiConfig = await deps.resolveAiConfig(settings);
    if (!aiConfig) return { skipped: true, reason: "not_configured" };

    // D-09/D-10: pick RSS item BEFORE lock + AI calls; empty queue → skip + return.
    // Phase 37 D-09: retry path passes rssItemId to bypass the selector.
    let rssItem: BlogRssItem | null;
    if (typeof rssItemId === "number") {
      const candidates = await deps.storage.listPendingRssItems();
      rssItem = candidates.find((i) => i.id === rssItemId) ?? null;
    } else {
      rssItem = await deps.selectRssItem(settings, now);
    }
    // SC-04: an empty queue is no longer a reason to publish nothing. RSS is one
    // topic source; the editorial pillar rotation is the other, and it needs no
    // input at all. The generator only skips for the reasons above this line.

    const lockAcquired = await deps.acquireLock(settings, now);
    if (!lockAcquired) return { skipped: true, reason: "locked" };

    const job = await deps.storage.createBlogGenerationJob({
      status: "running",
      startedAt: now,
      trigger: manual ? "manual" : "cron",
      source: rssItem ? "rss" : "pillar",
      rssItemId: rssItem?.id ?? null,
    });
    const feedback = await listFeedbackSafe(deps);
    // The job id seeds the rotation, so consecutive runs vary while a test with
    // a fixed id is deterministic.
    const editorial = await deps.buildEditorial({ settings, jobSeed: job.id, rssItem });

    try {
      const result = await deps.runPipeline({ settings, job, manual, rssItem, aiConfig, feedback, editorial });
      return { skipped: false, reason: null, jobId: result.jobId, postId: result.postId, post: result.post };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // D-13: map typed/value errors to the reason taxonomy.
      let reason: string | null = null;
      if (error instanceof AiTimeoutError) reason = "ai_timeout";
      else if (error instanceof AiEmptyResponseError) reason = "ai_empty_response";
      else if (message === "invalid_html" || message === "content_length_out_of_bounds") reason = message;

      // Phase 38 BLOG2-15: persist partial timings if runPipeline attached them.
      // Skipped jobs (no_settings/disabled/etc.) hit earlier returns and never reach here,
      // so durationsMs stays NULL via Drizzle insert default — matches D-04.
      const partialDurationsMs = (error && typeof error === "object")
        ? (error as { partialDurationsMs?: Partial<DurationsMs> }).partialDurationsMs
        : undefined;

      await deps.storage.updateBlogGenerationJob(job.id, {
        status: "failed",
        reason,
        errorMessage: message,
        completedAt: deps.now(),
        durationsMs: partialDurationsMs as DurationsMs | undefined,
      });
      await deps.storage.upsertBlogSettings(buildRunFinalization({ lastRunAt: settings.lastRunAt, lockAcquiredAt: null }));

      throw error;
    }
  }
}

export function __setBlogGeneratorTestDeps(overrides: Partial<BlogGeneratorDeps>) { testDeps = overrides; }
export function __resetBlogGeneratorTestDeps() { testDeps = null; }

export type { BlogGeneratorResult };
