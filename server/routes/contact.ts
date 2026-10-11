import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { sendEmail } from "../integrations/resend.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { isBotSubmission } from "../lib/botTrap.js";
import crypto from "crypto";
import type { FormConfig } from "#shared/schema.js";
import { DEFAULT_FORM_CONFIG } from "#shared/form.js";
import { runLeadPostProcessing } from "../lib/lead-processing.js";

const CONTACT_FORM_SLUG = "contact";
const CONTACT_FORM_CONFIG: FormConfig = {
  questions: [
    { id: "nome", order: 1, title: "Full Name", type: "text", required: true },
    { id: "email", order: 2, title: "Email Address", type: "email", required: true },
    { id: "telefone", order: 3, title: "Phone Number", type: "tel", required: true },
    { id: "subject", order: 4, title: "Subject", type: "text", required: true },
    { id: "message", order: 5, title: "Message", type: "textarea", required: true },
    { id: "smsConsent", order: 6, title: "Transactional contact consent", type: "text", required: false },
    { id: "marketingConsent", order: 7, title: "Marketing contact consent", type: "text", required: false },
  ],
  maxScore: 0,
  thresholds: DEFAULT_FORM_CONFIG.thresholds,
};

async function ensureContactForm() {
  const existing = await storage.getFormBySlug(CONTACT_FORM_SLUG);
  if (existing) {
    if (!existing.isActive) return storage.updateForm(existing.id, { isActive: true });
    return existing;
  }
  try {
    return await storage.createForm({
      slug: CONTACT_FORM_SLUG,
      name: "Contact Form",
      description: "General website contact form.",
      isActive: true,
      isDefault: false,
      config: CONTACT_FORM_CONFIG,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      const form = await storage.getFormBySlug(CONTACT_FORM_SLUG);
      if (form) return form;
    }
    throw err;
  }
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().email().max(300),
  phone: z.string().trim().min(7).max(30),
  subject: z.string().trim().min(2).max(300),
  message: z.string().trim().min(5).max(5000),
  smsConsent: z.boolean(),
  marketingConsent: z.boolean(),
  language: z.enum(["en", "pt"]).optional(),
  urlOrigem: z.string().max(500).optional(),
  referrerUrl: z.string().max(500).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  // Bot traps: `hp_extra` is a hidden honeypot, `elapsedMs` the client-measured fill time.
  hp_extra: z.string().max(500).optional(),
  elapsedMs: z.number().optional(),
});

export function registerContactRoutes(app: Express) {
  app.post(
    "/api/contact",
    rateLimitMiddleware({
      limit: 5,
      windowMs: 10 * 60_000,
      message: "Too many messages. Please try again later.",
    }),
    async (req, res) => {
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const { name, email, phone, subject, message, smsConsent, marketingConsent } = parsed.data;

      // Silent success for bots: filled honeypot or a submit faster than a human can type.
      if (isBotSubmission(parsed.data, { source: "contact", ip: req.ip, userAgent: req.get("user-agent") })) {
        return res.json({ ok: true });
      }

      let companySettings;
      try {
        const resolved = await Promise.all([
          storage.getCompanySettings(),
          ensureContactForm(),
        ]);
        companySettings = resolved[0];
        const form = resolved[1];

        const initialLead = await storage.upsertFormLeadProgress(
          {
            sessionId: crypto.randomUUID(),
            questionNumber: CONTACT_FORM_CONFIG.questions.length,
            nome: name,
            email,
            telefone: phone,
            formCompleto: true,
            language: parsed.data.language,
            urlOrigem: parsed.data.urlOrigem,
            referrerUrl: parsed.data.referrerUrl,
            utmSource: parsed.data.utmSource,
            utmMedium: parsed.data.utmMedium,
            utmCampaign: parsed.data.utmCampaign,
            startedAt: new Date().toISOString(),
            customAnswers: {
              subject,
              message,
              smsConsent: parsed.data.language === "pt" ? (smsConsent ? "Sim" : "Não") : (smsConsent ? "Yes" : "No"),
              marketingConsent: parsed.data.language === "pt" ? (marketingConsent ? "Sim" : "Não") : (marketingConsent ? "Yes" : "No"),
            },
          },
          {
            userAgent: req.get("user-agent") || undefined,
            formId: form.id,
            source: CONTACT_FORM_SLUG,
          },
          (form.config as FormConfig | null) ?? CONTACT_FORM_CONFIG,
        );

        await runLeadPostProcessing(
          initialLead,
          (form.config as FormConfig | null) ?? CONTACT_FORM_CONFIG,
          companySettings?.companyName || "Skale Club",
          undefined,
          form.slug,
          form.name,
        );
      } catch (err) {
        console.error("[contact] lead capture failed:", err);
        return res.status(500).json({ message: "Could not save your message. Please try again." });
      }

      try {
        const resendSettings = await storage.getResendSettings();
        const adminEmail = companySettings?.companyEmail;
        if (resendSettings && adminEmail) {
          const body = [
            "New contact form submission — skaleclub.com",
            "",
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone}`,
            `Subject: ${subject}`,
            "",
            "Message:",
            message,
            "",
            `SMS Transactional Consent: ${smsConsent ? "Yes" : "No"}`,
            `SMS Marketing Consent: ${marketingConsent ? "Yes" : "No"}`,
          ].join("\n");

          await sendEmail(
            {
              apiKey: resendSettings.apiKey ?? "",
              fromName: resendSettings.fromName ?? undefined,
              fromEmail: resendSettings.fromEmail ?? "",
            },
            [adminEmail],
            `Contact: ${subject} — ${name}`,
            body,
          );
        }
      } catch (err) {
        console.error("[contact] email notification failed:", err);
      }

      return res.json({ ok: true });
    },
  );
}
