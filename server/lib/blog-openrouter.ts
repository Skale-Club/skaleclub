// server/lib/blog-openrouter.ts
//
// Autopost port (Xkedule): OpenRouter is the blog generator's AI provider.
// The API key lives in the existing OpenRouter integration (Admin →
// Integrations); the text/image model ids live on blog_settings and are
// picked in the Blog → Automation panel. Automation only runs when all
// three are configured — resolveBlogAiConfig() is the single gate.

import type { BlogSettings } from "#shared/schema.js";
import { getOpenRouterClient } from "./openrouter.js";
import { getRuntimeOpenRouterKey } from "./ai-provider.js";
import { AiEmptyResponseError } from "./blogContentValidator.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Timeout consumed by the generator's retry wrapper at every AI call site.
// BLOG_GEMINI_TIMEOUT_MS is honored for backward compatibility with deploys
// that already override the old Gemini-era variable.
export const BLOG_AI_TIMEOUT_MS: number =
  Number(process.env.BLOG_AI_TIMEOUT_MS) ||
  Number(process.env.BLOG_GEMINI_TIMEOUT_MS) ||
  30_000;

export interface BlogAiConfig {
  apiKey: string;
  textModel: string;
  imageModel: string;
}

/** Typed HTTP error so the generator's transient-error classifier can read .status. */
export class OpenRouterApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterApiError";
    this.status = status;
  }
}

/** Runtime cache → env → OpenRouter integration row (survives restarts). */
export async function resolveOpenRouterKey(): Promise<string | null> {
  const runtimeOrEnv = getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY;
  if (runtimeOrEnv) return runtimeOrEnv;
  const { storage } = await import("../storage.js");
  const integration = await storage.getChatIntegration("openrouter");
  return integration?.apiKey || null;
}

/**
 * The autopost configuration gate: null unless an OpenRouter key exists AND
 * both blog models are set. Callers skip with reason "not_configured" on null.
 */
export async function resolveBlogAiConfig(settings: BlogSettings): Promise<BlogAiConfig | null> {
  const textModel = settings.openrouterTextModel?.trim();
  const imageModel = settings.openrouterImageModel?.trim();
  if (!textModel || !imageModel) return null;
  const apiKey = await resolveOpenRouterKey();
  if (!apiKey) return null;
  return { apiKey, textModel, imageModel };
}

function normalizeOpenRouterError(err: unknown): Error {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") {
    const message = err instanceof Error ? err.message : String(err);
    return new OpenRouterApiError(status, message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Single text completion via the OpenAI-compatible OpenRouter endpoint. */
export async function generateOpenRouterText(options: {
  config: BlogAiConfig;
  system: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { config, system, prompt, signal } = options;
  const client = getOpenRouterClient(config.apiKey);
  let completion;
  try {
    completion = await client.chat.completions.create(
      {
        model: config.textModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      },
      { signal },
    );
  } catch (err) {
    throw normalizeOpenRouterError(err);
  }
  const text = completion.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new AiEmptyResponseError(`OpenRouter ${config.textModel} returned no text output`);
  }
  return text;
}

/**
 * Image generation via OpenRouter chat completions with image output
 * modalities. Image-capable models return base64 data URLs in
 * choices[0].message.images[].image_url.url. Returns null when the model
 * answered without an image (caller treats missing images as non-fatal).
 */
export async function generateOpenRouterImage(options: {
  config: BlogAiConfig;
  prompt: string;
  signal?: AbortSignal;
}): Promise<{ bytes: Buffer; mime: string } | null> {
  const { config, prompt, signal } = options;
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || process.env.APP_URL || "http://localhost:1000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "SkaleClub",
    },
    body: JSON.stringify({
      model: config.imageModel,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new OpenRouterApiError(
      response.status,
      `OpenRouter image request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const images = json.choices?.[0]?.message?.images;
  if (!Array.isArray(images) || images.length === 0) return null;

  const dataUrl = images[0]?.image_url?.url;
  if (typeof dataUrl !== "string") return null;

  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;

  return { bytes: Buffer.from(match[2], "base64"), mime: match[1].toLowerCase() };
}
