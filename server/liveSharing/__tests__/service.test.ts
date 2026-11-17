import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LiveSharingError, LiveSharingService } from "../service.js";
import { MemoryLiveStore } from "./memoryStore.js";
import { createLiveSchema, liveCommandSchema, liveSlideCount, type LiveSnapshot } from "#shared/liveSharing.js";
import { isLanguageExemptPath, withLanguage } from "#shared/languagePath.js";
import { isNoindexPath } from "#shared/coreSeo.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";

const branding = { companyName: "Example", logoAvatarFull: null, logoAvatarMark: null, logoIcon: null, logoMain: null, logoDark: null };
const deck: LiveSnapshot = { kind: "presentation", title: "Pitch", branding, slides: [{ layout: "cover", heading: "First" }, { layout: "closing", heading: "Last" }] };
const estimate: LiveSnapshot = { kind: "estimate", title: "Quote", branding, estimate: {
  id: 1, slug: "quote", clientName: "Example", companyName: null, contactName: null, note: null,
  services: [{ type: "custom", title: "Service", description: "Work", price: "$100", features: [], order: 0 }], createdAt: null, hasAccessCode: true,
} };
function setup() {
  let now = new Date("2026-11-16T23:00:00Z");
  const store = new MemoryLiveStore();
  const source = structuredClone(deck);
  const service = new LiveSharingService(store, {
    secret: () => "a-persistent-test-secret-at-least-32-characters",
    now: () => now,
    loadSource: async (kind, id) => id === "missing" ? undefined : kind === "presentation" ? { snapshot: source } : { snapshot: estimate, accessCode: "123456" },
  });
  return { service, store, source, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}
const errorStatus = (status: number) => (error: unknown) => error instanceof LiveSharingError && error.status === status;

test("sharing is opt-in: creating a session does not issue or enable an audience link", async () => {
  const { service, store } = setup();
  const created = await service.create("owner", "presentation", "p1", "en");
  assert.equal(created.state.slideIndex, 0);
  assert.equal((await store.get(created.state.id))?.audienceHash, null);
  assert.equal("audienceToken" in created, false);
  assert.equal("controllerHash" in created, false);
  await assert.rejects(service.join(created.state.id, "anything"), errorStatus(401));
});
test("late viewers see the latest slide/language and the pinned source snapshot", async () => {
  const { service, source } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  const { audienceToken } = await service.share(c.state.id, "owner", c.controllerToken);
  await service.command(c.state.id, "owner", { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate", slideIndex: 1 } });
  await service.command(c.state.id, "owner", { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 1, command: { type: "language", language: "pt-BR" } });
  source.slides[1].heading = "An edit made after the session started";
  const joined = await service.join(c.state.id, audienceToken);
  assert.equal(joined.view.state.slideIndex, 1);
  assert.equal(joined.view.state.language, "pt-BR");
  assert.deepEqual(joined.view.snapshot, deck);
  assert.deepEqual(await service.audience(c.state.id, joined.credential), joined.view);
  assert.equal(JSON.stringify(joined.view).includes(c.controllerToken), false);
});
test("estimate session uses the same controls and preserves its access-code gate", async () => {
  const { service } = setup();
  const c = await service.create("owner", "estimate", "1", "pt-BR");
  assert.equal(c.requiresAccessCode, true);
  assert.equal(liveSlideCount(c.snapshot), 4);
  const { audienceToken } = await service.share(c.state.id, "owner", c.controllerToken);
  await assert.rejects(service.join(c.state.id, audienceToken), (e: unknown) => e instanceof LiveSharingError && e.code === "access_code_required");
  await assert.rejects(service.join(c.state.id, audienceToken, "bad"), errorStatus(401));
  // Knowing the share token cannot bypass the gate by forging the viewer cookie.
  await assert.rejects(service.audience(c.state.id, audienceToken), errorStatus(401));
  const joined = await service.join(c.state.id, audienceToken, "123456");
  assert.equal(JSON.stringify(joined).includes("123456"), false);
  await service.command(c.state.id, "owner", { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate", slideIndex: 3 } });
  assert.equal((await service.audience(c.state.id, joined.credential)).state.slideIndex, 3);
});
test("only the owner and the active controller can mutate a session", async () => {
  const { service } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  await assert.rejects(service.presenter(c.state.id, "other"), errorStatus(403));
  await assert.rejects(service.takeover(c.state.id, "other"), errorStatus(403));
  const takeover = await service.takeover(c.state.id, "owner");
  assert.notEqual(takeover.controllerToken, c.controllerToken);
  await assert.rejects(service.heartbeat(c.state.id, "owner", c.controllerToken), errorStatus(403));
  await assert.rejects(service.share(c.state.id, "owner", c.controllerToken), errorStatus(403));
  assert.equal((await service.heartbeat(c.state.id, "owner", takeover.controllerToken)).state.status, "live");
});
test("duplicate/reordered commands cannot regress navigation, including concurrent writes", async () => {
  const { service } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  const input = { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate" as const, slideIndex: 1 } };
  const results = await Promise.allSettled([service.command(c.state.id, "owner", input), service.command(c.state.id, "owner", { ...input, commandId: randomUUID(), command: { type: "navigate", slideIndex: 0 } })]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const duplicate = await service.command(c.state.id, "owner", input);
  assert.equal(duplicate.state.revision, 1);
  assert.equal(duplicate.state.slideIndex, 1);
  await assert.rejects(service.command(c.state.id, "owner", { ...input, commandId: randomUUID() }), errorStatus(409));
});
test("invalid indices do not commit state; independent sessions remain isolated", async () => {
  const { service } = setup();
  const a = await service.create("owner", "presentation", "p1", "en");
  const b = await service.create("owner", "presentation", "p1", "en");
  await assert.rejects(service.command(a.state.id, "owner", { controllerToken: a.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate", slideIndex: 2 } }), errorStatus(400));
  assert.equal((await service.presenter(a.state.id, "owner")).state.revision, 0);
  const { audienceToken } = await service.share(a.state.id, "owner", a.controllerToken);
  await assert.rejects(service.join(b.state.id, audienceToken), errorStatus(401));
});
test("rotating/revoking sharing invalidates existing links and code-verified viewer credentials", async () => {
  const { service } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  const first = await service.share(c.state.id, "owner", c.controllerToken);
  const old = await service.join(c.state.id, first.audienceToken);
  const second = await service.share(c.state.id, "owner", c.controllerToken);
  await assert.rejects(service.join(c.state.id, first.audienceToken), errorStatus(401));
  await assert.rejects(service.audience(c.state.id, old.credential), errorStatus(401));
  const fresh = await service.join(c.state.id, second.audienceToken);
  await service.revoke(c.state.id, "owner", c.controllerToken);
  await assert.rejects(service.audience(c.state.id, fresh.credential), errorStatus(401));
});
test("heartbeats distinguish a disconnected presenter; restart restores persisted state", async () => {
  const { service, store, advance } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  advance(46_000);
  assert.equal((await service.presenter(c.state.id, "owner")).state.status, "disconnected");
  await service.heartbeat(c.state.id, "owner", c.controllerToken);
  assert.equal((await service.presenter(c.state.id, "owner")).state.status, "live");
  const restarted = new LiveSharingService(store, { secret: () => "a-persistent-test-secret-at-least-32-characters", loadSource: async () => undefined });
  assert.equal((await restarted.presenter(c.state.id, "owner")).snapshot.title, "Pitch");
});
test("ending/expiry stop joining, viewing and controller commands", async () => {
  for (const mode of ["end", "expire"] as const) {
    const { service, advance } = setup();
    const c = await service.create("owner", "presentation", "p1", "en");
    const { audienceToken } = await service.share(c.state.id, "owner", c.controllerToken);
    const joined = await service.join(c.state.id, audienceToken);
    if (mode === "end") await service.command(c.state.id, "owner", { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "end" } });
    else advance(4 * 60 * 60_000);
    await assert.rejects(service.join(c.state.id, audienceToken), errorStatus(410));
    await assert.rejects(service.audience(c.state.id, joined.credential), errorStatus(410));
    await assert.rejects(service.heartbeat(c.state.id, "owner", c.controllerToken), errorStatus(410));
  }
});
test("missing documents and unsafe configuration fail without creating sessions", async () => {
  const { service, store } = setup();
  await assert.rejects(service.create("owner", "presentation", "missing", "en"), errorStatus(404));
  const unsafe = new LiveSharingService(store, { secret: () => "short", loadSource: async () => ({ snapshot: deck }) });
  await assert.rejects(unsafe.create("owner", "presentation", "p1", "en"), errorStatus(503));
  assert.equal(store.rows.size, 0);
});
test("PostgreSQL timestamp strings are normalized for mobile browsers", async () => {
  const { service, store } = setup();
  const c = await service.create("owner", "presentation", "p1", "en");
  const { audienceToken } = await service.share(c.state.id, "owner", c.controllerToken);
  const joined = await service.join(c.state.id, audienceToken);
  await store.mutate(c.state.id, (row) => { row.expiresAt = "2026-11-17 03:00:00+00"; });
  assert.equal((await service.presenter(c.state.id, "owner")).state.expiresAt, "2026-11-17T03:00:00.000Z");
  assert.equal((await service.audience(c.state.id, joined.credential)).state.status, "live");
});
test("live protocol rejects unknown fields/negative indices and private URLs stay outside site languages/search", () => {
  assert.equal(createLiveSchema.safeParse({ kind: "estimate", sourceId: "1", audienceToken: "injected" }).success, false);
  assert.equal(liveCommandSchema.safeParse({ controllerToken: "x".repeat(43), commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate", slideIndex: -1 } }).success, false);
  assert.equal(isLanguageExemptPath("/live/example"), true);
  assert.equal(withLanguage("/live/example", "pt"), "/live/example");
  assert.equal(isNoindexPath("/live/example"), true);
  assert.equal(isReservedSlug("live"), true);
});
