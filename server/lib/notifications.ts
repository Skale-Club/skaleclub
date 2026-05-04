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

function substituteVariables(body: string, vars: Record<string, string>): string {
  // Replace {{token}} with vars[token], unknown tokens render as empty string (NOTIF-04).
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function dispatchNotification(
  storage: IStorage,
  eventKey: string,
  variables: Record<string, string>
): Promise<void> {
  const templates = await storage.getNotificationTemplates(eventKey);
  const active = templates.filter(t => t.active);

  for (const template of active) {
    const body = substituteVariables(template.body, variables);
    try {
      if (template.channel === "sms") {
        const twilioSettings = await storage.getTwilioSettings();
        if (!twilioSettings) continue;
        // variables.company is passed by all callers per D-04; fallback to "My Company"
        const companyName = variables.company ?? "My Company";
        const validation = validateConfig(twilioSettings, { companyName });
        if (!validation.success) continue;
        await sendSms(validation.config, body);
      } else if (template.channel === "telegram") {
        const telegramSettings = await storage.getTelegramSettings();
        if (!telegramSettings) continue;
        if (!telegramSettings.enabled) continue;
        if (!telegramSettings.botToken || !telegramSettings.chatId) continue;
        await sendTelegramMessage(
          { botToken: telegramSettings.botToken, chatId: telegramSettings.chatId },
          body
        );
      }
    } catch (err) {
      console.error(`[notifications] dispatch error for ${eventKey}/${template.channel}:`, err);
    }
  }
}
