// Lead captured by the WhatsApp-style chat that opens from the site's WhatsApp
// buttons (client/src/components/layout/WhatsAppChat.tsx). The visitor gives a
// name and a phone number before being handed to wa.me, so the team can reach
// out when the WhatsApp message never arrives.
//
// The lead goes through the normal pipeline (form_leads row, team
// notification, attribution, Xphere handoff). Xphere receives it with
// `source.form = "whatsapp-chat"` and these answers, which is what a follow-up
// automation should key off:
//   whatsappPageRef — same page reference the pre-filled message ends with
//   whatsappEntry   — which button opened the chat (floating_button, mobile_bar)
//   countryCode     — country picked in the phone field
//   lang            — derived by serializeLeadForXphere (pt-BR | en)
import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage.js";
import { DEFAULT_FORM_CONFIG } from "#shared/form.js";
import type { FormConfig } from "#shared/schema.js";
import { runLeadPostProcessing } from "../lib/lead-processing.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { isBotSubmission } from "../lib/botTrap.js";

export const WHATSAPP_CHAT_FORM_SLUG = "whatsapp-chat";

const whatsappChatLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  // E.164, built client-side from the picked country + the typed number.
  phone: z.string().trim().regex(/^\+\d{8,15}$/, "Invalid phone number"),
  countryCode: z.string().trim().max(4).optional(),
  pageRef: z.string().trim().max(200).optional(),
  entry: z.string().trim().max(40).optional(),
  urlOrigem: z.string().max(500).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
});

// The question ids are what serializeLeadForXphere ships as `answers`, so the
// custom-answer keys written below must each have a question here.
const WHATSAPP_CHAT_FORM_CONFIG: FormConfig = {
  questions: [
    { id: "nome", order: 1, title: "Name", type: "text", required: true },
    { id: "telefone", order: 2, title: "WhatsApp phone", type: "tel", required: true },
    { id: "whatsappPageRef", order: 3, title: "Page", type: "text", required: false },
    { id: "whatsappEntry", order: 4, title: "Button", type: "text", required: false },
  ],
  maxScore: 0,
  thresholds: DEFAULT_FORM_CONFIG.thresholds,
};

async function ensureWhatsappChatForm() {
  const existing = await storage.getFormBySlug(WHATSAPP_CHAT_FORM_SLUG);
  if (existing) {
    if (!existing.isActive) return await storage.updateForm(existing.id, { isActive: true });
    return existing;
  }
  try {
    return await storage.createForm({
      slug: WHATSAPP_CHAT_FORM_SLUG,
      name: "WhatsApp Chat",
      description: "Name and phone captured by the WhatsApp button before the handoff to WhatsApp.",
      isActive: true,
      isDefault: false,
      config: WHATSAPP_CHAT_FORM_CONFIG,
    });
  } catch (err: any) {
    // Two first-ever submissions racing on the unique slug.
    if (err?.code === "23505") {
      const form = await storage.getFormBySlug(WHATSAPP_CHAT_FORM_SLUG);
      if (form) return form;
    }
    throw err;
  }
}

export function registerWhatsappChatLeadRoutes(app: Express) {
  app.post(
    "/api/forms/whatsapp-chat/leads",
    rateLimitMiddleware({
      limit: 30,
      windowMs: 10 * 60_000,
      message: "Too many requests. Please try again in a few minutes.",
    }),
    async (req, res) => {
      try {
        if (isBotSubmission(req.body, { source: "forms/whatsapp-chat", checkElapsed: true, ip: req.ip, userAgent: req.get("user-agent") })) {
          return res.status(201).json({ success: true });
        }
        const parsed = whatsappChatLeadSchema.parse(req.body);
        const form = await ensureWhatsappChatForm();
        const formConfig = (form.config as FormConfig | null) ?? WHATSAPP_CHAT_FORM_CONFIG;
        const settings = await storage.getCompanySettings();
        const companyName = settings?.companyName || "Skale Club";

        const initialLead = await storage.upsertFormLeadProgress(
          {
            sessionId: crypto.randomUUID(),
            questionNumber: 2,
            nome: parsed.name,
            telefone: parsed.phone,
            formCompleto: true,
            urlOrigem: parsed.urlOrigem,
            utmSource: parsed.utmSource,
            utmMedium: parsed.utmMedium,
            utmCampaign: parsed.utmCampaign,
            startedAt: new Date().toISOString(),
            customAnswers: {
              whatsappPageRef: parsed.pageRef || "",
              whatsappEntry: parsed.entry || "",
              countryCode: parsed.countryCode || "",
            },
          },
          {
            userAgent: req.get("user-agent") || undefined,
            formId: form.id,
            source: WHATSAPP_CHAT_FORM_SLUG,
          },
          formConfig,
        );

        const { lead } = await runLeadPostProcessing(
          initialLead,
          formConfig,
          companyName,
          typeof req.body?.__visitorId === "string" ? req.body.__visitorId : undefined,
          WHATSAPP_CHAT_FORM_SLUG,
        );

        res.status(201).json({ success: true, leadId: lead.id });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors?.[0]?.message || "Validation error" });
        }
        // Public endpoint: never echo the internal error back to the caller.
        console.error("[forms] whatsapp-chat lead failed:", err);
        res.status(400).json({ message: "Could not save your data. Please try again." });
      }
    },
  );
}
