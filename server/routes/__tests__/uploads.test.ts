import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { db } from "../../db.js";
import { registerUploadRoutes } from "../uploads.js";
import { listen } from "./helpers/boardsHarness.js";

// The board-image signing route up to the point where it would call Supabase:
// admin only, a clear 503 when storage is not configured, payload checks.

function createApp() {
  (db as unknown as { select: () => unknown }).select = () => ({
    from: () => ({ where: async () => [{ isAdmin: true }] }),
  });
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { session: object }).session = req.get("x-test-admin") === "1" ? { userId: "admin" } : {};
    next();
  });
  app.use(express.json());
  registerUploadRoutes(app);
  return app;
}

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function post(baseUrl: string, body: unknown, admin = true) {
  const res = await fetch(`${baseUrl}/api/uploads/board-image/sign`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(admin ? { "x-test-admin": "1" } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test("board image signing: admin only, 503 without storage, validates the file name", async () => {
  const { server, baseUrl } = await listen(createApp());
  try {
    assert.equal((await post(baseUrl, { filename: "a.png" }, false)).status, 401);

    await withEnv({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
      const res = await post(baseUrl, { filename: "a.png" });
      assert.equal(res.status, 503);
      assert.equal(res.json.code, "storage_not_configured");
    });

    await withEnv({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test" }, async () => {
      assert.equal((await post(baseUrl, {})).status, 400);
      assert.equal((await post(baseUrl, { filename: "logo.svg" })).status, 415);
      assert.equal((await post(baseUrl, { filename: "run.exe" })).status, 415);
    });
  } finally {
    server.close();
  }
});
