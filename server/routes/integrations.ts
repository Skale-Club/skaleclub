import type { Express } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage.js";
import { insertChatIntegrationsSchema } from "#shared/schema.js";
import { getGeminiClient } from "../lib/gemini.js";
import { getOpenRouterClient } from "../lib/openrouter.js";
import {
  setRuntimeOpenAiKey,
  setRuntimeGeminiKey,
  setRuntimeOpenRouterKey,
  getRuntimeOpenAiKey,
  getRuntimeGeminiKey,
  getRuntimeOpenRouterKey,
  setRuntimeGroqKey,
  getRuntimeGroqKey,
} from "../lib/ai-provider.js";
import { testGHLConnection, getGHLCustomFields } from "../integrations/ghl.js";
import { requireAdmin } from "./_shared.js";

// ─── AI Model Defaults ───────────────────────────────────────────────────────

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

// ─── OpenRouter Model Cache ──────────────────────────────────────────────────

type OpenRouterModelItem = {
  id: string;
  name?: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt?: string; completion?: string };
};

const OPENROUTER_MODEL_FALLBACKS: OpenRouterModelItem[] = [
  { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o mini" },
  { id: "openai/gpt-4o", name: "OpenAI: GPT-4o" },
  { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Meta: Llama 3.1 70B Instruct" },
  { id: "google/gemini-2.0-flash-001", name: "Google: Gemini 2.0 Flash" },
  { id: "z-ai/glm-5", name: "Z.AI: GLM-5" },
];

let openRouterModelsCache: { expiresAt: number; models: OpenRouterModelItem[] } | null = null;

async function getOpenRouterModels(): Promise<OpenRouterModelItem[]> {
  if (openRouterModelsCache && Date.now() < openRouterModelsCache.expiresAt) {
    return openRouterModelsCache.models;
  }

  const keyToUse =
    getRuntimeOpenRouterKey() ||
    process.env.OPENROUTER_API_KEY ||
    (await storage.getChatIntegration("openrouter"))?.apiKey;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || process.env.APP_URL || "http://localhost:1000",
    "X-Title": process.env.OPENROUTER_APP_NAME || "SkaleClub",
  };
  if (keyToUse) headers.Authorization = `Bearer ${keyToUse}`;

  const response = await fetch("https://openrouter.ai/api/v1/models", { method: "GET", headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch OpenRouter models (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as { data?: any[] };
  const models = (Array.isArray(json.data) ? json.data : [])
    .map((item): OpenRouterModelItem | null => {
      const id = typeof item?.id === "string" ? item.id : "";
      if (!id) return null;
      return {
        id,
        name: typeof item?.name === "string" ? item.name : undefined,
        description: typeof item?.description === "string" ? item.description : undefined,
        contextLength: typeof item?.context_length === "number" ? item.context_length : undefined,
        pricing: item?.pricing && typeof item.pricing === "object"
          ? {
            prompt: typeof item.pricing.prompt === "string" ? item.pricing.prompt : undefined,
            completion: typeof item.pricing.completion === "string" ? item.pricing.completion : undefined,
          }
          : undefined,
      };
    })
    .filter((item): item is OpenRouterModelItem => Boolean(item))
    .sort((a, b) => a.id.localeCompare(b.id));

  openRouterModelsCache = { models, expiresAt: Date.now() + 5 * 60 * 1000 };
  return models;
}

// ─── AI Client Factories ─────────────────────────────────────────────────────

function getOpenAIClient(apiKey?: string) {
  const key = apiKey || getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function getGeminiOpenAIClient(apiKey?: string) {
  const key = apiKey || getRuntimeGeminiKey() || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return getGeminiClient(key);
}

function getOpenRouterOpenAIClient(apiKey?: string) {
  const key = apiKey || getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  return getOpenRouterClient(key);
}

// ─── Twilio Helpers ──────────────────────────────────────────────────────────

const cleanPhone = (value?: string | null): string =>
  (value || "").toString().replace(/[\s()-]/g, "").trim();

const parseRecipients = (numbers?: string[] | null, fallback?: string | null): string[] => {
  const recipients: string[] = [];
  const push = (val?: string | null) => {
    const cleaned = cleanPhone(val);
    if (cleaned) recipients.push(cleaned);
  };
  if (Array.isArray(numbers)) {
    for (const num of numbers) push(num);
  }
  push(fallback);
  return Array.from(new Set(recipients));
};

const twilioSettingsSchema = z.object({
  accountSid: z.string().trim().optional(),
  authToken: z.string().trim().optional(),
  fromPhoneNumber: z.string().trim().optional(),
  toPhoneNumber: z.string().trim().optional(),
  toPhoneNumbers: z.array(z.string().trim()).optional(),
  notifyOnNewChat: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const telegramSettingsSchema = z.object({
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().optional(),
  enabled: z.boolean().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerIntegrationRoutes(app: Express) {
  // Seed runtime cache from env at startup
  const envOpenAiKey = process.env.OPENAI_API_KEY || "";
  const envGeminiKey = process.env.GEMINI_API_KEY || "";
  const envOpenRouterKey = process.env.OPENROUTER_API_KEY || "";
  if (envOpenAiKey) setRuntimeOpenAiKey(envOpenAiKey);
  if (envGeminiKey) setRuntimeGeminiKey(envGeminiKey);
  if (envOpenRouterKey) setRuntimeOpenRouterKey(envOpenRouterKey);

  // ===============================
  // OpenAI Integration Routes
  // ===============================

  app.get('/api/integrations/openai', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('openai');
      res.json({
        provider: 'openai',
        enabled: integration?.enabled || false,
        model: integration?.model || DEFAULT_CHAT_MODEL,
        hasKey: !!(getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/openai', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('openai');
      const payload = insertChatIntegrationsSchema
        .partial()
        .extend({ apiKey: z.string().min(10).optional() })
        .parse({ ...req.body, provider: 'openai' });

      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist = providedKey ?? existing?.apiKey ?? getRuntimeOpenAiKey() ?? process.env.OPENAI_API_KEY;
      if (providedKey) setRuntimeOpenAiKey(providedKey);

      const willEnable = payload.enabled ?? false;
      if (willEnable && !keyToPersist) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'openai',
        enabled: payload.enabled ?? false,
        model: payload.model || DEFAULT_CHAT_MODEL,
        apiKey: keyToPersist,
      });

      res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/openai/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
      const existing = await storage.getChatIntegration('openai');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        getRuntimeOpenAiKey() ||
        process.env.OPENAI_API_KEY ||
        existing?.apiKey;

      if (!keyToUse) return res.status(400).json({ success: false, message: 'API key is required' });

      const client = getOpenAIClient(keyToUse);
      if (!client) return res.status(400).json({ success: false, message: 'Invalid API key' });

      try {
        await client.chat.completions.create({
          model: model || DEFAULT_CHAT_MODEL,
          messages: [{ role: 'user', content: 'Say pong' }],
          max_tokens: 5,
        });
      } catch (err: any) {
        const message = err?.message || 'Failed to test OpenAI connection';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({ success: false, message: status ? `OpenAI error (${status}): ${message}` : message });
      }

      setRuntimeOpenAiKey(keyToUse);
      await storage.upsertChatIntegration({
        provider: 'openai',
        enabled: existing?.enabled ?? false,
        model: model || existing?.model || DEFAULT_CHAT_MODEL,
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test OpenAI connection' });
    }
  });

  // ===============================
  // Gemini Integration Routes
  // ===============================

  app.get('/api/integrations/gemini', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('gemini');
      res.json({
        provider: 'gemini',
        enabled: integration?.enabled || false,
        model: integration?.model || DEFAULT_GEMINI_MODEL,
        hasKey: !!(getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/gemini', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('gemini');
      const payload = insertChatIntegrationsSchema
        .partial()
        .extend({ apiKey: z.string().min(10).optional() })
        .parse({ ...req.body, provider: 'gemini' });

      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist = providedKey ?? existing?.apiKey ?? getRuntimeGeminiKey() ?? process.env.GEMINI_API_KEY;
      if (providedKey) setRuntimeGeminiKey(providedKey);

      const willEnable = payload.enabled ?? false;
      if (willEnable && !keyToPersist) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'gemini',
        enabled: payload.enabled ?? false,
        model: payload.model || DEFAULT_GEMINI_MODEL,
        apiKey: keyToPersist,
      });

      res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/gemini/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
      const existing = await storage.getChatIntegration('gemini');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        getRuntimeGeminiKey() ||
        process.env.GEMINI_API_KEY ||
        existing?.apiKey;

      if (!keyToUse) return res.status(400).json({ success: false, message: 'API key is required' });

      const client = getGeminiOpenAIClient(keyToUse);
      if (!client) return res.status(400).json({ success: false, message: 'Invalid API key' });

      try {
        await client.chat.completions.create({
          model: model || DEFAULT_GEMINI_MODEL,
          messages: [{ role: 'user', content: 'Say pong' }],
          max_tokens: 5,
        });
      } catch (err: any) {
        const message = err?.message || 'Failed to test Gemini connection';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({ success: false, message: status ? `Gemini error (${status}): ${message}` : message });
      }

      setRuntimeGeminiKey(keyToUse);
      await storage.upsertChatIntegration({
        provider: 'gemini',
        enabled: existing?.enabled ?? false,
        model: model || existing?.model || DEFAULT_GEMINI_MODEL,
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test Gemini connection' });
    }
  });

  // ===============================
  // OpenRouter Integration Routes
  // ===============================

  app.get('/api/integrations/openrouter', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('openrouter');
      res.json({
        provider: 'openrouter',
        enabled: integration?.enabled || false,
        model: integration?.model || DEFAULT_OPENROUTER_MODEL,
        hasKey: !!(getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/openrouter', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('openrouter');
      const payload = insertChatIntegrationsSchema
        .partial()
        .extend({ apiKey: z.string().min(10).optional() })
        .parse({ ...req.body, provider: 'openrouter' });

      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist =
        providedKey ??
        existing?.apiKey ??
        getRuntimeOpenRouterKey() ??
        process.env.OPENROUTER_API_KEY;

      if (providedKey) {
        setRuntimeOpenRouterKey(providedKey);
        openRouterModelsCache = null;
      }

      const willEnable = payload.enabled ?? false;
      if (willEnable && !keyToPersist) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'openrouter',
        enabled: payload.enabled ?? false,
        model: payload.model || DEFAULT_OPENROUTER_MODEL,
        apiKey: keyToPersist,
      });

      res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/openrouter/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
      const existing = await storage.getChatIntegration('openrouter');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        getRuntimeOpenRouterKey() ||
        process.env.OPENROUTER_API_KEY ||
        existing?.apiKey;

      if (!keyToUse) return res.status(400).json({ success: false, message: 'API key is required' });

      const client = getOpenRouterOpenAIClient(keyToUse);
      if (!client) return res.status(400).json({ success: false, message: 'Invalid API key' });

      try {
        await client.chat.completions.create({
          model: model || existing?.model || DEFAULT_OPENROUTER_MODEL,
          messages: [{ role: 'user', content: 'Say pong' }],
          max_tokens: 5,
        });
      } catch (err: any) {
        const message = err?.message || 'Failed to test OpenRouter connection';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({ success: false, message: status ? `OpenRouter error (${status}): ${message}` : message });
      }

      setRuntimeOpenRouterKey(keyToUse);
      await storage.upsertChatIntegration({
        provider: 'openrouter',
        enabled: existing?.enabled ?? false,
        model: model || existing?.model || DEFAULT_OPENROUTER_MODEL,
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test OpenRouter connection' });
    }
  });

  app.get('/api/integrations/openrouter/models', requireAdmin, async (_req, res) => {
    try {
      const models = await getOpenRouterModels();
      res.json({ models, count: models.length });
    } catch (err) {
      res.json({ models: OPENROUTER_MODEL_FALLBACKS, count: OPENROUTER_MODEL_FALLBACKS.length, warning: (err as Error).message });
    }
  });

  // ===============================
  // Groq Integration Routes
  // ===============================

  app.get('/api/integrations/groq', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('groq');
      res.json({
        provider: 'groq',
        enabled: integration?.enabled || false,
        hasKey: !!(getRuntimeGroqKey() || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/groq', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('groq');
      const payload = z.object({ apiKey: z.string().min(10).optional(), enabled: z.boolean().optional() }).parse(req.body);
      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist = providedKey ?? existing?.apiKey ?? getRuntimeGroqKey();

      if (providedKey) setRuntimeGroqKey(providedKey);

      const willEnable = payload.enabled ?? false;
      if (willEnable && !keyToPersist) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'groq',
        enabled: willEnable,
        model: 'whisper-large-v3-turbo',
        apiKey: keyToPersist,
      });

      res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Failed to save Groq settings' });
    }
  });

  app.post('/api/integrations/groq/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey } = z.object({ apiKey: z.string().min(10).optional() }).parse(req.body);
      const existing = await storage.getChatIntegration('groq');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        getRuntimeGroqKey() ||
        existing?.apiKey;

      if (!keyToUse) return res.status(400).json({ success: false, message: 'API key is required' });

      try {
        const Groq = (await import('groq-sdk')).default;
        const groq = new Groq({ apiKey: keyToUse });
        await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'pong' }],
          max_tokens: 1,
        });
      } catch (err: any) {
        const msg = err?.message || 'Failed to connect to Groq';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({ success: false, message: status ? `Groq error (${status}): ${msg}` : msg });
      }

      setRuntimeGroqKey(keyToUse);
      await storage.upsertChatIntegration({
        provider: 'groq',
        enabled: existing?.enabled ?? false,
        model: 'whisper-large-v3-turbo',
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test Groq connection' });
    }
  });

  // ===============================
  // GoHighLevel Integration Routes
  // ===============================

  app.get('/api/integrations/ghl', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      if (!settings) {
        return res.json({ provider: 'gohighlevel', apiKey: '', locationId: '', calendarId: '2irhr47AR6K0AQkFqEQl', isEnabled: false });
      }
      res.json({ ...settings, apiKey: settings.apiKey ? '********' : '' });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/ghl', requireAdmin, async (req, res) => {
    try {
      const { apiKey, locationId, calendarId, isEnabled } = req.body;
      const existingSettings = await storage.getIntegrationSettings('gohighlevel');

      const settingsToSave: any = {
        provider: 'gohighlevel',
        locationId,
        calendarId: calendarId || '2irhr47AR6K0AQkFqEQl',
        isEnabled: isEnabled ?? false,
      };

      if (apiKey && apiKey !== '********') {
        settingsToSave.apiKey = apiKey;
      } else if (existingSettings?.apiKey) {
        settingsToSave.apiKey = existingSettings.apiKey;
      }

      const settings = await storage.upsertIntegrationSettings(settingsToSave);
      res.json({ ...settings, apiKey: settings.apiKey ? '********' : '' });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/ghl/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey, locationId } = req.body;
      let keyToTest = apiKey;
      if (apiKey === '********' || !apiKey) {
        const existingSettings = await storage.getIntegrationSettings('gohighlevel');
        keyToTest = existingSettings?.apiKey;
      }

      if (!keyToTest || !locationId) {
        return res.status(400).json({ success: false, message: 'API key and Location ID are required' });
      }

      const result = await testGHLConnection(keyToTest, locationId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/integrations/ghl/status', async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      res.json({ enabled: settings?.isEnabled || false, hasCalendar: !!settings?.calendarId });
    } catch (err) {
      res.json({ enabled: false, hasCalendar: false });
    }
  });

  app.get('/api/integrations/ghl/custom-fields', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      if (!settings?.isEnabled || !settings.apiKey || !settings.locationId) {
        return res.status(400).json({ success: false, message: 'GHL não está configurado. Configure a API Key e Location ID primeiro.' });
      }
      const result = await getGHLCustomFields(settings.apiKey, settings.locationId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Erro ao buscar custom fields' });
    }
  });

  // ===============================
  // Twilio Integration Routes
  // ===============================

  app.get('/api/integrations/twilio', requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getTwilioSettings();
      if (!settings) {
        return res.json({ enabled: false, accountSid: '', authToken: '', fromPhoneNumber: '', toPhoneNumber: '', toPhoneNumbers: [], notifyOnNewChat: true });
      }
      const recipients = parseRecipients(settings.toPhoneNumbers as string[] | undefined, settings.toPhoneNumber);
      res.json({
        ...settings,
        toPhoneNumbers: recipients,
        toPhoneNumber: recipients[0] || '',
        authToken: settings.authToken ? '********' : '',
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/twilio', requireAdmin, async (req, res) => {
    try {
      const parsed = twilioSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTwilioSettings();

      const accountSid = parsed.accountSid?.trim() || existingSettings?.accountSid;
      const fromPhoneNumber = parsed.fromPhoneNumber?.trim() || existingSettings?.fromPhoneNumber;
      const toPhoneNumbers = parseRecipients(parsed.toPhoneNumbers, parsed.toPhoneNumber || existingSettings?.toPhoneNumber);
      const tokenFromRequest = parsed.authToken && parsed.authToken !== '********' ? parsed.authToken.trim() : undefined;
      const authTokenToPersist = tokenFromRequest || existingSettings?.authToken;
      const enabled = parsed.enabled ?? existingSettings?.enabled ?? false;

      if (enabled && (!accountSid || !authTokenToPersist || !fromPhoneNumber || !toPhoneNumbers.length)) {
        return res.status(400).json({ message: 'All Twilio fields are required to enable notifications' });
      }

      const settingsToSave: any = {
        accountSid,
        fromPhoneNumber,
        toPhoneNumber: toPhoneNumbers[0] || null,
        toPhoneNumbers,
        notifyOnNewChat: parsed.notifyOnNewChat ?? existingSettings?.notifyOnNewChat ?? true,
        enabled,
      };

      if (tokenFromRequest) {
        settingsToSave.authToken = tokenFromRequest;
      } else if (existingSettings?.authToken) {
        settingsToSave.authToken = existingSettings.authToken;
      }

      const settings = await storage.saveTwilioSettings(settingsToSave);
      res.json({ ...settings, authToken: settings.authToken ? '********' : '' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid Twilio settings payload', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/twilio/test', requireAdmin, async (req, res) => {
    try {
      const parsed = twilioSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTwilioSettings();

      const accountSid = parsed.accountSid?.trim() || existingSettings?.accountSid;
      const fromPhoneNumber = parsed.fromPhoneNumber?.trim() || existingSettings?.fromPhoneNumber;
      const toPhoneNumbers = parseRecipients(parsed.toPhoneNumbers, parsed.toPhoneNumber || existingSettings?.toPhoneNumber);
      const tokenToTest = parsed.authToken && parsed.authToken !== '********'
        ? parsed.authToken.trim()
        : existingSettings?.authToken;

      if (!accountSid || !tokenToTest || !fromPhoneNumber || !toPhoneNumbers.length) {
        return res.status(400).json({ success: false, message: 'All fields are required to test Twilio connection' });
      }

      const company = await storage.getCompanySettings();
      const companyName = company?.companyName || 'Skale Club';

      const twilio = await import('twilio');
      const client = twilio.default(accountSid, tokenToTest);

      for (const to of toPhoneNumbers) {
        await client.messages.create({
          body: `Test message from ${companyName} - Your Twilio integration is working!`,
          from: fromPhoneNumber,
          to,
        });
      }

      res.json({ success: true, message: 'Test SMS sent successfully!' });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid Twilio test payload', errors: err.errors });
      }
      res.status(500).json({ success: false, message: err?.message || 'Failed to send test SMS' });
    }
  });

  // ===============================
  // Google Places Integration Routes
  // ===============================

  app.get('/api/integrations/google-places', requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('google_places');
      if (!settings) {
        return res.json({ provider: 'google_places', apiKey: '', isEnabled: false, hasKey: false });
      }
      res.json({ ...settings, apiKey: settings.apiKey ? '********' : '', hasKey: !!settings.apiKey });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/google-places', requireAdmin, async (req, res) => {
    try {
      const { apiKey, isEnabled } = req.body;
      const existingSettings = await storage.getIntegrationSettings('google_places');

      const settingsToSave: any = { provider: 'google_places', isEnabled: isEnabled ?? false };
      if (apiKey && apiKey !== '********') {
        settingsToSave.apiKey = apiKey;
      } else if (existingSettings?.apiKey) {
        settingsToSave.apiKey = existingSettings.apiKey;
      }

      const settings = await storage.upsertIntegrationSettings(settingsToSave);
      res.json({ ...settings, apiKey: settings.apiKey ? '********' : '' });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/google-places/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey } = req.body;
      const existingSettings = await storage.getIntegrationSettings('google_places');
      let keyToTest = apiKey;
      if (apiKey === '********' || !apiKey) keyToTest = existingSettings?.apiKey;

      if (!keyToTest) return res.status(400).json({ success: false, message: 'API key is required' });

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': keyToTest,
          'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify({ textQuery: 'test', pageSize: 1 }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ success: false, message: `Google Places API error: ${response.status} - ${errorText}` });
      }

      try {
        await storage.upsertIntegrationSettings({
          provider: 'google_places',
          apiKey: keyToTest,
          isEnabled: existingSettings?.isEnabled ?? false,
          ...(existingSettings?.locationId ? { locationId: existingSettings.locationId } : {}),
          ...(existingSettings?.calendarId ? { calendarId: existingSettings.calendarId } : {}),
        });
      } catch (saveErr) {
        return res.status(500).json({ success: false, message: `API key is valid but failed to save: ${(saveErr as Error).message}` });
      }

      res.json({ success: true, message: 'Google Places API connection successful' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  // ===============================
  // Telegram Integration Routes
  // ===============================

  app.get('/api/integrations/telegram', requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getTelegramSettings();
      if (!settings) {
        return res.json({ enabled: false, botToken: '', chatId: '' });
      }
      res.json({
        enabled: settings.enabled ?? false,
        botToken: settings.botToken ? '********' : '',
        chatId: settings.chatId ?? '',
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/telegram', requireAdmin, async (req, res) => {
    try {
      const parsed = telegramSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTelegramSettings();

      const tokenFromRequest = parsed.botToken && parsed.botToken !== '********'
        ? parsed.botToken.trim()
        : undefined;
      const botTokenToPersist = tokenFromRequest || existingSettings?.botToken;
      const chatId = parsed.chatId?.trim() ?? existingSettings?.chatId ?? '';
      const enabled = parsed.enabled ?? existingSettings?.enabled ?? false;

      if (enabled && (!botTokenToPersist || !chatId)) {
        return res.status(400).json({ message: 'Bot token and chat ID are required to enable Telegram notifications' });
      }

      const settingsToSave: any = {
        enabled,
        chatId: chatId || null,
      };

      if (tokenFromRequest) {
        settingsToSave.botToken = tokenFromRequest;
      } else if (existingSettings?.botToken) {
        settingsToSave.botToken = existingSettings.botToken;
      }

      const settings = await storage.saveTelegramSettings(settingsToSave);
      res.json({
        enabled: settings.enabled ?? false,
        botToken: settings.botToken ? '********' : '',
        chatId: settings.chatId ?? '',
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid Telegram settings payload', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/telegram/test', requireAdmin, async (req, res) => {
    try {
      const parsed = telegramSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTelegramSettings();

      const botToken = (parsed.botToken && parsed.botToken !== '********')
        ? parsed.botToken.trim()
        : existingSettings?.botToken;
      const chatId = parsed.chatId?.trim() || existingSettings?.chatId;

      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, message: 'Bot token and chat ID are required to test Telegram connection' });
      }

      const { sendTelegramMessage } = await import('../integrations/telegram.js');
      const result = await sendTelegramMessage({ botToken, chatId }, 'Test message from Skale Club - Your Telegram integration is working!');

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message || 'Failed to send test Telegram message' });
      }
      res.json({ success: true, message: 'Test Telegram message sent successfully!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
}
