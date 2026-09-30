import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { botDefenseMiddleware, clientIpMiddleware } from "../botDefenseMiddleware.js";
import { __resetBotDefense, banRemainingMs } from "../botDefense.js";
import { isBotSubmission } from "../botTrap.js";

async function withApp(fn: (base: string) => Promise<void>) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(clientIpMiddleware);
  app.use(botDefenseMiddleware);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  app.get("/", (_req, res) => res.send("home"));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test("req.ip is the visitor with or without Cloudflare in front", async () => {
  await withApp(async (base) => {
    const viaCf = await fetch(`${base}/ip`, { headers: { "x-forwarded-for": "198.51.100.44, 172.70.1.1", "cf-connecting-ip": "198.51.100.44" } });
    assert.equal((await viaCf.json()).ip, "198.51.100.44");
    const direct = await fetch(`${base}/ip`, { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9", "cf-connecting-ip": "1.2.3.4" } });
    assert.equal((await direct.json()).ip, "203.0.113.9");
  });
});

test("trap path bans the scanner; /api/health stays reachable", async () => {
  __resetBotDefense();
  await withApp(async (base) => {
    const h = { "x-forwarded-for": "203.0.113.200" };
    assert.equal((await fetch(`${base}/wp-config.php`, { headers: h })).status, 404);
    assert.equal((await fetch(`${base}/`, { headers: h })).status, 403);
    assert.equal((await fetch(`${base}/api/health`, { headers: h })).status, 200);
  });
});

test("botTrap keeps its contract and repeated trips lead to a ban", () => {
  __resetBotDefense();
  assert.equal(isBotSubmission({ name: "x", elapsedMs: 9000 }, { source: "t" }), false);
  assert.equal(isBotSubmission({ elapsedMs: 100 }, { source: "t", checkElapsed: false }), false);
  assert.equal(isBotSubmission({ elapsedMs: 100 }, { source: "t" }), true);
  for (let i = 0; i < 5; i++) isBotSubmission({ hp_extra: "spam" }, { source: "t", ip: "203.0.113.77" });
  assert.ok(banRemainingMs("203.0.113.77") > 0);
});
