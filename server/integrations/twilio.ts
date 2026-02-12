import type { TwilioSettings, FormLead } from "#shared/schema.js";

type TwilioResult = { success: boolean; message?: string };

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  from: string;
  recipients: string[];
  companyName: string;
};

type TwilioValidationResult =
  | { success: true; config: TwilioConfig }
  | { success: false; message: string };

function normalizePhone(value?: string | null): string {
  return (value || "")
    .toString()
    .replace(/[\s()-]/g, "")
    .trim();
}

function collectRecipients(settings: TwilioSettings): string[] {
  const recipients: string[] = [];
  const push = (value?: string | null) => {
    const normalized = normalizePhone(value);
    if (normalized) recipients.push(normalized);
  };

  if (Array.isArray(settings.toPhoneNumbers)) {
    for (const num of settings.toPhoneNumbers) {
      push(num as string);
    }
  }

  push(settings.toPhoneNumber);

  return Array.from(new Set(recipients));
}

function validateConfig(
  twilioSettings: TwilioSettings,
  options?: { requireNotify?: boolean; companyName?: string }
): TwilioValidationResult {
  if (!twilioSettings.enabled) {
    return { success: false, message: "Twilio notifications are disabled" };
  }

  if (options?.requireNotify && !twilioSettings.notifyOnNewChat) {
    return { success: false, message: "Twilio notifications for new chats are disabled" };
  }

  const accountSid = twilioSettings.accountSid?.trim();
  const authToken = twilioSettings.authToken?.trim();
  const from = normalizePhone(twilioSettings.fromPhoneNumber);
  const recipients = collectRecipients(twilioSettings);

  if (!accountSid || !authToken || !from || !recipients.length) {
    return { success: false, message: "Twilio settings are incomplete" };
  }

  return {
    success: true,
    config: {
      accountSid,
      authToken,
      from,
      recipients,
      companyName: (options?.companyName || "My Company").trim(),
    },
  };
}

async function sendSms(config: TwilioConfig, body: string): Promise<TwilioResult> {
  try {
    const twilio = await import("twilio");
    const client = twilio.default(config.accountSid, config.authToken);

    for (const to of config.recipients) {
      await client.messages.create({
        body,
        from: config.from,
        to,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Twilio SMS:", error);
    return { success: false, message: error?.message || "Failed to send SMS" };
  }
}

export async function sendNewChatNotification(
  twilioSettings: TwilioSettings,
  conversationId: string,
  pageUrl?: string,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const validation = validateConfig(twilioSettings, { requireNotify: true, companyName });
    if (!validation.success) return validation;

    const { config } = validation;
    const message = [
      `🔔 Novo chat em ${config.companyName}`,
      `Conversa: ${conversationId.slice(0, 8)}...`,
      pageUrl ? `Página: ${pageUrl}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    return await sendSms(config, message);
  } catch (error: any) {
    console.error("Failed to send Twilio notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}

export async function sendLowPerformanceAlert(
  twilioSettings: TwilioSettings,
  avgSeconds: number,
  samples: number,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const validation = validateConfig(twilioSettings, { companyName });
    if (!validation.success) return validation;

    const minutes = Math.floor(avgSeconds / 60);
    const seconds = avgSeconds % 60;
    const formatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const { config } = validation;
    const message = [
      `⚠️ ${config.companyName}: alerta de tempo de resposta`,
      `Média: ${formatted}`,
      `Amostras: ${samples}`,
    ].join("\n");

    return await sendSms(config, message);
  } catch (error: any) {
    console.error("Failed to send Twilio alert:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}

export async function sendHotLeadNotification(
  twilioSettings: TwilioSettings,
  lead: Pick<FormLead, "nome" | "email" | "telefone" | "cidadeEstado" | "classificacao">,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const validation = validateConfig(twilioSettings, { companyName });
    if (!validation.success) return validation;

    const { config } = validation;
    const cleanName = lead.nome?.trim() || "Sem nome";
    const cleanPhone = lead.telefone?.trim() || "Sem telefone";
    const companyLabel = companyName?.trim() || config.companyName || "My Company";
    const message = `🧲 NEW LEAD | ${companyLabel} | Consultoria | ${cleanName} | ${cleanPhone}`;

    return await sendSms(config, message);
  } catch (error: any) {
    console.error("Failed to send lead notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}
