import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { analyticsWindow, registerSmartTagAdminRoutes } from "../smartTags.js";

const ID = "11111111-1111-4111-8111-111111111111";

test("every smart-tag admin endpoint refuses anonymous callers", async () => {
  const app = express();
  app.use(express.json());
  // No session middleware → no session → requireAdmin must stop every request.
  registerSmartTagAdminRoutes(app);
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    const calls: Array<[string, string]> = [
      ["GET", "/api/admin/smart-tags/overview"],
      ["GET", "/api/admin/smart-tags/analytics"],
      ["GET", "/api/admin/smart-tags"],
      ["POST", "/api/admin/smart-tags"],
      ["GET", `/api/admin/smart-tags/${ID}`],
      ["PATCH", `/api/admin/smart-tags/${ID}`],
      ["POST", `/api/admin/smart-tags/${ID}/assign`],
      ["POST", `/api/admin/smart-tags/${ID}/activate`],
      ["POST", `/api/admin/smart-tags/${ID}/disable`],
      ["POST", `/api/admin/smart-tags/${ID}/retire`],
      ["GET", `/api/admin/smart-tags/${ID}/analytics`],
      ["GET", `/api/admin/smart-tags/${ID}/qr.svg`],
      ["GET", "/api/admin/smart-tags/lookup/A7K3P9X2"],
      ["GET", "/api/admin/smart-tag-customers"],
      ["POST", "/api/admin/smart-tag-customers"],
      ["PATCH", `/api/admin/smart-tag-customers/${ID}`],
      ["GET", "/api/admin/smart-tag-batches"],
      ["POST", "/api/admin/smart-tag-batches"],
      ["GET", `/api/admin/smart-tag-batches/${ID}`],
      ["GET", `/api/admin/smart-tag-batches/${ID}/export.csv`],
      ["GET", `/api/admin/smart-tag-batches/${ID}/qr-assets.zip`],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify({ destinationUrl: "https://evil.example" }),
      });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  } finally {
    server.close();
  }
});

test("analytics window: presets, custom ranges and the one-year cap", () => {
  const now = new Date("2026-10-01T15:00:00Z");
  const today = analyticsWindow({ range: "today" }, now);
  assert.equal(today.from.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(analyticsWindow({ range: "7d" }, now).from.toISOString(), "2026-09-24T15:00:00.000Z");
  assert.equal(analyticsWindow({}, now).from.toISOString(), "2026-09-01T15:00:00.000Z");
  const capped = analyticsWindow({ from: "2020-01-01T00:00:00Z", to: "2026-10-01T00:00:00Z" }, now);
  assert.equal(capped.to.getTime() - capped.from.getTime(), 366 * 86_400_000);
});
