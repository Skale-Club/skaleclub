import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";

type AuditFn = typeof createAuditLog;

export function registerPresentationTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  server.tool(
    "presentations_list",
    "List all presentations. Returns id, title, slug, version, slide count, and createdAt.",
    { search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
    async ({ search, limit = 50 }) => {
      const results = await storage.listPresentations(limit, 0, search);
      await audit({ tokenId, tokenPrefix, toolName: "presentations_list", action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "presentations_get",
    "Get a single presentation by id (UUID) or slug. Returns all slides.",
    { id: z.string().uuid().optional(), slug: z.string().optional() },
    async ({ id, slug }) => {
      if (!id && !slug) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide id or slug" }) }] };
      }
      const presentation = id
        ? await storage.getPresentation(id)
        : await storage.getPresentationBySlug(slug!);
      if (!presentation) {
        await audit({ tokenId, tokenPrefix, toolName: "presentations_get", action: "read", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Presentation not found" }) }] };
      }
      await audit({ tokenId, tokenPrefix, toolName: "presentations_get", targetType: "presentation", targetId: presentation.id, action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(presentation, null, 2) }] };
    }
  );

  server.tool(
    "presentations_create",
    "Create a blank presentation with a given title. Returns id and slug. Use presentations_generate to fill it with AI-generated slides.",
    { title: z.string().min(1).max(200) },
    async ({ title }) => {
      try {
        const slug = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now();
        const presentation = await storage.createPresentation({ title, slug, slides: [] });
        await audit({ tokenId, tokenPrefix, toolName: "presentations_create", targetType: "presentation", targetId: presentation.id, action: "create", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ id: presentation.id, slug: presentation.slug, title: presentation.title }) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "presentations_create", action: "create", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  server.tool(
    "presentations_update",
    "Send a chat instruction to update the slides of an existing presentation. The AI will apply the instruction and return updated slides. Provide the presentation id (UUID).",
    { id: z.string().uuid(), message: z.string().min(1).max(4000) },
    async ({ id, message }) => {
      const existing = await storage.getPresentation(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "presentations_update", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Presentation not found" }) }] };
      }

      // Dynamically import to avoid loading Gemini client at startup
      const { getGeminiClient } = await import("../../lib/gemini.js");
      const { getRuntimeGeminiKey } = await import("../../lib/ai-provider.js");
      const { slideBlockSchema } = await import("#shared/schema.js");
      const { z: zod } = await import("zod");

      const geminiIntegration = await storage.getChatIntegration("gemini");
      const apiKey = getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || geminiIntegration?.apiKey;
      if (!apiKey) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Gemini API not configured" }) }] };
      }

      const model = process.env.GEMINI_PRESENTATION_MODEL || geminiIntegration?.presentationModel || geminiIntegration?.model || "gemini-2.5-flash";
      const guidelinesRow = await storage.getBrandGuidelines();
      const guidelines = guidelinesRow?.content ?? "";

      const UPDATE_TOOL = {
        type: "function" as const,
        function: {
          name: "update_slides",
          description: "Replace the entire slides array. Return ALL slides.",
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
                    layout: { type: "string" },
                    heading: { type: "string" }, headingPt: { type: "string" },
                    body: { type: "string" }, bodyPt: { type: "string" },
                    bullets: { type: "array", items: { type: "string" } },
                    bulletsPt: { type: "array", items: { type: "string" } },
                    stats: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, labelPt: { type: "string" } } } },
                    attribution: { type: "string" }, attributionPt: { type: "string" },
                    style: { type: "object", properties: { bgColor: { type: "string" }, textColor: { type: "string" }, headingColor: { type: "string" }, alignment: { type: "string" }, bgImageUrl: { type: "string" } } },
                  },
                },
              },
            },
          },
        },
      };

      try {
        const client = getGeminiClient(apiKey);
        const systemPrompt = `You are a slide deck editor. Apply the instruction to the presentation. Always return ALL slides via update_slides tool.\n\n--- Brand Guidelines ---\n${guidelines || "Use professional defaults."}`;
        const userMessage = `Current slides:\n${JSON.stringify(existing.slides, null, 2)}\n\nInstruction: ${message}`;

        const response = await client.chat.completions.create({
          model, max_tokens: 8192,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
          tools: [UPDATE_TOOL],
          tool_choice: { type: "function", function: { name: "update_slides" } },
        });

        const toolCall = response.choices[0]?.message?.tool_calls?.[0];
        if (!toolCall) throw new Error("Gemini did not invoke update_slides");

        const rawInput = JSON.parse(toolCall.function.arguments);
        const validation = zod.array(slideBlockSchema).safeParse(rawInput.slides);
        if (!validation.success) throw new Error("Slide validation failed");

        await storage.updatePresentation(id, { slides: validation.data, guidelinesSnapshot: guidelines, version: existing.version + 1 });
        await audit({ tokenId, tokenPrefix, toolName: "presentations_update", targetType: "presentation", targetId: id, action: "update", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ id, slideCount: validation.data.length, version: existing.version + 1 }) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "presentations_update", action: "update", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );
}
