import { OpenAI } from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getOpenRouterReferer(): string {
  return process.env.OPENROUTER_HTTP_REFERER || process.env.APP_URL || "http://localhost:5000";
}

function getOpenRouterTitle(): string {
  return process.env.OPENROUTER_APP_NAME || "SkaleClub";
}

/**
 * Creates an OpenRouter client using the OpenAI SDK compatibility mode.
 */
export function getOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": getOpenRouterReferer(),
      "X-Title": getOpenRouterTitle(),
    },
  });
}
