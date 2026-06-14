import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { sendEmail } from "../integrations/resend.js";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().email().max(300),
  phone: z.string().trim().min(7).max(30),
  subject: z.string().trim().min(2).max(300),
  message: z.string().trim().min(5).max(5000),
  smsConsent: z.boolean(),
  marketingConsent: z.boolean(),
});

export function registerContactRoutes(app: Express) {
  app.post("/api/contact", async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const { name, email, phone, subject, message, smsConsent, marketingConsent } = parsed.data;

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
  });
}
