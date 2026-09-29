import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db.js";
import { translations } from "#shared/schema.js";
import { getActiveAIClient } from "../lib/ai-provider.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { requireAdmin } from "./_shared.js";
import { translations as staticDictionary } from "../../client/src/lib/translations.js";

/**
 * Dynamic AI-powered translation endpoint.
 * Caches translations in the `translations` DB table so the same string is only
 * sent to the AI once per (source, target) pair.
 */

// Sane upper bounds on a single request so an unauthenticated caller can't
// force unbounded AI provider calls (or an unbounded prompt) through this
// endpoint. Cache hits still short-circuit before any AI call is made.
const MAX_TEXTS_PER_REQUEST = 100;
const MAX_TEXT_LENGTH = 5_000;
const MAX_TOTAL_TEXT_LENGTH = 50_000;
const AI_TRANSLATE_TIMEOUT_MS = 20_000;

// Anonymous callers get a much tighter budget than the admin panel.
const ANON_MAX_TEXTS = 20;
const ANON_MAX_TEXT_LENGTH = 600;

// Global daily ceiling on AI provider calls (in-memory, per instance).
const DAILY_CAP = Number(process.env.TRANSLATE_DAILY_CAP) > 0 ? Number(process.env.TRANSLATE_DAILY_CAP) : 2000;
let dailyDay = "";
let dailyCount = 0;
function consumeDailyBudget(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== dailyDay) {
    dailyDay = day;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_CAP) return false;
  dailyCount += 1;
  return true;
}

const staticPt = staticDictionary.pt as Record<string, string>;

// The UI only ever ships English and Brazilian Portuguese
// (client/src/context/LanguageContext.tsx â†’ `Language`). Anything else would be
// free text handed to the AI provider and cached under an arbitrary key.
const SUPPORTED_LANGUAGES = ["en", "pt"] as const;
const languageSchema = z.enum(SUPPORTED_LANGUAGES);
const UNSUPPORTED_LANGUAGE_MESSAGE = `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}.`;

const translateRequestSchema = z.object({
  texts: z.array(z.string()),
  targetLanguage: languageSchema.default("pt"),
  sourceLanguage: languageSchema.default("en"),
});

