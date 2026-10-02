import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { sendEmail } from "../integrations/resend.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { isBotSubmission } from "../lib/botTrap.js";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().email().max(300),
  phone: z.string().trim().min(7).max(30),
  subject: z.string().trim().min(2).max(300),
  message: z.string().trim().min(5).max(5000),
  smsConsent: z.boolean(),
  marketingConsent: z.boolean(),
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

      try {
        const [resendSettings, companySettings] = await Promise.all([
          storage.getResendSettings(),
          storage.getCompanySettings(),
        ]);
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
