import assert from "node:assert/strict";
import { test } from "node:test";
import { SENTRY_IGNORE_ERRORS, isMcpClientError, scrubQueryParams } from "../sentry-scrub";

const SQL = 'Failed query: select "id" from "api_tokens" where "api_tokens"."token_hash" = $1';

test("removes bound values from every place a failed query appears", () => {
  const event = scrubQueryParams({
    message: `[seo] lookup failed: ${SQL}\nparams: secret-hash`,
    logentry: { message: `${SQL}\nparams: secret-hash` },
    exception: { values: [{ value: `${SQL}\nparams: secret-hash` }, { value: "getaddrinfo EAI_AGAIN" }] },
    extra: {
      arguments: ["[mcp] failed:", { message: `${SQL}\nparams: secret-hash`, params: ["secret-hash"].length }],
    },
    breadcrumbs: [{ category: "console", message: `${SQL}\nparams: secret-hash` }],
  });

  assert.equal(JSON.stringify(event).includes("secret-hash"), false);
  assert.equal(event.message, `[seo] lookup failed: ${SQL}`);
  assert.equal(event.exception?.values?.[1]?.value, "getaddrinfo EAI_AGAIN");
});

test("keeps the stack trace that follows the values", () => {
  const event = scrubQueryParams({
    extra: { stack: `Error: ${SQL}\nparams: secret,multi\nline value\n    at queryWithCache (session.ts:73:11)` },
  });

  assert.deepEqual(event.extra, { stack: `Error: ${SQL}\n    at queryWithCache (session.ts:73:11)` });
});

test("handles a query with no bound values", () => {
  assert.equal(scrubQueryParams({ message: `${SQL}\nparams: ` }).message, SQL);
});

test("leaves text that is not a failed query untouched", () => {
  const message = "Webhook payload\nparams: keep-this";
  assert.equal(scrubQueryParams({ message }).message, message);
});

test("ignores Node deprecation warnings and nothing else", () => {
  const ignored = (text: string) => SENTRY_IGNORE_ERRORS.some((pattern) => pattern.test(text));

  // SKALECLUB-BACKEND-G and SKALECLUB-BACKEND-1, verbatim.
  assert.equal(ignored("(node:1) [DEP0040] DeprecationWarning: The `punycode` module is deprecated."), true);
  assert.equal(ignored("(node:1) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized"), true);
  assert.equal(ignored("Error: DeprecationWarning handler crashed"), false);
});

function mcpEvent(value: string, type = "auto.ai.mcp_server") {
  return { exception: { values: [{ value, mechanism: { type } }] } };
}

test("drops requests the MCP transport refused", () => {
  // SKALECLUB-BACKEND-H, verbatim.
  for (const message of [
    "Bad Request: Unsupported protocol version: 2026-07-28 (supported versions: 2025-11-25)",
    "Not Acceptable: Client must accept text/event-stream",
    "Method not allowed.",
  ]) {
    assert.equal(isMcpClientError(mcpEvent(message)), true, message);
  }
});

test("keeps real failures from the MCP server", () => {
  assert.equal(isMcpClientError(mcpEvent("Failed query: select 1")), false);
  assert.equal(isMcpClientError(mcpEvent("Cannot read properties of undefined")), false);
});

test("keeps the same text when it did not come from the MCP transport", () => {
  assert.equal(isMcpClientError(mcpEvent("Bad Request: upstream rejected the call", "generic")), false);
  assert.equal(isMcpClientError({ message: "Bad Request" }), false);
});
