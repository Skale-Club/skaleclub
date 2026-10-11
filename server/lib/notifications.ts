// Shared notification dispatcher (Phase 31).
// Callers: server/routes.ts, server/lib/lead-processing.ts
//
// Usage:
//   await dispatchNotification(storage, 'hot_lead', { company, name, phone, classification });
//
// The dispatcher queries notification_templates for the event, substitutes {{variables}},
// and routes to the matching channel integration. Errors per channel are captured in the
// returned delivery report so callers never mistake an attempted alert for a delivered one.
//
// IMPORTANT: The dispatcher does NOT enforce per-event toggles like notifyOnNewChat.
// That guard lives at the call site (routes.ts) before calling dispatchNotification,
// matching the original sendNewChatNotification behavior.

import type { IStorage } from "../storage.js";
import { validateConfig, sendSms } from "../integrations/twilio.js";
import { sendTelegramToAll } from "../integrations/telegram.js";
import { sendEmail } from "../integrations/resend.js";

export type NotificationChannel = "sms" | "telegram" | "email";

export type NotificationDispatchResult = {
  attempted: number;
  delivered: number;
  deliveredChannels: NotificationChannel[];
  failures: Array<{ channel: string; message: string }>;
};

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
): Promise<NotificationDispatchResult> {
  const templates = await storage.getNotificationTemplates(eventKey);
  const active = templates.filter(t => t.active);
  const result: NotificationDispatchResult = {
    attempted: 0,
    delivered: 0,
    deliveredChannels: [],
    failures: [],
  };

  const recordDelivery = (channel: NotificationChannel, count = 1) => {
    result.delivered += count;
    if (!result.deliveredChannels.includes(channel)) result.deliveredChannels.push(channel);
  };

  const recordFailure = (channel: string, message: string) => {
    result.failures.push({ channel, message });
  };

  for (const template of active) {
    try {
      if (template.channel === "sms") {
        const twilioSettings = await storage.getTwilioSettings();
        if (!twilioSettings) {
          recordFailure("sms", "Twilio settings are missing");
          continue;
        }
        // variables.company is passed by all callers per D-04; fallback to "My Company"
        const companyName = variables.company ?? "My Company";
        const validation = validateConfig(twilioSettings, { companyName });
        if (!validation.success) {
          recordFailure("sms", validation.message);
          continue;
        }
        // SMS is plain text — no escaping needed.
        const body = substituteVariables(template.body, variables);
        result.attempted += 1;
        const delivery = await sendSms(validation.config, body);
        if (delivery.success) recordDelivery("sms");
        else recordFailure("sms", delivery.message || "SMS delivery failed");
      } else if (template.channel === "telegram") {
        const telegramSettings = await storage.getTelegramSettings();
        if (!telegramSettings) {
          recordFailure("telegram", "Telegram settings are missing");
          continue;
        }
        if (!telegramSettings.enabled) {
          recordFailure("telegram", "Telegram notifications are disabled");
          continue;
        }
        // chat_ids is the destination list now (SC-07). chat_id is read only as
        // a fallback for a row the backfill has not reached, and goes away with
        // the follow-up migration.
        const chatIds = telegramSettings.chatIds?.length
          ? telegramSettings.chatIds
          : (telegramSettings.chatId ? [telegramSettings.chatId] : []);
        if (!telegramSettings.botToken || chatIds.length === 0) {
          recordFailure("telegram", "Telegram bot token or destination is missing");
          continue;
        }
        const body = substituteVariables(template.body, variables, escapeTelegramMarkdownValue);
        result.attempted += chatIds.length;
        const fanout = await sendTelegramToAll(telegramSettings.botToken, chatIds, body);
        if (fanout.delivered > 0) recordDelivery("telegram", fanout.delivered);
        if (fanout.failures.length > 0) {
          for (const failure of fanout.failures) recordFailure("telegram", `${failure.chatId}: ${failure.message}`);
          console.error(
            `[telegram] ${fanout.delivered}/${chatIds.length} delivered; failures: ` +
            fanout.failures.map((f) => `${f.chatId}: ${f.message}`).join("; "),
          );
        }
      } else if (template.channel === "email") {
        const resendSettings = await storage.getResendSettings();
        if (!resendSettings || !resendSettings.enabled) {
          recordFailure("email", "Email notifications are disabled or missing");
          continue;
        }
        if (!resendSettings.apiKey || !resendSettings.fromEmail) {
          recordFailure("email", "Email API key or sender is missing");
          continue;
        }
        const toEmails = (resendSettings.toEmails as string[] | null) ?? [];
        if (!toEmails.length) {
          recordFailure("email", "Email destination is missing");
          continue;
        }
        const subjectTemplate = template.subject?.trim() || "Notification from {{company}}";
        // Subject is a plain-text email header (not HTML-rendered), so it is not
        // HTML-escaped — only the HTML body needs entity-escaping.
        const subject = substituteVariables(subjectTemplate, variables) || "Notification";
        const body = substituteVariables(template.body, variables, escapeHtmlValue);
        result.attempted += 1;
        const delivery = await sendEmail(
          { apiKey: resendSettings.apiKey, fromName: resendSettings.fromName, fromEmail: resendSettings.fromEmail },
          toEmails,
          subject,
          body,
          { alreadyEscaped: true }
        );
        if (delivery.success) recordDelivery("email");
        else recordFailure("email", delivery.message || "Email delivery failed");
      } else {
        recordFailure(template.channel, `Unsupported notification channel: ${template.channel}`);
      }
    } catch (err) {
      recordFailure(template.channel, err instanceof Error ? err.message : "Unknown notification error");
      console.error(`[notifications] dispatch error for ${eventKey}/${template.channel}:`, err);
    }
  }

  return result;
}
