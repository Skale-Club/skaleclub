import type { Express } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { translations } from "#shared/schema.js";
import { getActiveAIClient } from "../lib/ai-provider.js";

/**
 * Dynamic AI-powered translation endpoint.
 * Caches translations in the `translations` DB table so the same string is only
 * sent to the AI once per (source, target) pair.
 */
export function registerTranslateRoutes(app: Express) {
  app.get("/api/translations/preload", async (req, res) => {
    const lang = (req.query.lang as string) || "pt";
    const cached = await db
      .select({ sourceText: translations.sourceText, translatedText: translations.translatedText })
      .from(translations)
      .where(and(eq(translations.sourceLanguage, "en"), eq(translations.targetLanguage, lang)));

    const result: Record<string, string> = {};
    cached.forEach((row) => { result[row.sourceText] = row.translatedText; });
    res.json({ translations: result });
  });

  app.post("/api/translate", async (req, res) => {
    try {
      const { texts, targetLanguage = "pt" } = z
        .object({
          texts: z.array(z.string()),
          targetLanguage: z.string().default("pt"),
        })
        .parse(req.body);

      if (texts.length === 0) {
        return res.json({ translations: {} });
      }

      // Check cache for existing translations
      const cached = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.sourceLanguage, "en"),
            eq(translations.targetLanguage, targetLanguage),
            inArray(translations.sourceText, texts),
          ),
        );

      const cacheMap = new Map(cached.map((t) => [t.sourceText, t.translatedText]));
      const untranslated = texts.filter((text) => !cacheMap.has(text));

      // If all translations are cached, return immediately
      if (untranslated.length === 0) {
        const result: Record<string, string> = {};
        texts.forEach((text) => {
          result[text] = cacheMap.get(text)!;
        });
        return res.json({ translations: result });
      }

      // Use Gemini/OpenAI/etc to translate untranslated texts
      const aiClient = await getActiveAIClient();
      if (!aiClient || !aiClient.client) {
        // Fallback: return original texts
        const result: Record<string, string> = {};
        texts.forEach((text) => {
          result[text] = cacheMap.get(text) || text;
        });
        return res.json({ translations: result });
      }

      const prompt = `Translate the following English texts to ${targetLanguage === "pt" ? "Brazilian Portuguese (pt-BR)" : targetLanguage}.
Return ONLY a JSON object where keys are the original English texts and values are the translations.
Do not add any explanations or markdown formatting. Just pure JSON.

Texts to translate:
${untranslated.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

      const completion = await aiClient.client.chat.completions.create({
        model: aiClient.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

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
          sourceLanguage: "en" as const,
          targetLanguage,
          translatedText: translationsFromAI[text],
        }));

      if (toInsert.length > 0) {
        await db.insert(translations).values(toInsert).onConflictDoNothing();
      }

      // Combine cached and new translations
      const result: Record<string, string> = {};
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
  });
}
