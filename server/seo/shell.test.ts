import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildShell, NOT_FOUND_CACHE_CONTROL, PRIVATE_HTML_CACHE_CONTROL, PUBLIC_HTML_CACHE_CONTROL } from "./shell.js";

// No database and no built SSR bundle here: settings are unavailable (the query is refused
// and the shell carries on) and the React render is switched off, so these exercise the
// text fallback, the status/cache decisions and the loader rules.
process.env.ENABLE_REACT_SSR = "false";
const template = readFileSync(path.resolve("client/index.html"), "utf8");

test("an indexable page gets text in normal flow, no loader, and a short edge cache", async () => {
  const shell = await buildShell({ template, pathname: "/" });
  assert.equal(shell.status, 200);
  assert.equal(shell.cacheControl, PUBLIC_HTML_CACHE_CONTROL);
  assert.match(shell.cacheControl, /s-maxage=60, stale-while-revalidate=60/);
  assert.equal(shell.reactRendered, false);
  assert.match(shell.html, /<h1>/);
  assert.ok(!shell.html.includes("initial-loader"), "the loader and the text are never served together");
  // Never an overlay: that sheet over the real page is what Google scored as Soft 404.
  assert.ok(!/position:\s*fixed/.test(shell.html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? ""), "the text block must not be fixed");
  assert.ok(shell.html.indexOf('id="seo-content"') < shell.html.indexOf('<div id="root">'), "the block sits ahead of #root, outside it");
});

test("an unknown URL is a 404, noindex, never cached, with a readable body", async () => {
  const shell = await buildShell({ template, pathname: "/br/admin" });
  assert.equal(shell.status, 404);
  assert.equal(shell.noindex, true);
  assert.equal(shell.cacheControl, NOT_FOUND_CACHE_CONTROL);
  assert.match(shell.cacheControl, /s-maxage=0/);
  assert.match(shell.html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(shell.html, /<h1>Page Not Found<\/h1>/);
  assert.ok(!shell.html.includes("initial-loader"));
});

test("admin keeps the loader, gets no text and is not cached", async () => {
  const shell = await buildShell({ template, pathname: "/admin" });
  assert.equal(shell.status, 200);
  assert.equal(shell.noindex, true);
  assert.equal(shell.cacheControl, PRIVATE_HTML_CACHE_CONTROL);
  assert.ok(shell.html.includes('id="initial-loader"'));
  assert.ok(!shell.html.includes('id="seo-content"'));
});

test("development never lets anything cache the HTML", async () => {
  const shell = await buildShell({ template, pathname: "/", dev: true });
  assert.equal(shell.cacheControl, PRIVATE_HTML_CACHE_CONTROL);
});
