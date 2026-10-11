import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { IStorage } from "../storage.js";
import { dispatchNotification } from "./notifications.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function telegramStorage(options?: { enabled?: boolean; destinations?: string[] }): IStorage {
  const enabled = options?.enabled ?? true;
  const destinations = options?.destinations ?? ["-100123"];

  return {
    getNotificationTemplates: async () => [{
      id: 1,
      name: "Lead Telegram",
      eventKey: "hot_lead",
      channel: "telegram",
      subject: null,
      body: "New lead: {{name}} | {{phone}}",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
    getTelegramSettings: async () => ({
      id: 1,
      enabled,
      botToken: "test-token",
      chatId: null,
      chatIds: destinations,
      approvalsEnabled: false,
      approvalsBotToken: null,
      approvalsChatIds: [],
      webhookSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  } as unknown as IStorage;
}

test("reports a confirmed Telegram delivery", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await dispatchNotification(telegramStorage(), "hot_lead", {
    name: "Vanildo",
    phone: "+1 555 123 4567",
  });

  assert.equal(result.attempted, 1);
  assert.equal(result.delivered, 1);
  assert.deepEqual(result.deliveredChannels, ["telegram"]);
  assert.deepEqual(result.failures, []);
});

test("does not report delivery when Telegram is disabled", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ ok: true }));
  };

  const result = await dispatchNotification(
    telegramStorage({ enabled: false }),
    "hot_lead",
    { name: "Lead", phone: "No phone" },
  );

  assert.equal(called, false);
  assert.equal(result.attempted, 0);
  assert.equal(result.delivered, 0);
  assert.deepEqual(result.deliveredChannels, []);
  assert.match(result.failures[0]?.message ?? "", /disabled/i);
});

test("reports Telegram API failures without acknowledging delivery", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    description: "Forbidden: bot was removed from the group",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await dispatchNotification(telegramStorage(), "hot_lead", {
    name: "Lead",
    phone: "+1 555 000 0000",
  });

  assert.equal(result.attempted, 1);
  assert.equal(result.delivered, 0);
  assert.deepEqual(result.deliveredChannels, []);
  assert.match(result.failures[0]?.message ?? "", /removed from the group/i);
});
