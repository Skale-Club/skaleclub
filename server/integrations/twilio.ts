import type { TwilioSettings, FormLead } from "@shared/schema";

export async function sendNewChatNotification(
  twilioSettings: TwilioSettings,
  conversationId: string,
  pageUrl?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.notifyOnNewChat) {
      return { success: false, message: 'Twilio notifications are disabled' };
    }

    if (!twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumber) {
      return { success: false, message: 'Twilio settings are incomplete' };
    }

    const twilio = await import('twilio');
    const client = twilio.default(twilioSettings.accountSid, twilioSettings.authToken);

    const message = `🔔 New chat started on Skleanings!\n\nConversation ID: ${conversationId.slice(0, 8)}...\nPage: ${pageUrl || 'Unknown'}`;

    await client.messages.create({
      body: message,
      from: twilioSettings.fromPhoneNumber,
      to: twilioSettings.toPhoneNumber
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send Twilio notification:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  }
}

export async function sendLowPerformanceAlert(
  twilioSettings: TwilioSettings,
  avgSeconds: number,
  samples: number
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled) {
      return { success: false, message: 'Twilio notifications are disabled' };
    }

    if (!twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumber) {
      return { success: false, message: 'Twilio settings are incomplete' };
    }

    const minutes = Math.floor(avgSeconds / 60);
    const seconds = avgSeconds % 60;
    const formatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const twilio = await import('twilio');
    const client = twilio.default(twilioSettings.accountSid, twilioSettings.authToken);

    const message = `⚠️ Chat response time alert\n\nAverage: ${formatted}\nSamples: ${samples}`;

    await client.messages.create({
      body: message,
      from: twilioSettings.fromPhoneNumber,
      to: twilioSettings.toPhoneNumber
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send Twilio alert:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  }
}

export async function sendHotLeadNotification(
  twilioSettings: TwilioSettings,
  lead: Pick<FormLead, "nome" | "email" | "telefone" | "cidadeEstado" | "classificacao">
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled) {
      return { success: false, message: 'Twilio notifications are disabled' };
    }

    if (!twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumber) {
      return { success: false, message: 'Twilio settings are incomplete' };
    }

    const twilio = await import('twilio');
    const client = twilio.default(twilioSettings.accountSid, twilioSettings.authToken);
    const title = lead.classificacao === 'QUENTE' ? '🔥 Lead Quente' : 'Lead';
    const message = `${title} via Formulário\nNome: ${lead.nome || 'Não informado'}\nEmail: ${lead.email || 'Não informado'}\nTelefone: ${lead.telefone || 'Não informado'}\nCidade/Estado: ${lead.cidadeEstado || 'Não informado'}`;

    await client.messages.create({
      body: message,
      from: twilioSettings.fromPhoneNumber,
      to: twilioSettings.toPhoneNumber,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send lead notification:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  }
}
