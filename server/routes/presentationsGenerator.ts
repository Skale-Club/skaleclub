import type { Express } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "../storage.js";
import { slideBlockSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";
import { getGeminiClient } from "../lib/gemini.js";
import { getRuntimeGeminiKey, getRuntimeGroqKey } from "../lib/ai-provider.js";

// Duplicated verbatim from presentations.ts — self-contained, no shared utility to avoid coupling.
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "presentation";
}

async function buildUniquePresentationSlug(title: string): Promise<string> {
  const base = slugifyTitle(title);
  if (!await storage.getPresentationBySlug(base)) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!await storage.getPresentationBySlug(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// OpenAI-compatible tool definition (NOT Anthropic format).
// tool_choice must use { type: "function", function: { name } } when calling Gemini via OpenAI SDK.
const GENERATE_SLIDES_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_slides",
    description:
      "Generate a complete slide deck from scratch based on the provided context. " +
      "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with Portuguese (pt-BR). " +
      "Use brand-coherent colors in style.bgColor and style.headingColor. " +
      "Return ALL slides for the complete presentation.",
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
              heading:       { type: "string" },
              headingPt:     { type: "string" },
              body:          { type: "string" },
              bodyPt:        { type: "string" },
              bullets:       { type: "array", items: { type: "string" } },
              bulletsPt:     { type: "array", items: { type: "string" } },
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

// System prompt — describes all 12 layouts, bilingual requirement, and brand guidelines.
function buildGeneratorSystemPrompt(guidelines: string): string {
  return (
    "You are a professional slide deck author for a marketing agency. " +
    "Your task is to create a complete presentation from scratch using the generate_slides tool — never respond with plain text.\n\n" +
    "Always invoke the generate_slides tool with ALL slides for the complete deck.\n" +
    "Populate bilingual text fields: heading/headingPt, body/bodyPt, bullets/bulletsPt (Portuguese pt-BR).\n" +
    "Use brand-coherent colors in style.bgColor and style.headingColor when appropriate.\n\n" +
    "--- Slide Layouts ---\n" +
    "cover: Title slide. Large heading, optional body subtitle. Use style.bgColor + style.headingColor for brand impact.\n" +
    "section-break: Transition slide between major topics. Bold heading, optional short body.\n" +
    "title-body: Main content slide. Heading + paragraph body.\n" +
    "bullets: List of key points. Heading + bullets array (3–6 items). Use bulletsPt for Portuguese.\n" +
    "stats: Data/metrics slide. Heading + stats array [{label, value, labelPt}]. Highlight numbers.\n" +
    "two-column: Two content columns. Heading + body (split into columns by the renderer).\n" +
    "image-focus: Visual-first slide. Heading + optional body. bgImageUrl in style for background.\n" +
    "closing: Final CTA slide. Heading + body. Use brand primary color.\n" +
    "image-left: Image on left half, text on right. Provide bgImageUrl in style.\n" +
    "image-right: Text on left, image on right half. Provide bgImageUrl in style.\n" +
    "full-bleed-image: Full-bleed background image. Heading overlaid. Provide bgImageUrl in style.\n" +
    "quote: Pull-quote slide. body = the quote text, attribution = speaker name (also attributionPt).\n\n" +
    "--- Brand Guidelines ---\n" +
    (guidelines || "(No brand guidelines set — use professional marketing defaults)")
  );
}

const transcribeBodySchema = z.object({
  audioData: z.string().min(1),
});

const generateBodySchema = z.object({
  title:  z.string().min(1).max(200),
  prompt: z.string().min(1).max(8000),
});

export function registerPresentationsGeneratorRoutes(app: Express) {
  // POST /api/presentations/transcribe (D-05)
  // Admin-only. Accepts { audioData: base64 }. Returns { transcription: string }.
  // Uses Groq Whisper whisper-large-v3.
  app.post("/api/presentations/transcribe", requireAdmin, async (req, res) => {
    try {
      const parsed = transcribeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const groqKey =
        getRuntimeGroqKey() ||
        (await storage.getChatIntegration("groq"))?.apiKey;

      if (!groqKey) {
        return res.status(503).json({
          message: "Groq API not configured — set GROQ_API_KEY or configure in admin",
        });
      }

      const base64Data = parsed.data.audioData.replace(/^data:audio\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey: groqKey });
      const transcription = await groq.audio.transcriptions.create({
        file: new File([buffer], `prompt_${Date.now()}.webm`, { type: "audio/webm" }),
        model: "whisper-large-v3",
        response_format: "text",
      });

      const text = (transcription as unknown as string).trim();
      return res.json({ transcription: text });
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  // POST /api/presentations/generate (D-08 through D-14)
  // Admin-only. Accepts { title, prompt }. Calls Gemini with forced generate_slides tool.
  // Zod-validates slides, persists via storage.createPresentation, returns { id, slug }.
  app.post("/api/presentations/generate", requireAdmin, async (req, res) => {
    try {
      const parsed = generateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const geminiIntegration = await storage.getChatIntegration("gemini");
      const apiKey =
        getRuntimeGeminiKey() ||
        process.env.GEMINI_API_KEY ||
        geminiIntegration?.apiKey;

      if (!apiKey) {
        return res.status(503).json({
          message: "Gemini API not configured — set GEMINI_API_KEY or configure in admin",
        });
      }

      // Model resolution priority:
      //   1. process.env.GEMINI_PRESENTATION_MODEL — emergency override (deploy-time)
      //   2. chat_integrations.gemini.presentation_model — admin UI "Presentation model" selector
      //   3. chat_integrations.gemini.model            — falls back to the chat model
      //   4. gemini-2.5-flash                          — safe default (supports tool calling,
      //                                                  works on the OpenAI-compat endpoint;
      //                                                  gemini-2.0-flash 404s on that endpoint)
      const model =
        process.env.GEMINI_PRESENTATION_MODEL ||
        geminiIntegration?.presentationModel ||
        geminiIntegration?.model ||
        "gemini-2.5-flash";

      const guidelinesRow = await storage.getBrandGuidelines();
      const guidelines = guidelinesRow?.content ?? "";

      const client = getGeminiClient(apiKey);
      let response;
      try {
        response = await client.chat.completions.create({
          model,
          max_tokens: 8192,
          messages: [
            { role: "system", content: buildGeneratorSystemPrompt(guidelines) },
            { role: "user", content: parsed.data.prompt },
          ],
          tools: [GENERATE_SLIDES_TOOL],
          tool_choice: { type: "function", function: { name: "generate_slides" } },
        });
      } catch (sdkErr) {
        // Surface model + status so a stale model identifier is obvious from the error toast.
        const err = sdkErr as { status?: number; message?: string };
        return res.status(502).json({
          message: `Gemini API error (model=${model}, status=${err.status ?? "unknown"}): ${err.message ?? "no message"}`,
        });
      }

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") {
        return res.status(500).json({
          message: `Gemini did not invoke the generate_slides tool (model=${model})`,
        });
      }

      const rawInput = JSON.parse(toolCall.function.arguments);
      const validation = z.array(slideBlockSchema).safeParse(rawInput.slides);
      if (!validation.success) {
        return res.status(422).json({
          message: "Generated slides failed validation",
          errors: validation.error.errors,
        });
      }

      const slug = await buildUniquePresentationSlug(parsed.data.title);
      // guidelinesSnapshot passed DIRECTLY to storage — NOT through insertPresentationSchema (which omits it)
      const presentation = await storage.createPresentation({
        title: parsed.data.title,
        slug,
        slides: validation.data,
        guidelinesSnapshot: guidelines,
      });

      return res.status(201).json({ id: presentation.id, slug: presentation.slug });
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });
}
