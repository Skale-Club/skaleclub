import { GoogleGenAI } from "@google/genai";

// ─── Phase 36 (D-09): env-overridable model IDs ──────────────────────────
//
// Both constants are read ONCE at module load. Override at deploy time via
// env vars; the fallbacks preserve the v1.5/v1.6 production defaults.
//
// - BLOG_CONTENT_MODEL: text generation (topic + post body)
// - BLOG_IMAGE_MODEL:   feature-image generation
//
// .env.example documents both.

export const BLOG_CONTENT_MODEL: string =
  process.env.BLOG_CONTENT_MODEL || "gemini-2.5-flash";

export const BLOG_IMAGE_MODEL: string =
  process.env.BLOG_IMAGE_MODEL || "gemini-2.0-flash-exp";

// ─── Phase 36 (D-07): env-overridable Gemini timeout ─────────────────────
//
// AbortController timeout consumed by Plan 36-03 at every Gemini call site.
// Defensive parse: Number("") → NaN → falls back; "0" → 0 → falls back;
// "abc" → NaN → falls back. Only positive finite numbers override.

export const BLOG_GEMINI_TIMEOUT_MS: number =
  Number(process.env.BLOG_GEMINI_TIMEOUT_MS) || 30_000;

// ─── API-key resolution + client singleton (unchanged from v1.5) ────────

let blogGeminiClient: GoogleGenAI | null = null;

export function resolveBlogGeminiApiKey(): string {
  const apiKey =
    process.env.BLOG_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini blog generation is not configured - set BLOG_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY",
    );
  }

  return apiKey;
}

export function getBlogGeminiClient(): GoogleGenAI {
  if (!blogGeminiClient) {
    blogGeminiClient = new GoogleGenAI({ apiKey: resolveBlogGeminiApiKey() });
  }

  return blogGeminiClient;
}
