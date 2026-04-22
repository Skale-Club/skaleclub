import { GoogleGenAI } from "@google/genai";

export const BLOG_CONTENT_MODEL = "gemini-1.5-flash";
export const BLOG_IMAGE_MODEL = "gemini-2.0-flash-exp";

let blogGeminiClient: GoogleGenAI | null = null;

export function resolveBlogGeminiApiKey(): string {
  const apiKey =
    process.env.BLOG_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini blog generation is not configured - set BLOG_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY"
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
