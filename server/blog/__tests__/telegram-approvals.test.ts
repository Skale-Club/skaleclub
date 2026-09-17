import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOG_CALLBACK_PREFIX,
  allowedCallbackChatIds,
  buildBlogApprovalKeyboard,
  buildBlogCallbackData,
  newWebhookSecret,
  parseBlogCallbackData,
  resolveApprovalsBotToken,
  resolveApprovalsChatIds,
  webhookSecretMatches,
  webhookUrl,
} from "../telegram-approvals.js";

// The sender and the webhook both resolve through resolveApprovalsBotToken and
// resolveApprovalsChatIds. That is the invariant these guard: a chat that can
// RECEIVE an approval card is exactly a chat that can DECIDE on one, and the
// bot answering a callback is the bot whose card produced it.

test("the dedicated approvals bot wins, otherwise the alert bot", () => {
  assert.equal(resolveApprovalsBotToken({ botToken: "alert", approvalsBotToken: null }), "alert");
  assert.equal(resolveApprovalsBotToken({ botToken: "alert", approvalsBotToken: "approvals" }), "approvals");
  assert.equal(resolveApprovalsBotToken({ botToken: "alert", approvalsBotToken: "   " }), "alert");
  assert.equal(resolveApprovalsBotToken({ botToken: null, approvalsBotToken: null }), null);
});

test("approval chats fall back to the alert chats, and never merge with them", () => {
  // Merging would mean an editor added for drafts silently starts receiving
  // every alert — the reason the two lists exist separately at all.
  assert.deepEqual(resolveApprovalsChatIds({ chatIds: ["-100111"], approvalsChatIds: [] }), ["-100111"]);
  assert.deepEqual(resolveApprovalsChatIds({ chatIds: ["-100111"], approvalsChatIds: ["-100222"] }), ["-100222"]);
  assert.deepEqual(resolveApprovalsChatIds({ chatIds: ["", "  "], approvalsChatIds: [] }), []);
  // A non-array (a legacy single chat_id column, a null) is not a crash.
  assert.deepEqual(resolveApprovalsChatIds({ chatIds: null, approvalsChatIds: undefined }), []);
});

test("a callback is matched against the CHAT, with the forum topic stripped", () => {
  // The card goes to topic 42 of the group; the callback reports only the
  // group. Comparing the raw entries would reject every decision made in a
  // forum topic — exactly the case group support exists for.
  assert.deepEqual(
    allowedCallbackChatIds({ chatIds: [], approvalsChatIds: ["-1001234567890:42"] }),
    ["-1001234567890"],
  );
});

test("callback data round-trips and stays inside Telegram's 64-byte cap", () => {
  const data = buildBlogCallbackData("reject", 987654);
  assert.equal(data, `${BLOG_CALLBACK_PREFIX}:reject:987654`);
  assert.ok(Buffer.byteLength(data) <= 64);
  assert.deepEqual(parseBlogCallbackData(data), { action: "reject", postId: 987654 });
});

test("malformed or hostile callback data is rejected, not coerced", () => {
  for (const bad of [
    undefined, "", "blog", "blog:approve", "blog:approve:1:2", "other:approve:1",
    "blog:publish:1", "blog:approve:abc", "blog:approve:0", "blog:approve:-1",
    // Number("1e3") is 1000 and Number(" 5 ") is 5 — coercion here would let a
    // caller reach a post id they did not name.
    "blog:approve:1e3", "blog:approve: 5", "blog:approve:",
  ]) {
    assert.equal(parseBlogCallbackData(bad as string | undefined), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test("the keyboard carries exactly the two decisions", () => {
  const row = buildBlogApprovalKeyboard(7).inline_keyboard[0];
  assert.equal(row.length, 2);
  assert.deepEqual(row.map((b) => b.callback_data), ["blog:approve:7", "blog:reject:7"]);
});

test("a wrong, short, long or missing secret never matches", () => {
  const secret = newWebhookSecret();
  assert.equal(secret.length, 64);
  assert.equal(webhookSecretMatches(secret, secret), true);
  assert.equal(webhookSecretMatches(undefined, secret), false);
  assert.equal(webhookSecretMatches("", secret), false);
  // A length mismatch must return false, not throw out of the route.
  assert.equal(webhookSecretMatches(secret.slice(0, -1), secret), false);
  assert.equal(webhookSecretMatches(secret + "a", secret), false);
  assert.equal(webhookSecretMatches("b".repeat(64), secret), false);
});

test("two generated secrets differ", () => {
  assert.notEqual(newWebhookSecret(), newWebhookSecret());
});

test("the webhook URL is always https, whatever SITE_URL's scheme says", () => {
  // Telegram refuses a non-https webhook, and behind the proxy the request
  // scheme is plain http — so it is never read from there.
  const original = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "http://skale.club/";
    assert.equal(webhookUrl(), "https://skale.club/api/blog/telegram/webhook");
    process.env.SITE_URL = "";
    process.env.APP_URL = "";
    assert.equal(webhookUrl(), null);
  } finally {
    if (original === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = original;
  }
});