export function registerTranslateRoutes(app: Express) {
  app.get("/api/translations/preload", async (req, res) => {
    const parsedLang = languageSchema.safeParse(req.query.lang || "pt");
    if (!parsedLang.success) {
      return res.status(400).json({ message: UNSUPPORTED_LANGUAGE_MESSAGE });
    }
    const lang = parsedLang.data;
    const cached = await db
      .select({ sourceText: translations.sourceText, translatedText: translations.translatedText })
      .from(translations)
      .where(and(eq(translations.sourceLanguage, "en"), eq(translations.targetLanguage, lang)));

    const result: Record<string, string> = {};
    cached.forEach((row) => {
      // Static dictionary ships with the client bundle; do not resend it.
      if (lang === "pt" && Object.prototype.hasOwnProperty.call(staticPt, row.sourceText)) return;
      result[row.sourceText] = row.translatedText;
    });
    const body = JSON.stringify({ translations: result });
    const etag = `"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type("application/json").send(body);
  });

  app.delete("/api/translations/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid translation id" });
    try {
      const deleted = await db.delete(translations).where(eq(translations.id, id)).returning({ id: translations.id });
      if (deleted.length === 0) return res.status(404).json({ message: "Translation not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[translate] DELETE /api/translations/:id failed:", err);
      res.status(500).json({ message: "Failed to delete translation" });
    }
  });

  app.post("/api/translations/purge-em-dashes", requireAdmin, async (_req, res) => {
    try {
      const updated = await db
        .update(translations)
        .set({ translatedText: sql`replace(${translations.translatedText}, '—', '|')`, updatedAt: new Date() })
        .where(sql`${translations.translatedText} like '%—%'`)
        .returning({ id: translations.id });
      res.json({ count: updated.length });
    } catch (err) {
      console.error("[translate] purge-em-dashes failed:", err);
      res.status(500).json({ message: "Failed to purge em-dashes" });
    }
  });

  app.post(
    "/api/translate",
    rateLimitMiddleware({
      limit: 30,
      windowMs: 60_000,
      message: "Too many translation requests. Please try again in a minute.",
    }),
    async (req, res) => {
      try {
        const parsedBody = translateRequestSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json({
            message: "Invalid translation request.",
            errors: parsedBody.error.errors,
          });
        }
        const { targetLanguage, sourceLanguage } = parsedBody.data;
        let texts = parsedBody.data.texts;
        const isAnonymous = !(req.session as any)?.userId;

        if (isAnonymous) {
          if (texts.length > ANON_MAX_TEXTS) {
            return res.status(400).json({ message: `Too many texts in one request (max ${ANON_MAX_TEXTS}).` });
          }
          if (texts.some((text) => text.length > ANON_MAX_TEXT_LENGTH)) {
            return res.status(400).json({ message: `Text too long (max ${ANON_MAX_TEXT_LENGTH} characters per string).` });
          }
        }

        if (texts.length > MAX_TEXTS_PER_REQUEST) {
          return res.status(400).json({
            message: `Too many texts in one request (max ${MAX_TEXTS_PER_REQUEST}).`,
          });
        }

        if (texts.some((text) => text.length > MAX_TEXT_LENGTH)) {
          return res.status(400).json({
            message: `Text too long (max ${MAX_TEXT_LENGTH} characters per string).`,
          });
        }

        const totalLength = texts.reduce((sum, text) => sum + text.length, 0);
        if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
          return res.status(400).json({
            message: `Combined text length too large (max ${MAX_TOTAL_TEXT_LENGTH} characters).`,
          });
        }

        // Texts already in the static dictionary never need the DB or the AI.
        const staticResult: Record<string, string> = {};
        if (sourceLanguage === "en" && targetLanguage === "pt") {
          for (const text of texts) {
            if (Object.prototype.hasOwnProperty.call(staticPt, text)) staticResult[text] = staticPt[text];
          }
          texts = texts.filter((text) => !(text in staticResult));
        }

        if (texts.length === 0) {
          return res.json({ translations: staticResult });
        }

        // Check cache for existing translations
        const cached = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.sourceLanguage, sourceLanguage),
              eq(translations.targetLanguage, targetLanguage),
              inArray(translations.sourceText, texts),
            ),
          );

        const cacheMap = new Map(cached.map((t) => [t.sourceText, t.translatedText]));
        const untranslated = texts.filter((text) => !cacheMap.has(text));

        // If all translations are cached, return immediately
        if (untranslated.length === 0) {
          const result: Record<string, string> = { ...staticResult };
          texts.forEach((text) => {
            result[text] = cacheMap.get(text)!;
          });
          return res.json({ translations: result });
        }

        if (!consumeDailyBudget()) {
          const result: Record<string, string> = { ...staticResult };
          texts.forEach((text) => {
            result[text] = cacheMap.get(text) || text;
          });
          return res.json({ translations: result });
        }

        // Use Gemini/OpenAI/etc to translate untranslated texts
        const aiClient = await getActiveAIClient();
        if (!aiClient || !aiClient.client) {
          // Fallback: return original texts
          const result: Record<string, string> = { ...staticResult };
          texts.forEach((text) => {
            result[text] = cacheMap.get(text) || text;
          });
          return res.json({ translations: result });
        }

        const sourceLangLabel = sourceLanguage === "pt" ? "Brazilian Portuguese (pt-BR)" : "English";
        const targetLangLabel = targetLanguage === "pt" ? "Brazilian Portuguese (pt-BR)" : "English";
        // The source label is a hint, not a guarantee: English page copy has been sent
        // labelled as Portuguese, and the AI "translated" it into Portuguese.
        const prompt = `Translate the following texts from ${sourceLangLabel} to ${targetLangLabel}.
Some texts may already be written in ${targetLangLabel}; return those exactly unchanged. Never answer in any language other than ${targetLangLabel}.
Return ONLY a JSON object where keys are the original texts and values are the translations.
Do not add any explanations or markdown formatting. Just pure JSON.
Never use em-dashes; use a comma, period or | instead.

Texts to translate:
${untranslated.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

        // Fail fast instead of the SDK default (10-minute timeout, 2 retries). The client
        // gives up sooner; finishing here still caches the result for the next visit.
        const completion = await aiClient.client.chat.completions.create(
          {
            model: aiClient.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          },
          { timeout: AI_TRANSLATE_TIMEOUT_MS, maxRetries: 0 },
        );

        const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
        let translationsFromAI: Record<string, string> = {};

        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            translationsFromAI = JSON.parse(jsonMatch[0]);
          }
        } catch (parseErr) {
          console.error("Failed to parse AI translation response:", parseErr);
        }

        // Save new translations to database
        const toInsert = untranslated
          .filter((text) => translationsFromAI[text])
          .map((text) => ({
            sourceText: text,
            sourceLanguage,
            targetLanguage,
            translatedText: translationsFromAI[text],
          }));

        if (toInsert.length > 0) {
          await db.insert(translations).values(toInsert).onConflictDoNothing();
        }

        // Combine cached and new translations
        const result: Record<string, string> = { ...staticResult };
        texts.forEach((text) => {
          result[text] = cacheMap.get(text) || translationsFromAI[text] || text;
        });

        res.json({ translations: result });
      } catch (err) {
        console.error("Translation error:", err);
        // Fallback: return original texts
        const fallbackTexts = Array.isArray(req.body?.texts) ? req.body.texts : [];
        const result: Record<string, string> = {};
        fallbackTexts.forEach((text: string) => {
          result[text] = text;
        });
        res.json({ translations: result });
      }
    },
  );
}
