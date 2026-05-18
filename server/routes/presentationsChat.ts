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
      "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with Portuguese (pt-BR) translations. " +
      "When editing a specific slide, return all other slides byte-for-byte identical to the input.",
    parameters: {
      type: "object",
      required: ["slides"],
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            required: ["layout"],
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
    "You are a slide deck author for a professional marketing agency. " +
    "Your task is to create or edit presentation slides following the brand guidelines below.\n\n" +
    "Always output slides using the update_slides tool — never respond with plain text.\n" +
    "Each slide must have a \"layout\" field matching one of: cover, section-break, title-body, bullets, stats, two-column, image-focus, closing, image-left, image-right, full-bleed-image, quote.\n" +
    "New layouts — image-left: image panel (~40%) left + text right; image-right: text left + image panel (~40%) right; full-bleed-image: background image fills entire slide with text overlay; quote: large centered pull-quote with optional attribution.\n" +
    "Use the style object to set bgColor (CSS color or gradient), textColor, headingColor, alignment ('left'|'center'|'right'), bgImageUrl (public URL), bgVideoUrl (public video URL).\n" +
    "Use attribution/attributionPt fields for the quote layout speaker attribution.\n" +
    "Always provide both English and Portuguese (pt-BR) versions of text fields (heading/headingPt, body/bodyPt, bullets/bulletsPt).\n" +
    "When editing specific slides, preserve ALL other slides exactly as provided in the current slides context.\n\n" +
    "--- Brand Guidelines ---\n" +
    (guidelinesContent || "(No brand guidelines set — use professional marketing defaults)")
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
