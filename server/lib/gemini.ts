import { OpenAI } from "openai";

/**
 * Gemini API OpenAI-compatible base URL
 * Google provides an OpenAI-compatible endpoint for Gemini models,
 * allowing us to use the OpenAI SDK without code duplication
 */
const GEMINI_OPENAI_COMPAT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

/**
 * Creates a Gemini client using the OpenAI SDK
 * @param apiKey - Gemini API key
 * @returns OpenAI client configured for Gemini API
 */
export function getGeminiClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey,
    baseURL: GEMINI_OPENAI_COMPAT_BASE_URL,
  });
}
