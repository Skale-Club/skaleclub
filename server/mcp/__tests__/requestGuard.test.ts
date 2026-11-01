import assert from "node:assert/strict";
import { test } from "node:test";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { rejectUnservableMcpRequest } from "../requestGuard.js";

async function sdkResponse(method: string, accept?: string) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const errors: string[] = [];
  transport.onerror = (err) => errors.push(err.message);
  const response = await transport.handleRequest(
    new Request("https://skale.club/mcp", { method, headers: accept ? { accept } : {} }),
  );
  return { status: response.status, allow: response.headers.get("allow"), body: await response.text(), errors };
}

// These go through the SDK on purpose. Clients see no change only as long as the guard answers
// exactly what the transport would have, so an SDK upgrade that alters either fails here.
for (const [method, accept] of [
  ["HEAD", undefined],
  ["PUT", undefined],
  ["GET", undefined],
  ["GET", "application/json"],
] as const) {
  test(`${method} with Accept ${accept ?? "(none)"} matches the transport's own response`, async () => {
    const expected = await sdkResponse(method, accept);
    const actual = rejectUnservableMcpRequest(method, accept);

    assert.ok(actual, "the guard should answer this request");
    assert.equal(actual.status, expected.status);
    assert.equal(actual.headers.Allow ?? null, expected.allow);
    assert.deepEqual(actual.body, JSON.parse(expected.body));
    // The reason the guard exists: the transport reports this as an error, which Sentry captures.
    assert.equal(expected.errors.length, 1);
  });
}

test("leaves the requests the transport serves alone", () => {
  assert.equal(rejectUnservableMcpRequest("POST", "application/json, text/event-stream"), null);
  assert.equal(rejectUnservableMcpRequest("POST", undefined), null);
  assert.equal(rejectUnservableMcpRequest("DELETE", undefined), null);
  assert.equal(rejectUnservableMcpRequest("GET", "text/event-stream"), null);
});
