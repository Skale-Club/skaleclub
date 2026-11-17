import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { registerLiveSharingRoutes } from "../liveSharing.js";
import { LiveSharingService } from "../../liveSharing/service.js";
import { MemoryLiveStore } from "../../liveSharing/__tests__/memoryStore.js";
import { originCheck } from "../../lib/originCheck.js";
import type { LiveSnapshot, LiveState } from "#shared/liveSharing.js";

const branding = { companyName: "Example", logoMain: null, logoDark: null, logoAvatarFull: null, logoAvatarMark: null, logoIcon: null };
const deck: LiveSnapshot = { kind: "presentation", title: "Pitch", branding, slides: [{ layout: "cover", heading: "Hello" }, { layout: "closing", heading: "Goodbye" }] };
async function harness(run: (h: {
  call: (path: string, body?: unknown, options?: { admin?: string; cookie?: string; origin?: string }) => Promise<Response>;
  events: (id: string, cookie: string, presenter?: boolean) => Promise<{ state: () => Promise<LiveState>; close: () => void }>;
  service: LiveSharingService;
  setEnabled: (enabled: boolean) => void;
}) => Promise<void>) {
  let enabled = true;
  const store = new MemoryLiveStore();
  const service = new LiveSharingService(store, {
    secret: () => "live-routes-test-secret-at-least-32-characters",
    loadSource: async (kind) => kind === "presentation" ? { snapshot: deck } : {
      snapshot: { kind: "estimate", title: "Confidential quote", branding, estimate: { id: 1, clientName: "Client", companyName: null, contactName: null, note: null, slug: "quote", services: [], createdAt: null, hasAccessCode: true } }, accessCode: "code-123",
    },
  });
  const app = express();
  app.use(express.json()); app.use(originCheck);
  app.use((req, _res, next) => { (req as any).session = req.get("x-admin") ? { userId: req.get("x-admin") } : {}; next(); });
  const requireAdmin: RequestHandler = (req, res, next) => { if (!req.get("x-admin")) { res.status(401).json({ message: "Authentication required" }); return; } next(); };
  const streams = registerLiveSharingRoutes(app, { service, requireAdmin, enabled: () => enabled });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const controllers: AbortController[] = [];
  try {
    await run({ service, setEnabled: (value) => { enabled = value; },
      call: (path, body, opts = {}) => fetch(`${origin}/api/live-sessions${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(opts.admin ? { "x-admin": opts.admin } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.origin ? { origin: opts.origin } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      events: async (id, cookie, presenter = false) => {
        const controller = new AbortController(); controllers.push(controller);
        const response = await fetch(`${origin}/api/live-sessions/${id}/events${presenter ? "?role=presenter" : ""}`, { headers: presenter ? { "x-admin": "owner" } : { cookie }, signal: controller.signal });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream(?:;|$)/);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
        const reader = response.body!.getReader(), decoder = new TextDecoder();
        let buffer = "";
        return { close: () => controller.abort(), state: async () => {
          const deadline = setTimeout(() => controller.abort(), 3000);
          try {
            while (true) {
              let boundary: number;
              while ((boundary = buffer.indexOf("\n\n")) !== -1) {
                const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
                if (event.includes("event: state\n")) return JSON.parse(event.split("\ndata: ")[1]) as LiveState;
              }
              const { done, value } = await reader.read();
              if (done) throw new Error("Stream closed before state");
              buffer += decoder.decode(value, { stream: true });
            }
          } finally { clearTimeout(deadline); }
        } };
      },
    });
  } finally {
    controllers.forEach((c) => c.abort()); streams.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("live sharing is disabled until explicitly enabled and does not require a database to report config", () => harness(async ({ call, setEnabled }) => {
  setEnabled(false);
  assert.deepEqual(await (await call("/config")).json(), { enabled: false });
  assert.equal((await call("", { kind: "presentation", sourceId: "p1" }, { admin: "owner" })).status, 404);
}));
test("session creation/control are admin-only, checked by owner, and cross-site commands are blocked", () => harness(async ({ call }) => {
  assert.equal((await call("", { kind: "presentation", sourceId: "p1" })).status, 401);
  const response = await call("", { kind: "presentation", sourceId: "p1" }, { admin: "owner" });
  assert.equal(response.status, 201);
  const c = await response.json();
  assert.equal((await call(`/${c.state.id}/presenter`)).status, 401);
  assert.equal((await call(`/${c.state.id}/presenter`, undefined, { admin: "other" })).status, 403);
  assert.equal((await call(`/${c.state.id}/share`, { controllerToken: c.controllerToken }, { admin: "owner", origin: "https://evil.example" })).status, 403);
  assert.equal((await call("/not-a-uuid/view")).status, 400);
  assert.equal((await call(`/${c.state.id}/events?role=presenter`)).status, 401);
}));
test("the estimate code gate is enforced before a scoped HttpOnly cookie or financial snapshot is issued", () => harness(async ({ call }) => {
  const c = await (await call("", { kind: "estimate", sourceId: "1" }, { admin: "owner" })).json();
  const shared = await (await call(`/${c.state.id}/share`, { controllerToken: c.controllerToken }, { admin: "owner" })).json();
  const blocked = await call(`/${c.state.id}/join`, { token: shared.audienceToken });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.headers.has("set-cookie"), false);
  const denied = await blocked.json();
  assert.equal(denied.code, "access_code_required");
  assert.equal("snapshot" in denied, false);
  const joined = await call(`/${c.state.id}/join`, { token: shared.audienceToken, code: "code-123" });
  assert.equal(joined.status, 200);
  const cookie = joined.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  assert.ok(cookie.includes(`Path=/api/live-sessions/${c.state.id}`));
  assert.equal(cookie.includes(shared.audienceToken), false);
  assert.equal((await joined.text()).includes("code-123"), false);
  assert.equal((await call(`/${c.state.id}/view`, undefined, { cookie: `live_viewer=${shared.audienceToken}` })).status, 401);
  assert.equal((await call(`/${c.state.id}/view`, undefined, { cookie: cookie.split(";")[0] })).status, 200);
}));
test("SSE delivers initial state, committed navigation, reconnect recovery and session end", () => harness(async ({ call, events }) => {
  const c = await (await call("", { kind: "presentation", sourceId: "p1" }, { admin: "owner" })).json();
  const share = await (await call(`/${c.state.id}/share`, { controllerToken: c.controllerToken }, { admin: "owner" })).json();
  const join = await call(`/${c.state.id}/join`, { token: share.audienceToken });
  const cookie = join.headers.get("set-cookie")!.split(";")[0];
  const stream = await events(c.state.id, cookie);
  assert.equal((await stream.state()).slideIndex, 0);
  const next = await call(`/${c.state.id}/command`, { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0, command: { type: "navigate", slideIndex: 1 } }, { admin: "owner" });
  assert.equal(next.status, 200);
  assert.equal((await stream.state()).slideIndex, 1);
  stream.close();
  const reconnect = await events(c.state.id, cookie);
  assert.equal((await reconnect.state()).slideIndex, 1);
  await call(`/${c.state.id}/command`, { controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 1, command: { type: "end" } }, { admin: "owner" });
  assert.equal((await reconnect.state()).status, "ended");
  assert.equal((await call(`/${c.state.id}/view`, undefined, { cookie })).status, 410);
}));
test("revocation immediately terminates existing viewers while presenter keeps control", () => harness(async ({ call, events }) => {
  const c = await (await call("", { kind: "presentation", sourceId: "p1" }, { admin: "owner" })).json();
  const share = await (await call(`/${c.state.id}/share`, { controllerToken: c.controllerToken }, { admin: "owner" })).json();
  const joined = await call(`/${c.state.id}/join`, { token: share.audienceToken });
  const stream = await events(c.state.id, joined.headers.get("set-cookie")!.split(";")[0]);
  await stream.state();
  await call(`/${c.state.id}/revoke`, { controllerToken: c.controllerToken }, { admin: "owner" });
  assert.equal((await stream.state()).status, "ended");
  const presenter = await events(c.state.id, "", true);
  assert.equal((await presenter.state()).status, "live");
}));
