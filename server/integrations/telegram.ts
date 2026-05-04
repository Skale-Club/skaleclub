type TelegramResult = { success: boolean; message?: string };

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string
): Promise<TelegramResult> {
  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const json = (await response.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      console.error("Telegram API error:", json.description);
      return { success: false, message: json.description };
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Telegram message:", error);
    return { success: false, message: error?.message || "Failed to send Telegram message" };
  }
}
