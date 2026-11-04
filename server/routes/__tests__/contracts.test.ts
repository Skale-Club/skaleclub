import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createContractsHarness } from "./helpers/contractsHarness.js";

const draft = {
  title: "Partner commission agreement",
  body: "Commission is payable after the client pays for the website project.",
  companyName: "Skale Club",
  companyEmail: "company@example.com",
  signerName: "John Partner",
  signerEmail: "john@example.com",
};

test("real HTTP routes enforce admin, email verification, consent and downloadable records", async () => {
  const h = createContractsHarness();
  const server = h.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return fetch(origin + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const admin = { "x-test-admin": "1" };
  try {
    assert.equal((await call("/api/contracts")).status, 401);
    assert.equal((await call("/api/contracts", "POST", draft)).status, 401);
    const created = await (
      await call("/api/contracts", "POST", draft, admin)
    ).json();
    assert.equal(created.status, "draft");
    assert.equal(
      (await call(`/api/contracts/${created.id}/issue`, "POST", { version: 1 }))
        .status,
      401,
    );
    const issued = await (
      await call(
        `/api/contracts/${created.id}/issue`,
        "POST",
        { version: 1 },
        admin,
      )
    ).json();
    assert.equal(issued.status, "sent");
    const secret = issued.sharePath.split("#")[1];
    const publicHeaders = { Authorization: `Bearer ${secret}` };
    const base = `/api/signing/${created.id}`;
    assert.equal((await call(base)).status, 404);
    const gate = await call(base, "GET", undefined, publicHeaders);
    assert.match(gate.headers.get("cache-control")!, /no-store/);
    assert.equal("body" in (await gate.json()), false);
    assert.equal(
      (await call(`${base}/document`, "GET", undefined, publicHeaders)).status,
      401,
    );
    assert.equal(
      (await call(`${base}/record`, "GET", undefined, publicHeaders)).status,
      401,
    );
    const challenge = await (
      await call(`${base}/code`, "POST", undefined, publicHeaders)
    ).json();
    const code = h.mail.at(-1)!.body.match(/\b\d{6}\b/)![0];
    const verified = await (
      await call(
        `${base}/verify`,
        "POST",
        { challengeToken: challenge.challengeToken, code },
        publicHeaders,
      )
    ).json();
    const headers = {
      ...publicHeaders,
      "X-Signing-Access": verified.accessToken,
    };
    const sign = {
      typedName: draft.signerName,
      documentHash: issued.documentHash,
      consent: false,
    };
    assert.equal(
      (await call(`${base}/sign`, "POST", sign, headers)).status,
      400,
    );
    const signed = await (
      await call(`${base}/sign`, "POST", { ...sign, consent: true }, headers)
    ).json();
    assert.equal(signed.contract.status, "signed");
    assert.equal(signed.copyDelivered, true);
    assert.equal(
      (await call(`${base}/sign`, "POST", { ...sign, consent: true }, headers))
        .status,
      409,
    );
    const record = await call(`${base}/record`, "GET", undefined, headers);
    assert.equal(record.status, 200);
    assert.match(record.headers.get("content-disposition")!, /attachment/);
    assert.match(await record.text(), /John Partner/);
    const evidence = await (
      await call(
        `/api/contracts/${created.id}/evidence`,
        "GET",
        undefined,
        admin,
      )
    ).json();
    assert.deepEqual(evidence.integrity, {
      documentMatches: true,
      sealMatches: true,
    });
    assert.equal(
      evidence.events.filter((e: { type: string }) => e.type === "signed")
        .length,
      1,
    );
    assert.equal(
      (await call(`/api/contracts/${created.id}/evidence`)).status,
      401,
    );
    assert.equal(
      (
        await call(
          `/api/contracts/${created.id}`,
          "PUT",
          { ...draft, version: 1 },
          admin,
        )
      ).status,
      409,
    );
    const list = await (
      await call("/api/contracts", "GET", undefined, admin)
    ).json();
    assert.equal(list.total, 1);
    for (const secret of [
      "body",
      "snapshot",
      "receipt",
      "challenge",
      "accessTokenHash",
      "emailVerifiedAt",
    ])
      assert.equal(secret in list.data[0], false);
    assert.equal(
      (await call("/api/signing/not-a-uuid", "GET", undefined, headers)).status,
      400,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
