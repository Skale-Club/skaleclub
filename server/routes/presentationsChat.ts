import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";
import { getGeminiClient } from "../lib/gemini.js";
import { getRuntimeGeminiKey } from "../lib/ai-provider.js";
import { slideBlockSchema } from "#shared/schema.js";

// OpenAI-compatible tool definition (Gemini via OpenAI-compat endpoint).
const UPDATE_SLIDES_TOOL = {
  type: "function" as const,
  function: {
    name: "update_slides",
    description:
      "Replace the entire slides array for this presentation. " +
      "Always return ALL slides — preserve unmodified slides verbatim as provided in the current slides context. " +
      "Every slide MUST include a style object with bgColor and alignment. " +
      "Preserve the style of unmodified slides exactly as received. " +
      "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with natural Portuguese (pt-BR). " +
      "When editing a specific slide, return all other slides byte-for-byte identical to the input.",
    parameters: {
      type: "object",
      required: ["slides"],
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            required: ["layout", "style"],
            properties: {
              layout: {
                type: "string",
                enum: [
                  "cover", "section-break", "title-body", "bullets", "stats",
                  "two-column", "image-focus", "closing",
                  "image-left", "image-right", "full-bleed-image", "quote",
                ],
              },
              heading:   { type: "string" },
              headingPt: { type: "string" },
              body:      { type: "string" },
              bodyPt:    { type: "string" },
              bullets:   { type: "array", items: { type: "string" } },
              bulletsPt: { type: "array", items: { type: "string" } },
              stats: {
                type: "array",
                items: {
                  type: "object",
                  required: ["label", "value"],
                  properties: {
                    label:   { type: "string" },
                    value:   { type: "string" },
                    labelPt: { type: "string" },
                  },
                },
              },
              attribution:   { type: "string" },
              attributionPt: { type: "string" },
              style: {
                type: "object",
                required: ["bgColor", "alignment"],
                properties: {
                  bgColor:      { type: "string" },
                  textColor:    { type: "string" },
                  headingColor: { type: "string" },
                  alignment:    { type: "string", enum: ["left", "center", "right"] },
                  bgImageUrl:   { type: "string" },
                  bgVideoUrl:   { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

function buildSystemPrompt(guidelinesContent: string): string {
  return (
    "You are a senior presentation designer for Skale Club, a premium B2B marketing agency. " +
    "Edit or improve the presentation slides using the update_slides tool — never respond with plain text.\n\n" +

    "CRITICAL: Always return ALL slides in the deck. Preserve unmodified slides exactly as received in the context.\n\n" +

    "=== STYLE OBJECT: REQUIRED ON EVERY SLIDE ===\n" +
    "Every slide MUST have a style object with bgColor and alignment. " +
    "For slides you are not modifying, copy their existing style exactly. " +
    "For slides you create or rewrite, use an approved color combination.\n\n" +

    "=== APPROVED COLOR COMBINATIONS — USE ONLY THESE ===\n" +
    "1. Dark Brand:      { bgColor: '#09090B', headingColor: '#6366F1', textColor: '#FFFFFF', alignment: 'left' }\n" +
    "2. Indigo Bold:     { bgColor: '#4F46E5', headingColor: '#FFFFFF', textColor: '#E0E7FF', alignment: 'center' }\n" +
    "3. Emerald Deep:    { bgColor: '#064E3B', headingColor: '#10B981', textColor: '#ECFDF5', alignment: 'left' }\n" +
    "4. Neutral Light:   { bgColor: '#F8FAFC', headingColor: '#18181B', textColor: '#3F3F46', alignment: 'left' }\n" +
    "5. Charcoal Surface:{ bgColor: '#18181B', headingColor: '#FFFFFF', textColor: '#A1A1AA', alignment: 'left' }\n\n" +

    "=== LAYOUT RHYTHM (when adding or restructuring slides) ===\n" +
    "- Never place 3+ text-only slides in sequence (text-only = title-body, bullets, section-break)\n" +
    "- After every 2 text slides, the next should be visual: stats, image-left, image-right, quote, or full-bleed-image\n" +
    "- Image layouts (image-left, image-right, full-bleed-image, image-focus) MUST have a real Unsplash photo URL in style.bgImageUrl\n\n" +

    "=== CONTENT RULES ===\n" +
    "- Bullets: 3–5 items, each under 8 words, specific to the topic\n" +
    "- Stats: precise values (e.g. '47%' not '~50%')\n" +
    "- Body: 2–4 sentences max\n" +
    "- alignment: 'left' for content slides, 'center' only for cover/closing/quote\n\n" +
    "FORBIDDEN generic bullets — never use: 'Strategic Alignment', 'Operational Efficiency', " +
    "'Market Penetration', 'Customer Satisfaction', 'Deep dive into the data'\n\n" +

    "=== BILINGUAL REQUIREMENT ===\n" +
    "All text fields in both languages (natural pt-BR): " +
    "heading + headingPt | body + bodyPt | bullets + bulletsPt | stats labelPt | attribution + attributionPt\n\n" +

    "=== SLIDE LAYOUTS ===\n" +
    "cover: Hero slide. Dominant heading. Optional subtitle body. Strong brand bgColor. alignment: center.\n" +
    "section-break: Transition breath. Short bold heading. Use sparingly — max 1 per 4 slides.\n" +
    "title-body: Heading + 2–4 sentence paragraph. alignment: left.\n" +
    "bullets: Heading + 3–5 specific bullets under 8 words each.\n" +
    "stats: Heading + 2–4 precise numbers [{label, value, labelPt}].\n" +
    "two-column: Heading left + body right. Good for comparisons.\n" +
    "image-focus: Half image / half text. MUST have bgImageUrl.\n" +
    "closing: Final CTA. alignment: center. Strong heading + body CTA. Brand bgColor.\n" +
    "image-left: Image panel left (~40%), text right. MUST have bgImageUrl.\n" +
    "image-right: Text left, image right (~40%). MUST have bgImageUrl.\n" +
    "full-bleed-image: Background image fills slide, text overlaid. MUST have bgImageUrl.\n" +
    "quote: heading = the quote text. attribution = speaker name + attributionPt.\n\n" +

    "--- Brand Guidelines ---\n" +
    (guidelinesContent || "(No brand guidelines set — use the color system and rules above)")
  );
}

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
});

export function registerPresentationsChatRoutes(app: Express) {
  // POST /api/presentations/:id/chat
  // Admin-auth required. Accepts { message: string }.
  // Returns text/event-stream SSE with progress, done, or error events.
  // Uses Gemini via the admin-configured API key (chat_integrations.gemini.apiKey),
  // with the same model-resolution priority as the generator route.
  app.post("/api/presentations/:id/chat", requireAdmin, async (req, res) => {
    // 1. Validate body BEFORE SSE headers
    const bodyParsed = chatBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ message: "message is required and must be 1–4000 characters" });
    }

    // 2. Resolve Gemini key from admin integrations (no env requirement)
    const geminiIntegration = await storage.getChatIntegration("gemini");
    const apiKey =
      getRuntimeGeminiKey() ||
      process.env.GEMINI_API_KEY ||
      geminiIntegration?.apiKey;

    if (!apiKey) {
      return res.status(503).json({
        message: "Gemini API not configured — configure the Gemini integration in Admin → Integrations",
      });
    }

    // Model resolution priority (same as generator):
    //   1. process.env.GEMINI_PRESENTATION_MODEL — emergency deploy-time override
    //   2. chat_integrations.gemini.presentation_model — admin UI selector
    //   3. chat_integrations.gemini.model — chat model fallback
    //   4. gemini-2.5-flash — safe default (tool calling on OpenAI-compat endpoint)
    const model =
      process.env.GEMINI_PRESENTATION_MODEL ||
      geminiIntegration?.presentationModel ||
      geminiIntegration?.model ||
      "gemini-2.5-flash";

    // 3. Load presentation + guidelines BEFORE SSE
    const existing = await storage.getPresentation(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Presentation not found" });
    }
    const guidelinesRow = await storage.getBrandGuidelines();
    const guidelines = guidelinesRow?.content ?? "";

    // 4. Open SSE — all subsequent errors must be SSE events, not res.json()
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Heartbeat so the client can show a spinner immediately
    res.write(`data: ${JSON.stringify({ type: "progress" })}\n\n`);

    try {
      const client = getGeminiClient(apiKey);

      const userMessage =
        `Current slides:\n${JSON.stringify(existing.slides, null, 2)}\n\nInstruction: ${bodyParsed.data.message}`;

      let response;
      try {
        response = await client.chat.completions.create({
          model,
          max_tokens: 8192,
          messages: [
            { role: "system", content: buildSystemPrompt(guidelines) },
            { role: "user", content: userMessage },
          ],
          tools: [UPDATE_SLIDES_TOOL],
          tool_choice: { type: "function", function: { name: "update_slides" } },
        });
      } catch (sdkErr) {
        const err = sdkErr as { status?: number; message?: string };
        res.write(`data: ${JSON.stringify({
          type: "error",
          message: `Gemini API error (model=${model}, status=${err.status ?? "unknown"}): ${err.message ?? "no message"}`,
        })}\n\n`);
        res.end();
        return;
      }

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") {
        res.write(`data: ${JSON.stringify({
          type: "error",
          message: `Gemini did not invoke the update_slides tool (model=${model})`,
        })}\n\n`);
        res.end();
        return;
      }

      const rawInput = JSON.parse(toolCall.function.arguments);
      const validation = z.array(slideBlockSchema).safeParse(rawInput.slides);
      if (!validation.success) {
        res.write(`data: ${JSON.stringify({
          type: "error",
          message: "Gemini returned slides that failed Zod validation",
        })}\n\n`);
        res.end();
        return;
      }

      await storage.updatePresentation(req.params.id, {
        slides: validation.data,
        guidelinesSnapshot: guidelines,
        version: existing.version + 1,
      });

      res.write(`data: ${JSON.stringify({ type: "done", slides: validation.data })}\n\n`);
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
      res.end();
    }
  });
}
