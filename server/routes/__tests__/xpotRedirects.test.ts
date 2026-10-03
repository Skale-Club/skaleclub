import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { registerXpotRedirects } from "../xpotRedirects.js";

async function withServer(fn: (get: (path: string) => Promise<Response>) => Promise<void>) {
  const app = express();
  registerXpotRedirects(app);
  // Anything the redirects don't claim falls through to here.
  app.use((_req, res) => res.status(404).send("not found"));
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    await fn((path) => fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" }));
  } finally {
    server.close();
  }
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("the old phone app paths 302 to the Xpot tags app (default host)", () =>
  withEnv({ XPOT_APP_URL: undefined }, () =>
    withServer(async (get) => {
      for (const path of ["/nfc", "/nfc/", "/nfc/home?source=pwa", "/nfc/t/ABC123", "/smart-tags", "/smart-tags/x/y"]) {
        const res = await get(path);
        assert.equal(res.status, 302, path);
        assert.equal(res.headers.get("location"), "https://xpot.place/tags", path);
      }
    }),
  ));

test("XPOT_APP_URL overrides the app host (trailing slash tolerated)", () =>
  withEnv({ XPOT_APP_URL: "https://app.example.test/" }, () =>
    withServer(async (get) => {
      const res = await get("/nfc/home");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "https://app.example.test/tags");
    }),
  ));

test("public tag links 301 to Xpot, keeping the code and the query string", () =>
  withEnv({ XPOT_TAGS_BASE_URL: undefined }, () =>
    withServer(async (get) => {
      let res = await get("/n/AB12CD");
      assert.equal(res.status, 301);
      assert.equal(res.headers.get("location"), "https://xpot.place/n/AB12CD");

      res = await get("/q/AB12CD?utm_source=flyer&x=1%202");
      assert.equal(res.status, 301);
      assert.equal(res.headers.get("location"), "https://xpot.place/q/AB12CD?utm_source=flyer&x=1%202");
    }),
  ));

test("XPOT_TAGS_BASE_URL overrides the tag link host", () =>
  withEnv({ XPOT_TAGS_BASE_URL: "https://go.example.test" }, () =>
    withServer(async (get) => {
      const res = await get("/q/zz9?ref=a");
      assert.equal(res.status, 301);
      assert.equal(res.headers.get("location"), "https://go.example.test/q/zz9?ref=a");
    }),
  ));

test("storefront NFC pages are not caught by the redirects", () =>
  withServer(async (get) => {
    for (const path of ["/nfc-guide", "/nfc-order", "/nfc-keychains", "/n", "/q", "/n/a/b", "/smart-tagsx"]) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
    }
  }));
