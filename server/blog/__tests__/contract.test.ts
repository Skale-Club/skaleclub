import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOG_SETTINGS_DEFAULTS,
  blogFeedbackVerdictSchema,
  blogJobSourceSchema,
  blogSettingsContractSchema,
  durationsMsSchema,
  formatTelegramTarget,
  parseTelegramTarget,
  parseTelegramTargets,
  telegramApprovalCallbackSchema,
} from "#shared/blog-contract.js";

// ─── Telegram targets ───────────────────────────────────────────────────────
// These are the only functions in the contract with real logic, and they are
// what makes group + forum-topic delivery work without a second migration on
// the chat_ids column every product already has.

test("a bare chat id parses, positive or negative", () => {
  assert.deepEqual(parseTelegramTarget("123456789"), { chatId: "123456789" });
  assert.deepEqual(parseTelegramTarget("-1001234567890"), { chatId: "-1001234567890" });
});

test("surrounding whitespace is tolerated (admin panels paste it constantly)", () => {
  assert.deepEqual(parseTelegramTarget("  -1001234567890  "), { chatId: "-1001234567890" });
});

test("a supergroup with a forum topic keeps both halves", () => {
  assert.deepEqual(parseTelegramTarget("-1001234567890:42"), {
    chatId: "-1001234567890",
    threadId: 42,
  });
});

test("thread id 0 is a typo, not the General topic — the chat still delivers", () => {
  assert.deepEqual(parseTelegramTarget("-1001234567890:0"), { chatId: "-1001234567890" });
});

test("an unusable entry is dropped rather than half-parsed", () => {
  assert.equal(parseTelegramTarget(""), null);
  assert.equal(parseTelegramTarget("   "), null);
  assert.equal(parseTelegramTarget("not-a-chat"), null);
  assert.equal(parseTelegramTarget("-100123:abc"), null);
  assert.equal(parseTelegramTarget(":42"), null);
});

test("formatting is the exact inverse of parsing", () => {
  for (const raw of ["123456789", "-1001234567890", "-1001234567890:42"]) {
    const parsed = parseTelegramTarget(raw);
    assert.ok(parsed, `expected ${raw} to parse`);
    assert.equal(formatTelegramTarget(parsed), raw);
  }
});

test("a whole column parses, skipping the broken rows instead of throwing", () => {
  assert.deepEqual(parseTelegramTargets(["-100123", "garbage", "-100456:7"]), [
    { chatId: "-100123" },
    { chatId: "-100456", threadId: 7 },
  ]);
  assert.deepEqual(parseTelegramTargets(null), []);
  assert.deepEqual(parseTelegramTargets([]), []);
});

// ─── Enum values ────────────────────────────────────────────────────────────
// The point of the contract is that these exact strings are the same in all
// five repos. A rename here is a migration everywhere, so pin them.

test("feedback verdict is approved/rejected, not positive/negative", () => {
  assert.deepEqual(blogFeedbackVerdictSchema.options, ["approved", "rejected"]);
  assert.equal(blogFeedbackVerdictSchema.safeParse("positive").success, false);
});

test("topic source distinguishes the pillar rotation from an RSS item", () => {
  assert.deepEqual(blogJobSourceSchema.options, ["pillar", "rss", "manual"]);
});

test("telegram callbacks carry an optional tenant (single-site products omit it)", () => {
  assert.equal(
    telegramApprovalCallbackSchema.safeParse({ action: "approve", postId: 12 }).success,
    true,
  );
  assert.equal(
    telegramApprovalCallbackSchema.safeParse({ action: "approve", postId: 12, tenantId: 3 }).success,
    true,
  );
  assert.equal(
    telegramApprovalCallbackSchema.safeParse({ action: "publish", postId: 12 }).success,
    false,
  );
});

// ─── Timings ────────────────────────────────────────────────────────────────

test("a skipped image stage is null, which is not the same as 0ms", () => {
  const withImage = durationsMsSchema.parse({
    topic: 10, content: 20, image: 30, upload: 5, total: 65,
  });
  assert.equal(withImage.image, 30);

  const withoutImage = durationsMsSchema.parse({
    topic: 10, content: 20, image: null, upload: 0, total: 30,
  });
  assert.equal(withoutImage.image, null);

  assert.equal(
    durationsMsSchema.safeParse({ topic: -1, content: 0, image: null, upload: 0, total: 0 }).success,
    false,
  );
});

// ─── Defaults ───────────────────────────────────────────────────────────────

test("defaults are safe in both directions: nothing runs, nothing self-publishes", () => {
  assert.equal(blogSettingsContractSchema.safeParse(BLOG_SETTINGS_DEFAULTS).success, true);
  assert.equal(BLOG_SETTINGS_DEFAULTS.superAdminEnabled, false);
  assert.equal(BLOG_SETTINGS_DEFAULTS.enabled, false);
  assert.equal(BLOG_SETTINGS_DEFAULTS.autoPublish, false);
  assert.equal(BLOG_SETTINGS_DEFAULTS.rssEnabled, false);
});

test("postsPerDay 0 is valid (paused), 25 is not", () => {
  const base = BLOG_SETTINGS_DEFAULTS;
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postsPerDay: 0 }).success, true);
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postsPerDay: 25 }).success, false);
});

test("postingHour accepts null (drift mode) and 0-23, nothing else", () => {
  const base = BLOG_SETTINGS_DEFAULTS;
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postingHour: null }).success, true);
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postingHour: 0 }).success, true);
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postingHour: 23 }).success, true);
  assert.equal(blogSettingsContractSchema.safeParse({ ...base, postingHour: 24 }).success, false);
});
