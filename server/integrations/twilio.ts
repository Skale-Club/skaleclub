import type { TwilioSettings } from "@shared/schema";

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
