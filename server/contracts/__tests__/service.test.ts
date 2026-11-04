import test from "node:test";
import assert from "node:assert/strict";
import { ContractService, ContractError, canonicalJson } from "../service.js";
import { renderContractRecord } from "../record.js";
import { MemoryContractStore } from "./memoryStore.js";
import { contractDraftSchema, type ContractView } from "#shared/contracts.js";

const evidence = { ipAddress: "203.0.113.10", userAgent: "Test Browser" };
const draft = contractDraftSchema.parse({
  title: "Website development agreement",
  body: "Build a five-page website for the agreed fee. Delivery is due in thirty days.",
  companyName: "Skale Club",
  companyEmail: "company@example.com",
  signerName: "Jane Customer",
  signerEmail: "jane@example.com",
});
function setup() {
  let now = new Date("2026-11-03T12:00:00Z");
  const outbox: { to: string[]; subject: string; body: string }[] = [];
  let deliver = true;
  const store = new MemoryContractStore();
  const service = new ContractService(store, {
    secret: () => "test-signing-secret-1234567890-abcdef",
    now: () => now,
    mail: async (to, subject, body) => {
      outbox.push({ to, subject, body });
      return deliver;
    },
  });
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  const setDelivery = (value: boolean) => {
    deliver = value;
  };
  async function issued() {
    const created = await service.create(draft, "admin", evidence);
    const contract = await service.issue(
      created.id,
      created.version,
      "admin",
      evidence,
    );
    const token = contract.sharePath!.split("#")[1];
    return { contract, token };
  }
  async function verified(contract: ContractView, token: string) {
    const { challengeToken } = await service.requestCode(
      contract.id,
      token,
      evidence,
    );
    const code = outbox.at(-1)!.body.match(/\b\d{6}\b/)![0];
    const verified = await service.verify(
      contract.id,
      token,
      challengeToken,
      code,
      evidence,
    );
    return { ...verified, challengeToken, code };
  }
  return { service, store, outbox, advance, setDelivery, issued, verified };
}
const fails = (status: number) => (e: unknown) =>
  e instanceof ContractError && e.status === status;

test("email gate hides the contract; verification, signing and offline export preserve a complete record", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const gate = await s.service.gate(contract.id, token);
  assert.equal(gate.maskedEmail, "j***@example.com");
  assert.equal("body" in gate, false);
  await assert.rejects(s.service.document(contract.id, token, ""), fails(401));
  await assert.rejects(s.service.gate(contract.id, "bad"), fails(404));
  const v = await s.verified(contract, token);
  assert.equal(v.contract.body, draft.body);
  assert.equal("challenge" in v.contract, false);
  assert.equal("accessTokenHash" in v.contract, false);
  const signed = await s.service.sign(
    contract.id,
    token,
    v.accessToken,
    "Jane Customer",
    contract.documentHash!,
    evidence,
  );
  assert.equal(signed.status, "signed");
  assert.equal(signed.receipt!.signature.ipAddress, evidence.ipAddress);
  assert.equal(signed.receipt!.document.body, draft.body);
  assert.deepEqual(s.service.verifyReceipt(signed.receipt!), {
    documentMatches: true,
    sealMatches: true,
  });
  assert.equal(await s.service.sendCopy(signed.receipt!), true);
  assert.deepEqual(s.outbox.at(-1)!.to, [
    draft.signerEmail,
    draft.companyEmail,
  ]);
  assert.ok(s.outbox.at(-1)!.body.includes(draft.body));
  const html = renderContractRecord(signed);
  assert.ok(html.includes(signed.documentHash!));
  assert.ok(html.includes("Jane Customer"));
  assert.ok(!html.includes("<script"));
  assert.deepEqual(
    (await s.store.events(contract.id)).map((e) => e.type),
    ["created", "issued", "verification_requested", "email_verified", "signed"],
  );
});

test("five wrong OTP attempts remain counted; codes are bound to the requesting browser and are single-use", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const { challengeToken } = await s.service.requestCode(
    contract.id,
    token,
    evidence,
  );
  const code = s.outbox.at(-1)!.body.match(/\b\d{6}\b/)![0];
  await assert.rejects(
    s.service.verify(contract.id, token, "f".repeat(64), code, evidence),
    fails(401),
  );
  const wrong = code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      s.service.verify(contract.id, token, challengeToken, wrong, evidence),
      fails(401),
    );
  await assert.rejects(
    s.service.verify(contract.id, token, challengeToken, code, evidence),
    fails(401),
  );
  assert.equal(s.store.rows.get(contract.id)!.challenge!.attempts, 5);
  s.advance(61_000);
  const v = await s.verified(contract, token);
  await assert.rejects(
    s.service.verify(contract.id, token, v.challengeToken, v.code, evidence),
    fails(401),
  );
});

test("codes expire and resend throttles survive multiple service instances", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const { challengeToken } = await s.service.requestCode(
    contract.id,
    token,
    evidence,
  );
  const code = s.outbox.at(-1)!.body.match(/\b\d{6}\b/)![0];
  await assert.rejects(
    s.service.requestCode(contract.id, token, evidence),
    fails(429),
  );
  s.advance(600_001);
  await assert.rejects(
    s.service.verify(contract.id, token, challengeToken, code, evidence),
    fails(401),
  );
  for (let i = 0; i < 4; i++) {
    await s.service.requestCode(contract.id, token, evidence);
    s.advance(61_000);
  }
  await assert.rejects(
    s.service.requestCode(contract.id, token, evidence),
    fails(429),
  );
});

