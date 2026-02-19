import { OpenAI } from "openai";
import { getGeminiClient } from "./gemini.js";
import { storage } from "../storage.js";

export type AIProvider = 'openai' | 'gemini';

// Runtime cache for API keys (reduces database reads and allows in-memory override)
let runtimeOpenAiKey: string | undefined;
let runtimeGeminiKey: string | undefined;

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
 * Get the active AI client based on chat settings configuration
 * Priority: active provider setting → enabled integrations → null
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
  const activeProvider = (chatSettings.activeAiProvider as AIProvider | null | undefined) || 'openai';

  if (activeProvider === 'gemini') {
    const geminiIntegration = await storage.getChatIntegration('gemini');
    if (!geminiIntegration?.enabled) {
      console.log('Gemini provider selected but not enabled');
      return null;
    }

    const apiKey = runtimeGeminiKey
      || process.env.GEMINI_API_KEY
      || geminiIntegration?.apiKey;

    if (!apiKey) {
      console.log('Gemini provider enabled but no API key available');
      return null;
    }

    return {
      client: getGeminiClient(apiKey),
      model: geminiIntegration.model || 'gemini-2.0-flash',
      provider: 'gemini'
    };
  }

  // Default to OpenAI
  const openaiIntegration = await storage.getChatIntegration('openai');
  if (!openaiIntegration?.enabled) {
    console.log('OpenAI provider not enabled');
    return null;
  }

  const apiKey = runtimeOpenAiKey
    || process.env.OPENAI_API_KEY
    || openaiIntegration?.apiKey;

  if (!apiKey) {
    console.log('OpenAI provider enabled but no API key available');
    return null;
  }

  return {
    client: new OpenAI({ apiKey }),
    model: openaiIntegration.model || 'gpt-4o-mini',
    provider: 'openai'
  };
}
