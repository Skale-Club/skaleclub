import { OpenAI } from "openai";
import { getGeminiClient } from "./gemini.js";
import { getOpenRouterClient } from "./openrouter.js";
import { storage } from "../storage.js";

export type AIProvider = "openai" | "gemini" | "openrouter";

// Runtime cache for API keys (reduces database reads and allows in-memory override)
let runtimeOpenAiKey: string | undefined;
let runtimeGeminiKey: string | undefined;
let runtimeOpenRouterKey: string | undefined;

/**
 * Set OpenAI API key in runtime cache
 * @param key - OpenAI API key
 */
export function setRuntimeOpenAiKey(key: string) {
  runtimeOpenAiKey = key;
}

/**
 * Set Gemini API key in runtime cache
 * @param key - Gemini API key
 */
export function setRuntimeGeminiKey(key: string) {
  runtimeGeminiKey = key;
}

/**
 * Set OpenRouter API key in runtime cache
 * @param key - OpenRouter API key
 */
export function setRuntimeOpenRouterKey(key: string) {
  runtimeOpenRouterKey = key;
}

/**
 * Get runtime OpenAI key (used for preserving existing behavior)
 * @returns Current runtime OpenAI key
 */
export function getRuntimeOpenAiKey(): string | undefined {
  return runtimeOpenAiKey;
}

/**
 * Get runtime Gemini key
 * @returns Current runtime Gemini key
 */
export function getRuntimeGeminiKey(): string | undefined {
  return runtimeGeminiKey;
}

/**
 * Get runtime OpenRouter key
 * @returns Current runtime OpenRouter key
 */
export function getRuntimeOpenRouterKey(): string | undefined {
  return runtimeOpenRouterKey;
}

/**
 * Get the active AI client based on chat settings configuration.
 * Priority: active provider setting -> enabled integration -> null
 *
 * API Key Resolution Priority (per provider):
 * 1. Runtime cache (set after successful test connection)
 * 2. Environment variable
 * 3. Database storage
 *
 * @returns Active AI client configuration or null if none available
 */
export async function getActiveAIClient(): Promise<{
  client: OpenAI;
  model: string;
  provider: AIProvider;
} | null> {
  const chatSettings = await storage.getChatSettings();
  const activeProvider = (chatSettings.activeAiProvider as AIProvider | null | undefined) || "openai";

  if (activeProvider === "gemini") {
    const geminiIntegration = await storage.getChatIntegration("gemini");
    if (!geminiIntegration?.enabled) {
      console.log("Gemini provider selected but not enabled");
      return null;
    }

    const apiKey = runtimeGeminiKey || process.env.GEMINI_API_KEY || geminiIntegration?.apiKey;

    if (!apiKey) {
      console.log("Gemini provider enabled but no API key available");
      return null;
    }

    return {
      client: getGeminiClient(apiKey),
      model: geminiIntegration.model || "gemini-2.0-flash",
      provider: "gemini",
    };
  }

  if (activeProvider === "openrouter") {
    const openRouterIntegration = await storage.getChatIntegration("openrouter");
    if (!openRouterIntegration?.enabled) {
      console.log("OpenRouter provider selected but not enabled");
      return null;
    }

    const apiKey = runtimeOpenRouterKey || process.env.OPENROUTER_API_KEY || openRouterIntegration?.apiKey;

    if (!apiKey) {
      console.log("OpenRouter provider enabled but no API key available");
      return null;
    }

    return {
      client: getOpenRouterClient(apiKey),
      model: openRouterIntegration.model || "openai/gpt-4o-mini",
      provider: "openrouter",
    };
  }

  // Default to OpenAI.
  const openaiIntegration = await storage.getChatIntegration("openai");
  if (!openaiIntegration?.enabled) {
    console.log("OpenAI provider not enabled");
    return null;
  }

  const apiKey = runtimeOpenAiKey || process.env.OPENAI_API_KEY || openaiIntegration?.apiKey;

  if (!apiKey) {
    console.log("OpenAI provider enabled but no API key available");
    return null;
  }

  return {
    client: new OpenAI({ apiKey }),
    model: openaiIntegration.model || "gpt-4o-mini",
    provider: "openai",
  };
}