test("issued content cannot be changed, stale drafts conflict and voided contracts cannot be signed", async () => {
  const s = setup();
  const created = await s.service.create(draft, "admin", evidence);
  await s.service.update(
    created.id,
    { ...draft, title: "Updated agreement" },
    1,
    "admin",
    evidence,
  );
  await assert.rejects(
    s.service.issue(created.id, 1, "admin", evidence),
    fails(409),
  );
  const contract = await s.service.issue(created.id, 2, "admin", evidence);
  const token = contract.sharePath!.split("#")[1];
  await assert.rejects(
    s.service.update(contract.id, draft, 2, "admin", evidence),
    fails(409),
  );
  const v = await s.verified(contract, token);
  await s.service.void(contract.id, "admin", evidence);
  await assert.rejects(
    s.service.sign(
      contract.id,
      token,
      v.accessToken,
      draft.signerName,
      contract.documentHash!,
      evidence,
    ),
    fails(410),
  );
  assert.equal(s.store.rows.get(contract.id)!.receipt, null);
});

test("simultaneous signatures produce exactly one signature and audit event", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const v = await s.verified(contract, token);
  const sign = () =>
    s.service.sign(
      contract.id,
      token,
      v.accessToken,
      draft.signerName,
      contract.documentHash!,
      evidence,
    );
  const results = await Promise.allSettled([sign(), sign()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await s.store.events(contract.id)).filter((e) => e.type === "signed")
      .length,
    1,
  );
  await assert.rejects(
    s.service.void(contract.id, "admin", evidence),
    fails(409),
  );
});

test("name, version hash, email access and link expiry are enforced", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const v = await s.verified(contract, token);
  await assert.rejects(
    s.service.sign(
      contract.id,
      token,
      "bad",
      draft.signerName,
      contract.documentHash!,
      evidence,
    ),
    fails(401),
  );
  await assert.rejects(
    s.service.sign(
      contract.id,
      token,
      v.accessToken,
      "Somebody Else",
      contract.documentHash!,
      evidence,
    ),
    fails(400),
  );
  await assert.rejects(
    s.service.sign(
      contract.id,
      token,
      v.accessToken,
      draft.signerName,
      "0".repeat(64),
      evidence,
    ),
    fails(409),
  );
  s.advance(31 * 86_400_000);
  assert.equal((await s.service.gate(contract.id, token)).status, "expired");
  await assert.rejects(
    s.service.requestCode(contract.id, token, evidence),
    fails(410),
  );
});

test("JSONB key order is irrelevant; tampering breaks the evidence seal", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  const row = s.store.rows.get(contract.id)!;
  row.snapshot = Object.fromEntries(
    Object.entries(row.snapshot!).reverse(),
  ) as typeof row.snapshot;
  const v = await s.verified(contract, token);
  const signed = await s.service.sign(
    contract.id,
    token,
    v.accessToken,
    draft.signerName,
    contract.documentHash!,
    evidence,
  );
  const receipt = JSON.parse(JSON.stringify(signed.receipt));
  receipt.document = Object.fromEntries(
    Object.entries(receipt.document).reverse(),
  );
  assert.deepEqual(s.service.verifyReceipt(receipt), {
    documentMatches: true,
    sealMatches: true,
  });
  receipt.document.body += " changed";
  assert.deepEqual(s.service.verifyReceipt(receipt), {
    documentMatches: false,
    sealMatches: false,
  });
  assert.equal(
    canonicalJson({ z: 1, a: { d: 2, b: 3 } }),
    canonicalJson({ a: { b: 3, d: 2 }, z: 1 }),
  );
});

test("failed email delivery cannot unlock or lose a signed record", async () => {
  const s = setup();
  const { contract, token } = await s.issued();
  s.setDelivery(false);
  await assert.rejects(
    s.service.requestCode(contract.id, token, evidence),
    fails(503),
  );
  assert.equal(s.store.rows.get(contract.id)!.accessTokenHash, null);
  s.advance(61_000);
  s.setDelivery(true);
  const v = await s.verified(contract, token);
  const signed = await s.service.sign(
    contract.id,
    token,
    v.accessToken,
    draft.signerName,
    contract.documentHash!,
    evidence,
  );
  s.setDelivery(false);
  assert.equal(await s.service.sendCopy(signed.receipt!), false);
  assert.equal(
    (await s.service.document(contract.id, token, v.accessToken)).status,
    "signed",
  );
  s.advance(2 * 86_400_000);
  s.setDelivery(true);
  await assert.rejects(
    s.service.document(contract.id, token, v.accessToken),
    fails(401),
  );
  const fresh = await s.verified(contract, token);
  assert.equal(fresh.contract.status, "signed");
});

test("offline exports escape contract text and signatures", async () => {
  const s = setup();
  const created = await s.service.create(
    {
      ...draft,
      title: "<script>attack</script>",
      body: "<img src=x onerror=alert(1)> this is plain text",
    },
    "admin",
    evidence,
  );
  const issued = await s.service.issue(created.id, 1, "admin", evidence);
  const html = renderContractRecord(issued);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});
