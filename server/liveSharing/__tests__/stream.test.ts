import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import type { Response } from "express";
import { LiveStreams } from "../stream.js";
import { LiveSharingService } from "../service.js";
import { MemoryLiveStore } from "./memoryStore.js";

class FakeResponse extends EventEmitter {
  writableLength = 0;
  destroyed = false;
  write(_data: string) { return true; }
  end() { this.emit("close"); return this; }
  destroy() { this.destroyed = true; this.emit("close"); return this; }
}
async function setup() {
  const service = new LiveSharingService(new MemoryLiveStore(), {
    secret: () => "stream-test-secret-at-least-32-characters",
    loadSource: async () => ({ snapshot: {
      kind: "presentation", title: "Pitch", slides: [{ layout: "cover" }],
      branding: { companyName: "Example", logoAvatarFull: null, logoAvatarMark: null, logoIcon: null, logoMain: null, logoDark: null },
    } }),
  });
  const c = await service.create("owner", "presentation", "p1", "en");
  const { audienceToken } = await service.share(c.state.id, "owner", c.controllerToken);
  const { credential } = await service.join(c.state.id, audienceToken);
  return { streams: new LiveStreams(service), id: c.state.id, credential };
}
test("room caps bound audience and presenter connections and release slots on close", async () => {
  const { streams, id, credential } = await setup();
  const clients: FakeResponse[] = [];
  try {
    for (let i = 0; i < 50; i++) {
      assert.equal(streams.canConnect(id, false), true);
      const client = new FakeResponse(); clients.push(client);
      streams.attach(id, client as unknown as Response, credential, false);
    }
    assert.equal(streams.audienceCount(id), 50);
    assert.equal(streams.canConnect(id, false), false);
    for (let i = 0; i < 5; i++) {
      assert.equal(streams.canConnect(id, true), true);
      const client = new FakeResponse(); clients.push(client);
      streams.attach(id, client as unknown as Response, "", true);
    }
    assert.equal(streams.canConnect(id, true), false);
    clients[0].destroy();
    assert.equal(streams.audienceCount(id), 49);
    assert.equal(streams.canConnect(id, false), true);
  } finally { streams.close(); }
});
test("a slow SSE consumer is disconnected instead of growing its output buffer", async () => {
  const { streams, id, credential } = await setup();
  const client = new FakeResponse(); client.writableLength = 65 * 1024;
  const closed = once(client, "close");
  try {
    streams.attach(id, client as unknown as Response, credential, false);
    await closed;
    assert.equal(client.destroyed, true);
    assert.equal(streams.audienceCount(id), 0);
  } finally { streams.close(); }
});
