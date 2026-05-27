/**
 * Estimate translator — populates PT fields on EstimateServiceItem[] using
 * the active AI provider (Gemini via OpenAI-compat). Reuses the same client
 * factory and prompt style as server/routes/translate.ts.
 *
 * Idempotent: services where all PT fields are already populated are skipped.
 */

import { getActiveAIClient } from "./ai-provider.js";
import type { EstimateServiceItem } from "#shared/schema.js";

// Fields on a service item that have an EN → PT pair.
const FIELD_PAIRS = [
  ["title", "titlePt"],
  ["subtitle", "subtitlePt"],
  ["description", "descriptionPt"],
  ["price", "pricePt"],
  ["section", "sectionPt"],
] as const;

function isFullyTranslated(svc: EstimateServiceItem): boolean {
  const anyMissingScalar = FIELD_PAIRS.some(([en, pt]) => {
    const enVal = (svc as Record<string, unknown>)[en];
    const ptVal = (svc as Record<string, unknown>)[pt];
    return typeof enVal === "string" && enVal.length > 0 && (typeof ptVal !== "string" || ptVal.length === 0);
  });
  if (anyMissingScalar) return false;

  const features = svc.features ?? [];
  const featuresPt = (svc as { featuresPt?: string[] }).featuresPt ?? [];
  if (features.length > 0 && featuresPt.length !== features.length) return false;

  return true;
}

/**
 * Translate the EN fields of selected services into Brazilian Portuguese.
 * - onlyIndexes omitted → translate every service that needs it
 * - returns a NEW services array (does not mutate input)
 * - services already fully translated are returned unchanged
 */
export async function translateServicesToPt(
  services: EstimateServiceItem[],
  onlyIndexes?: number[],
): Promise<{ services: EstimateServiceItem[]; translatedCount: number; skippedCount: number }> {
  const aiClient = await getActiveAIClient();
  if (!aiClient || !aiClient.client) {
    throw new Error("No active AI provider configured. Set up Gemini/OpenAI in Admin → Integrations.");
  }

  const out = [...services];
  let translatedCount = 0;
  let skippedCount = 0;

  const targets = (onlyIndexes ?? services.map((_, i) => i)).filter(
    (i) => i >= 0 && i < services.length,
  );

  for (const idx of targets) {
    const svc = out[idx];
    if (isFullyTranslated(svc)) {
      skippedCount++;
      continue;
    }

    // Build a single payload for this service: { en_title, en_subtitle, ... en_features: [...] }
    const payload: Record<string, string | string[]> = {};
    for (const [enField] of FIELD_PAIRS) {
      const v = (svc as Record<string, unknown>)[enField];
      if (typeof v === "string" && v.length > 0) payload[enField] = v;
    }
    if (svc.features && svc.features.length > 0) payload.features = svc.features;

    if (Object.keys(payload).length === 0) {
      skippedCount++;
      continue;
    }

    const prompt = [
      "Translate the following English service-item fields to Brazilian Portuguese (pt-BR).",
      "",
      "STRICT RULES:",
      '- Preserve pipes (|) exactly. Never replace them with em-dashes (—) or hyphens (-).',
      "- Preserve all dollar amounts, percentages, and numeric values as-is (e.g. $600/month becomes $600/mês).",
      '- Preserve brand names exactly: Vita Cell, Skale Club, Xphere, Xkedule, ManyChat, Twilio, Google, Meta, Instagram, Facebook, WhatsApp, SMS, ChatGPT, Perplexity, MedSpa.',
      "- Translate 'month' to 'mês', 'one-time' to 'pagamento único', 'setup' stays 'setup', 'hosting' to 'hospedagem'.",
      "- Tone: warm, confident, professional. Same voice as the English source.",
      "- For 'section' values use these exact translations: Foundation→Base, Growth Engine→Motor de Crescimento, Must Have→Essencial.",
      "",
      "Return ONLY a JSON object with the SAME keys as the input, values translated. For the 'features' key, return an array of the same length, each element translated.",
      "Do not add explanations or markdown fences. Pure JSON.",
      "",
      "Input:",
      JSON.stringify(payload, null, 2),
    ].join("\n");

    const completion = await aiClient.client.chat.completions.create({
      model: aiClient.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let translated: Record<string, string | string[]> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) translated = JSON.parse(jsonMatch[0]);
    } catch {
      // Skip this service on parse failure; surface count in result
      skippedCount++;
      continue;
    }

    // Merge translated PT fields onto the service item
    const merged = { ...svc } as Record<string, unknown>;
    for (const [enField, ptField] of FIELD_PAIRS) {
      const v = translated[enField];
      if (typeof v === "string" && v.length > 0) merged[ptField] = v;
    }
    if (
      Array.isArray(translated.features) &&
      svc.features &&
      translated.features.length === svc.features.length
    ) {
      merged.featuresPt = translated.features;
    }
    out[idx] = merged as EstimateServiceItem;
    translatedCount++;
  }

  return { services: out, translatedCount, skippedCount };
}
