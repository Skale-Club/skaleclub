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
import {
  buildBlogApprovalKeyboard,
  resolveApprovalsBotToken,
  resolveApprovalsChatIds,
  type InlineKeyboardMarkup,
} from "../blog/telegram-approvals.js";

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

// ═══ Blog approvals (autoblog-parity SC-07, MASTER §6) ══════════════════════
//
// The decision logic and the resolvers live in server/blog/telegram-approvals.ts
// (pure, no network). This file owns the calls that actually talk to Telegram.

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_TIMEOUT_MS = 15_000;

interface TelegramApprovalSettings {
  enabled?: boolean | null;
  botToken?: string | null;
  chatIds?: unknown;
  approvalsEnabled?: boolean | null;
  approvalsBotToken?: string | null;
  approvalsChatIds?: unknown;
}

export interface BlogDraftNotification {
  id: number;
  title: string;
  excerpt?: string | null;
  focusKeyword?: string | null;
  /** ABSOLUTE. Telegram fetches a photo from its OWN servers, so a stored
   *  root-relative path is meaningless to it. */
  imageUrl?: string | null;
}

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Push a generated draft to the approval chats with Aprovar/Rejeitar buttons.
 *
 * Fire-and-forget at the call site: the post is already saved, and a
 * notification problem must never fail a generation run.
 */
export async function sendBlogDraftForApproval(
  settings: TelegramApprovalSettings,
  draft: BlogDraftNotification,
  opts: { postUrl?: string | null } = {},
): Promise<TelegramFanoutResult> {
  const empty: TelegramFanoutResult = { success: false, delivered: 0, failures: [] };
  if (!settings.enabled || !settings.approvalsEnabled) return empty;

  const botToken = resolveApprovalsBotToken(settings);
  const chatIds = resolveApprovalsChatIds(settings);
  if (!botToken || chatIds.length === 0) return empty;

  const lines = [
    "<b>Novo rascunho de post aguardando revisão</b>",
    "",
    `<b>${escapeTelegramHtml(draft.title)}</b>`,
  ];
  if (draft.excerpt) lines.push("", escapeTelegramHtml(draft.excerpt));
  if (draft.focusKeyword) lines.push("", `<b>Palavra-chave:</b> ${escapeTelegramHtml(draft.focusKeyword)}`);
  if (opts.postUrl) lines.push("", `<a href="${escapeTelegramHtml(opts.postUrl)}">Abrir no admin</a>`);

  const text = lines.join("\n");
  const photoUrl = draft.imageUrl && /^https?:\/\//i.test(draft.imageUrl) ? draft.imageUrl : undefined;
  const keyboard = buildBlogApprovalKeyboard(draft.id);
  const failures: TelegramFanoutResult["failures"] = [];
  let delivered = 0;

  for (const chatId of chatIds) {
    // Same forum-topic handling as every other send here.
    const target = parseTelegramTarget(chatId);
    const method = photoUrl ? "sendPhoto" : "sendMessage";
    try {
      const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: target?.chatId ?? chatId,
          ...(target?.threadId ? { message_thread_id: target.threadId } : {}),
          ...(photoUrl ? { photo: photoUrl, caption: text } : { text, disable_web_page_preview: true }),
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (json.ok) delivered += 1;
      else failures.push({ chatId, message: json.description ?? `Telegram API error (${res.status})` });
    } catch (error: unknown) {
      // One bad destination must not silence the others.
      failures.push({ chatId, message: error instanceof Error ? error.message : "unknown error" });
    }
  }

  return { success: delivered > 0, delivered, failures };
}

/** Dismiss the button's spinner and show a short toast. Best effort: the
 *  decision is already committed, and a failed toast must not become a non-2xx
 *  webhook response, which Telegram would redeliver for hours. */
export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch {
    /* best effort — see above */
  }
}

/** Strip the buttons off a card that has been acted on. Best effort, same reason. */
export async function editMessageReplyMarkup(
  botToken: string,
  chatId: string | number,
  messageId: number,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup ?? { inline_keyboard: [] },
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch {
    /* best effort */
  }
}

/**
 * Point the bot at the install's webhook URL. allowed_updates is narrowed to
 * callback_query so the bot never receives chat messages it has no handler for,
 * and so a busy group cannot flood the endpoint.
 */
export async function setTelegramWebhook(
  botToken: string,
  url: string,
  secretToken: string,
): Promise<TelegramResult> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ url, secret_token: secretToken, allowed_updates: ["callback_query"] }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { success: false, message: data.description || `Telegram setWebhook failed (${res.status})` };
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Telegram setWebhook failed" };
  }
}

/** What Telegram currently believes the webhook is — the reconciler's input. */
export async function getTelegramWebhookInfo(
  botToken: string,
): Promise<{ success: boolean; url?: string; lastErrorMessage?: string; message?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getWebhookInfo`, {
      method: "GET",
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { url?: string; last_error_message?: string } };
    if (!res.ok || !data.ok) {
      return { success: false, message: data.description || `Telegram getWebhookInfo failed (${res.status})` };
    }
    return {
      success: true,
      url: typeof data.result?.url === "string" ? data.result.url : "",
      lastErrorMessage: data.result?.last_error_message,
    };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Telegram getWebhookInfo failed" };
  }
}

export async function deleteTelegramWebhook(botToken: string): Promise<TelegramResult> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { success: false, message: data.description || `Telegram deleteWebhook failed (${res.status})` };
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Telegram deleteWebhook failed" };
  }
}
