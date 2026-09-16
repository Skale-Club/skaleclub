// server/integrations/telegram.ts
//
// Telegram delivery. Destinations come from telegram_settings.chat_ids, an
// array whose entries are a chat id or "<chat_id>:<thread_id>" for a forum
// topic (autoblog-parity SC-07 / MASTER §6). One shape covers a private chat,
// a group, a supergroup and a topic inside one.
//
// Why the thread matters: a supergroup with forum topics enabled REFUSES a
// message that carries no message_thread_id when its General topic is closed,
// and files it in the wrong topic otherwise. Both failures are invisible from
// inside the product — the send "succeeds" and nobody sees the message.

import { parseTelegramTarget } from "#shared/blog-contract.js";

type TelegramResult = { success: boolean; message?: string };

export type TelegramConfig = {
  botToken: string;
  /** A chat id, optionally with a forum-topic thread: "-1001234567890:42". */
  chatId: string;
};

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string
): Promise<TelegramResult> {
  try {
    const target = parseTelegramTarget(config.chatId);
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // An unparseable id is passed through untouched so Telegram's own
        // description reaches the caller, rather than being dropped locally
        // with no explanation.
        chat_id: target?.chatId ?? config.chatId,
        ...(target?.threadId ? { message_thread_id: target.threadId } : {}),
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send Telegram message";
    console.error("Failed to send Telegram message:", error);
    return { success: false, message };
  }
}

export interface TelegramFanoutResult {
  /** True when at least one destination took the message. */
  success: boolean;
  delivered: number;
  failures: Array<{ chatId: string; message: string }>;
}

/**
 * Send to every configured destination.
 *
 * One bad destination must not silence the others: a revoked group, a bot
 * removed from a chat, or a typo in one id would otherwise take down the whole
 * notification. Each is attempted, each failure is collected, and the call
 * counts as successful if anyone received it.
 */
export async function sendTelegramToAll(
  botToken: string,
  chatIds: readonly string[],
  text: string,
): Promise<TelegramFanoutResult> {
  const failures: TelegramFanoutResult["failures"] = [];
  let delivered = 0;

  for (const chatId of chatIds) {
    const result = await sendTelegramMessage({ botToken, chatId }, text);
    if (result.success) {
      delivered += 1;
    } else {
      failures.push({ chatId, message: result.message ?? "unknown error" });
    }
  }

  return { success: delivered > 0, delivered, failures };
}
