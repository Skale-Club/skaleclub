import type { Express } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";
import { getAnthropicClient } from "../lib/anthropic.js";
import { slideBlockSchema } from "#shared/schema.js";

// Hand-written JSON Schema for the update_slides tool.
// zod-to-json-schema is NOT installed — use this static definition.
// Must satisfy @anthropic-ai/sdk Tool interface (input_schema.type must be "object").
const UPDATE_SLIDES_TOOL: Anthropic.Tool = {
  name: "update_slides",
  description:
    "Replace the entire slides array for this presentation. " +
    "Always return ALL slides — preserve unmodified slides verbatim as provided in the current slides context. " +
    "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with Portuguese (pt-BR) translations. " +
    "When editing a specific slide, return all other slides byte-for-byte identical to the input.",
  input_schema: {
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
              enum: ["cover", "section-break", "title-body", "bullets", "stats", "two-column", "image-focus", "closing"],
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
          },
        },
      },
    },
  },
};

// System prompt template — brand guidelines injected at request time
function buildSystemPrompt(guidelinesContent: string): string {
  return (
    "You are a slide deck author for a professional marketing agency. " +
    "Your task is to create or edit presentation slides following the brand guidelines below.\n\n" +
    "Always output slides using the update_slides tool — never respond with plain text.\n" +
    "Each slide must have a \"layout\" field matching one of: cover, section-break, title-body, bullets, stats, two-column, image-focus, closing.\n" +
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
  // PRES-11, PRES-12, PRES-13
  // POST /api/presentations/:id/chat
  // Admin-auth required. Accepts { message: string }.
  // Returns text/event-stream SSE with progress, done, or error events.
  // max_tokens: 4096 — covers ~15 slides comfortably; increase if needed for larger decks.
  app.post("/api/presentations/:id/chat", requireAdmin, async (req, res) => {
    // 1. Validate request body — must happen before SSE headers
    const bodyParsed = chatBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ message: "message is required and must be 1–4000 characters" });
    }

    // 2. Pre-flight: verify Anthropic key is configured before committing to SSE headers
    try {
      getAnthropicClient();
    } catch {
      return res.status(503).json({ message: "Anthropic API not configured — set ANTHROPIC_API_KEY" });
    }

    // 3. Load presentation + brand guidelines — both needed before SSE starts
    const existing = await storage.getPresentation(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Presentation not found" });
    }
    const guidelinesRow = await storage.getBrandGuidelines();
    const guidelines = guidelinesRow?.content ?? "";

    // 4. Set SSE headers and flush BEFORE any streaming begins.
    // After this point all errors must go through data: {"type":"error",...} — never res.json() or next(err).
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const client = getAnthropicClient();

      // PRES-13: full current slides injected so Claude can preserve untouched slides verbatim
      const userMessage =
        `Current slides:\n${JSON.stringify(existing.slides, null, 2)}\n\nInstruction: ${bodyParsed.data.message}`;

      const stream = client.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystemPrompt(guidelines),
        messages: [{ role: "user", content: userMessage }],
        tools: [UPDATE_SLIDES_TOOL],
        // Force tool invocation — prevents Claude from responding in plain text
        tool_choice: { type: "tool", name: "update_slides" },
      });

      // Stream progress ticks to client so UI can show a spinner
      stream.on("inputJson", () => {
        res.write(`data: ${JSON.stringify({ type: "progress" })}\n\n`);
      });

      // finalMessage() resolves when the stream ends with all content blocks accumulated
      const finalMsg = await stream.finalMessage();

      const toolBlock = finalMsg.content.find(b => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Claude did not invoke the update_slides tool" })}\n\n`);
        res.end();
        return;
      }

      // PRES-12: Zod validation on every DB write
      const validation = z.array(slideBlockSchema).safeParse(
        (toolBlock.input as { slides?: unknown }).slides
      );
      if (!validation.success) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Claude returned slides that failed Zod validation" })}\n\n`);
        res.end();
        return;
      }

      // PRES-11: Persist slides + guidelinesSnapshot; version = existing.version + 1 (same pattern as PUT route)
      await storage.updatePresentation(req.params.id, {
        slides: validation.data,
        guidelinesSnapshot: guidelines,
        version: existing.version + 1,
      });

      res.write(`data: ${JSON.stringify({ type: "done", slides: validation.data })}\n\n`);
      res.end();

    } catch (err) {
      // SSE headers already sent — must write error as SSE event, not res.json()
      res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
      res.end();
    }
  });
}
