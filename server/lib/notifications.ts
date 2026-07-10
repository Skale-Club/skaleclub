// Shared notification dispatcher (Phase 31).
// Callers: server/routes.ts, server/lib/lead-processing.ts
//
// Usage:
//   await dispatchNotification(storage, 'hot_lead', { company, name, phone, classification });
//
// The dispatcher queries notification_templates for the event, substitutes {{variables}},
// and routes to the matching channel integration. Errors per channel are swallowed (best-effort).
// Telegram channel is a no-op stub until Phase 32.
//
// IMPORTANT: The dispatcher does NOT enforce per-event toggles like notifyOnNewChat.
// That guard lives at the call site (routes.ts) before calling dispatchNotification,
// matching the original sendNewChatNotification behavior.

import type { IStorage } from "../storage.js";
import { validateConfig, sendSms } from "../integrations/twilio.js";
import { sendTelegramMessage } from "../integrations/telegram.js";
import { sendEmail } from "../integrations/resend.js";

function substituteVariables(
  body: string,
  vars: Record<string, string>,
  escapeValue?: (value: string) => string
): string {
  // Replace {{token}} with vars[token], unknown tokens render as empty string (NOTIF-04).
  // Only the substituted VALUE is escaped (per escapeValue, when provided) — the template
  // body itself is admin-authored and left untouched to avoid mangling intentional markup.
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined) return "";
    return escapeValue ? escapeValue(value) : value;
  });
}

// HTML-entity-escape a value before it is embedded in the email HTML body. Untrusted
// lead-supplied values (e.g. `nome`) must not be able to inject tags/attributes.
function escapeHtmlValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape Telegram Markdown special characters so untrusted values can't alter formatting,
// inject links, or break out of the intended message structure (parse_mode: "Markdown").
const TELEGRAM_MARKDOWN_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;
function escapeTelegramMarkdownValue(value: string): string {
  return value.replace(TELEGRAM_MARKDOWN_SPECIAL_CHARS, "\\$&");
}

export async function dispatchNotification(
  storage: IStorage,
  eventKey: string,
  variables: Record<string, string>
): Promise<void> {
  const templates = await storage.getNotificationTemplates(eventKey);
  const active = templates.filter(t => t.active);

  for (const template of active) {
    try {
      if (template.channel === "sms") {
        const twilioSettings = await storage.getTwilioSettings();
        if (!twilioSettings) continue;
        // variables.company is passed by all callers per D-04; fallback to "My Company"
        const companyName = variables.company ?? "My Company";
        const validation = validateConfig(twilioSettings, { companyName });
        if (!validation.success) continue;
        // SMS is plain text — no escaping needed.
        const body = substituteVariables(template.body, variables);
        await sendSms(validation.config, body);
      } else if (template.channel === "telegram") {
        const telegramSettings = await storage.getTelegramSettings();
        if (!telegramSettings) continue;
        if (!telegramSettings.enabled) continue;
        if (!telegramSettings.botToken || !telegramSettings.chatId) continue;
        const body = substituteVariables(template.body, variables, escapeTelegramMarkdownValue);
        await sendTelegramMessage(
          { botToken: telegramSettings.botToken, chatId: telegramSettings.chatId },
          body
        );
      } else if (template.channel === "email") {
        const resendSettings = await storage.getResendSettings();
        if (!resendSettings || !resendSettings.enabled) continue;
        if (!resendSettings.apiKey || !resendSettings.fromEmail) continue;
        const toEmails = (resendSettings.toEmails as string[] | null) ?? [];
        if (!toEmails.length) continue;
        const subjectTemplate = template.subject?.trim() || "Notification from {{company}}";
        // Subject is a plain-text email header (not HTML-rendered), so it is not
        // HTML-escaped — only the HTML body needs entity-escaping.
        const subject = substituteVariables(subjectTemplate, variables) || "Notification";
        const body = substituteVariables(template.body, variables, escapeHtmlValue);
        await sendEmail(
          { apiKey: resendSettings.apiKey, fromName: resendSettings.fromName, fromEmail: resendSettings.fromEmail },
          toEmails,
          subject,
          body,
          { alreadyEscaped: true }
        );
      }
    } catch (err) {
      console.error(`[notifications] dispatch error for ${eventKey}/${template.channel}:`, err);
    }
  }
}
