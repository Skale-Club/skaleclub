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
      "Every slide MUST include a style object with bgColor and alignment at minimum. " +
      "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with natural Portuguese (pt-BR). " +
      "Use ONLY the approved brand color combinations. Return ALL slides for the complete presentation.",
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

// System prompt — enforces brand design system, layout rhythm, and content quality rules.
function buildGeneratorSystemPrompt(guidelines: string): string {
  return (
    "You are a senior presentation designer for Skale Club, a premium B2B marketing agency. " +
    "Create a complete, visually sophisticated deck using the generate_slides tool — never respond with plain text.\n\n" +

    "CRITICAL: Always invoke generate_slides with ALL slides. Never return partial decks.\n\n" +

    "=== STYLE OBJECT: REQUIRED ON EVERY SINGLE SLIDE ===\n" +
    "Every slide MUST have a style object with bgColor and alignment. No exceptions.\n\n" +

    "=== APPROVED COLOR COMBINATIONS — USE ONLY THESE ===\n" +
    "1. Dark Brand:      { bgColor: '#09090B', headingColor: '#6366F1', textColor: '#FFFFFF', alignment: 'left' }\n" +
    "2. Indigo Bold:     { bgColor: '#4F46E5', headingColor: '#FFFFFF', textColor: '#E0E7FF', alignment: 'center' }\n" +
    "3. Emerald Deep:    { bgColor: '#064E3B', headingColor: '#10B981', textColor: '#ECFDF5', alignment: 'left' }\n" +
    "4. Neutral Light:   { bgColor: '#F8FAFC', headingColor: '#18181B', textColor: '#3F3F46', alignment: 'left' }\n" +
    "5. Charcoal Surface:{ bgColor: '#18181B', headingColor: '#FFFFFF', textColor: '#A1A1AA', alignment: 'left' }\n\n" +
    "Rules: Cover and closing → Indigo Bold or Dark Brand. Vary across the deck — never the same bgColor 3 slides in a row.\n\n" +

    "=== LAYOUT RHYTHM: MANDATORY ===\n" +
    "- Use at least 4 DIFFERENT layouts per deck\n" +
    "- NEVER place 3+ text-only slides in sequence (text-only = title-body, bullets, section-break)\n" +
    "- After every 2 text slides, insert one visual: stats, image-left, image-right, quote, or full-bleed-image\n" +
    "- section-break: maximum 1 per 4 slides — sparingly, never consecutive\n" +
    "- Image layouts MUST have a real Unsplash photo URL in style.bgImageUrl\n\n" +

    "=== RECOMMENDED DECK STRUCTURE (8–12 slides) ===\n" +
    "1. cover          — strong specific title, Indigo Bold or Dark Brand\n" +
    "2. title-body     — context or problem statement\n" +
    "3. stats          — 2–4 specific data points\n" +
    "4. image-left or image-right — visual break with real Unsplash URL\n" +
    "5. bullets        — solution or approach, 3–5 specific bullets\n" +
    "6. two-column or quote — evidence or social proof\n" +
    "7. bullets        — next steps, actionable\n" +
    "8. closing        — clear CTA, Indigo Bold or Dark Brand\n\n" +

    "=== CONTENT RULES ===\n" +
    "- Bullets: 3–5 items, each under 8 words, specific to the presentation topic\n" +
    "- Stats: 2–4 numbers per slide, precise values (e.g. '47%' not '~50%' or '50%+')\n" +
    "- Body: 2–4 sentences max — never fill a slide with dense prose\n" +
    "- alignment: 'left' for content slides, 'center' only for cover/closing/quote\n\n" +
    "FORBIDDEN — never use these generic bullets or phrases:\n" +
    "'Strategic Alignment', 'Operational Efficiency', 'Market Penetration', 'Customer Satisfaction',\n" +
    "'Deep dive into the data', 'Comprehensive strategy presentation', 'In today's dynamic landscape'\n\n" +

    "=== BILINGUAL REQUIREMENT ===\n" +
    "All text fields in both languages (natural pt-BR, not machine-translated):\n" +
    "heading + headingPt | body + bodyPt | bullets + bulletsPt | stats labelPt | attribution + attributionPt\n\n" +

    "=== SLIDE LAYOUTS ===\n" +
    "cover: Hero slide. Dominant heading. Optional subtitle body. Strong brand bgColor. alignment: center.\n" +
    "section-break: Transition breath. Short bold heading only. Use sparingly.\n" +
    "title-body: Heading + 2–4 sentence paragraph. alignment: left.\n" +
    "bullets: Heading + 3–5 specific bullets under 8 words each. alignment: left.\n" +
    "stats: Heading + 2–4 precise numbers [{label, value, labelPt}]. alignment: left.\n" +
    "two-column: Heading (left col) + body (right col). Good for before/after or comparisons.\n" +
    "image-focus: Half image / half text. MUST have bgImageUrl. Real Unsplash URL required.\n" +
    "closing: Final CTA. alignment: center. Strong heading + clear body CTA. Brand bgColor.\n" +
    "image-left: Image panel left (~40%), text right. MUST have bgImageUrl.\n" +
    "image-right: Text left, image right (~40%). MUST have bgImageUrl.\n" +
    "full-bleed-image: Background image fills slide, text overlaid. MUST have bgImageUrl.\n" +
    "quote: Large pull-quote. heading = the quote. attribution = speaker name + attributionPt.\n\n" +

    "--- Brand Guidelines ---\n" +
    (guidelines || "(No brand guidelines set — use the color system and rules above)")
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
