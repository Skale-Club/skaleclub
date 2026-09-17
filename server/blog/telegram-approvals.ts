// =============================================================================
// server/blog/telegram-approvals.ts
//
// Approve or reject a generated draft from Telegram (autoblog-parity SC-07,
// MASTER §6).
//
// SOURCE OF TRUTH for the shape: websites/server/integrations/telegram-approvals-core.ts
// and xkedule/server/lib/telegram-approvals.ts — sync changes back.
//
// Skale Club is a SINGLE SITE, so there is no tenant to resolve from a hostname
// and no per-tenant webhook URL: one registration serves the whole install.
// SITE_URL is therefore a legitimate source for it here, which it explicitly is
// NOT in the multi-tenant products, where one process-wide value would point
// every tenant's bot at the same host.
// =============================================================================
import { randomBytes, timingSafeEqual } from "crypto";
import { parseTelegramTarget } from "#shared/blog-contract.js";

export interface ApprovalsBotFields {
  botToken?: string | null;
  approvalsBotToken?: string | null;
}

export interface ApprovalsChatFields {
  chatIds?: unknown;
  approvalsChatIds?: unknown;
}

/**
 * The dedicated approvals bot when set, otherwise the alert bot.
 *
 * They are allowed to differ because the approvals bot is the one carrying a
 * PUBLIC webhook: it should be revocable on its own, and a leaked webhook
 * secret must buy nothing on the alert channel.
 */
export function resolveApprovalsBotToken(settings: ApprovalsBotFields): string | null {
  return settings.approvalsBotToken?.trim() || settings.botToken?.trim() || null;
}

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => (id?.toString().trim() || "")).filter(Boolean);
}

/**
 * Where cards go, and which chats may act on them.
 *
 * Falls back to the alert chat list, and deliberately does NOT merge the two:
 * an editor added to review drafts would otherwise start receiving every alert.
 * The sender and the webhook both resolve through this, so a chat that can
 * receive a card is exactly a chat that can decide on one.
 */
export function resolveApprovalsChatIds(settings: ApprovalsChatFields): string[] {
  const dedicated = cleanIds(settings.approvalsChatIds);
  return dedicated.length > 0 ? dedicated : cleanIds(settings.chatIds);
}

/** The chat ids a callback may come FROM: the same list, minus any topic suffix.
 *  A callback reports the chat, never the topic the card was filed under. */
export function allowedCallbackChatIds(settings: ApprovalsChatFields): string[] {
  return resolveApprovalsChatIds(settings).map((entry) => parseTelegramTarget(entry)?.chatId ?? entry);
}

export interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

/** Telegram caps callback_data at 64 bytes. "blog:approve:" + an int is 21. */
export const BLOG_CALLBACK_PREFIX = "blog";

export function buildBlogCallbackData(action: "approve" | "reject", postId: number): string {
  return `${BLOG_CALLBACK_PREFIX}:${action}:${postId}`;
}

/**
 * Strict by design: this parses attacker-reachable input. Anything that is not
 * exactly the three-part shape with a positive integer id is rejected rather
 * than coerced — Number("1e3") is 1000 and Number("") is 0.
 */
export function parseBlogCallbackData(
  data: string | undefined,
): { action: "approve" | "reject"; postId: number } | null {
  if (!data) return null;
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== BLOG_CALLBACK_PREFIX) return null;
  const [, action, rawId] = parts;
  if (action !== "approve" && action !== "reject") return null;
  if (!/^\d+$/.test(rawId)) return null;
  const postId = Number(rawId);
  return postId > 0 ? { action, postId } : null;
}

export function buildBlogApprovalKeyboard(postId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Aprovar e publicar", callback_data: buildBlogCallbackData("approve", postId) },
      { text: "🗑 Rejeitar", callback_data: buildBlogCallbackData("reject", postId) },
    ]],
  };
}

/** Where the Express app serves the webhook. */
export const TELEGRAM_WEBHOOK_PATH = "/api/blog/telegram/webhook";

/**
 * Telegram requires HTTPS, so the scheme is never read from the request —
 * behind the proxy that is plain HTTP. Single site, so SITE_URL is the right
 * source for the host (see the file header for why that is not true elsewhere).
 */
export function webhookUrl(): string | null {
  const base = (process.env.SITE_URL || process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const host = base.replace(/^https?:\/\//i, "");
  return host ? `https://${host}${TELEGRAM_WEBHOOK_PATH}` : null;
}

/** Constant-time compare that tolerates a length mismatch without throwing. */
export function webhookSecretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}
