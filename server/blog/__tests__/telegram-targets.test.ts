/**
 * Auto-blog parity SC-07 / MASTER §6 — group and forum-topic delivery.
 *
 * parseTelegramTarget is covered in contract.test.ts. What this pins is the
 * part that reaches Telegram: a stored "<chat_id>:<thread_id>" becomes a
 * message_thread_id on the wire, a plain id does not grow one, and one bad
 * destination does not silence the others.
 *
 * No network: global fetch is stubbed and the request body read back.
 */
import test from "node:test";
import { strict as assert } from "node:assert";

import { sendTelegramMessage, sendTelegramToAll } from "../../integrations/telegram.js";

type Captured = { body: Record<string, unknown> };

async function capture(
  run: () => Promise<unknown>,
  respond: (chatId: unknown) => { ok: boolean; description?: string } = () => ({ ok: true }),
): Promise<Captured[]> {
  const calls: Captured[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ body });
    return { json: async () => respond(body.chat_id) } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }

  return calls;
}

test("a plain chat id sends no message_thread_id", async () => {
  const calls = await capture(() =>
    sendTelegramMessage({ botToken: "123:abc", chatId: "-1001234567890" }, "hi"));
  assert.equal(calls[0].body.chat_id, "-1001234567890");
  assert.equal("message_thread_id" in calls[0].body, false);
});

test("a forum-topic target splits into chat_id + message_thread_id", async () => {
  const calls = await capture(() =>
    sendTelegramMessage({ botToken: "123:abc", chatId: "-1001234567890:42" }, "hi"));
  assert.equal(calls[0].body.chat_id, "-1001234567890");
  assert.equal(calls[0].body.message_thread_id, 42);
});

test("an unparseable id is passed through so Telegram's own error surfaces", async () => {
  const calls = await capture(() =>
    sendTelegramMessage({ botToken: "123:abc", chatId: "@somechannel" }, "hi"));
  assert.equal(calls[0].body.chat_id, "@somechannel");
});

test("fan-out reaches every destination", async () => {
  const calls = await capture(() =>
    sendTelegramToAll("123:abc", ["-100111", "222", "-100333:9"], "hi"));
  assert.deepEqual(calls.map((c) => c.body.chat_id), ["-100111", "222", "-100333"]);
  assert.equal(calls[2].body.message_thread_id, 9);
});

test("one bad destination does not silence the others", async () => {
  // A bot removed from one group, or one typo, used to be the whole
  // notification. Every destination is attempted and the failures are named.
  let result!: Awaited<ReturnType<typeof sendTelegramToAll>>;
  await capture(
    async () => { result = await sendTelegramToAll("123:abc", ["-100bad", "-100good"], "hi"); },
    (chatId) => chatId === "-100bad"
      ? { ok: false, description: "bot is not a member of the chat" }
      : { ok: true },
  );

  assert.equal(result.success, true, "the surviving destination counts as delivered");
  assert.equal(result.delivered, 1);
  assert.deepEqual(result.failures, [
    { chatId: "-100bad", message: "bot is not a member of the chat" },
  ]);
});

test("every destination failing is reported as a failure", async () => {
  let result!: Awaited<ReturnType<typeof sendTelegramToAll>>;
  await capture(
    async () => { result = await sendTelegramToAll("123:abc", ["-100a", "-100b"], "hi"); },
    () => ({ ok: false, description: "chat not found" }),
  );

  assert.equal(result.success, false);
  assert.equal(result.delivered, 0);
  assert.equal(result.failures.length, 2);
});
