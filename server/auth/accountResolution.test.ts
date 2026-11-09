import test from "node:test";
import assert from "node:assert/strict";
import { resolveAccount, type AccountLookups } from "./accountResolution.js";
import type { IdentityBinding } from "./googleIdentityStore.js";

interface U {
  id: string;
  email: string | null;
  phone: string | null;
}

function lookupsFor(rows: U[], bindings: Record<string, string> = {}): AccountLookups<U> & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async userIdForIdentity(b) {
      calls.push("binding");
      return bindings[`${b.projectId}/${b.uid}`] ?? null;
    },
    async userById(id) {
      calls.push("byId");
      return rows.find((u) => u.id === id) ?? null;
    },
    async userByPhone(phone) {
      calls.push("byPhone");
      return rows.find((u) => u.phone === phone) ?? null;
    },
    async usersByEmail(email, limit) {
      calls.push("byEmail");
      return rows.filter((u) => u.email?.toLowerCase() === email.toLowerCase()).slice(0, limit);
    },
  };
}

const ana: U = { id: "u-ana", email: "ana@example.com", phone: "+15085550100" };
const bia: U = { id: "u-bia", email: "bia@example.com", phone: "+5511987654321" };

const phoneBinding: IdentityBinding = { projectId: "skaleclub", uid: "uid-1", provider: "phone" };
const googleBinding = (email?: string): IdentityBinding => ({
  projectId: "skaleclub",
  uid: "uid-g",
  provider: "google.com",
  email,
});

test("a stored binding wins over phone and email", async () => {
  const lookups = lookupsFor([ana, bia], { "skaleclub/uid-1": bia.id });
  const user = await resolveAccount(lookups, phoneBinding, ana.phone!);
  assert.equal(user?.id, bia.id);
  assert.deepEqual(lookups.calls, ["binding", "byId"]);
});

test("a phone token matches users.phone when there is no binding", async () => {
  const user = await resolveAccount(lookupsFor([ana, bia]), phoneBinding, "+5511987654321");
  assert.equal(user?.id, bia.id);
});

test("a binding to a user that no longer exists falls through to the phone", async () => {
  const lookups = lookupsFor([ana], { "skaleclub/uid-1": "u-gone" });
  assert.equal((await resolveAccount(lookups, phoneBinding, ana.phone!))?.id, ana.id);
});

test("a phone nobody has is not invited", async () => {
  assert.equal(await resolveAccount(lookupsFor([ana, bia]), phoneBinding, "+12025550123"), null);
  assert.equal(await resolveAccount(lookupsFor([ana, bia]), phoneBinding, undefined), null);
});

test("a phone token never falls back to email", async () => {
  const lookups = lookupsFor([ana]);
  const user = await resolveAccount(lookups, { ...phoneBinding, email: ana.email! }, "+12025550123");
  assert.equal(user, null);
  assert.ok(!lookups.calls.includes("byEmail"));
});

test("a Google token matches the one user with that verified email, ignoring case", async () => {
  const user = await resolveAccount(lookupsFor([ana, bia]), googleBinding("ANA@Example.com"));
  assert.equal(user?.id, ana.id);
});

test("a Google token never matches when two users share the email", async () => {
  const twin: U = { id: "u-twin", email: "Ana@example.com", phone: null };
  assert.equal(await resolveAccount(lookupsFor([ana, twin]), googleBinding("ana@example.com")), null);
});

test("a Google token without a verified email is not invited", async () => {
  const lookups = lookupsFor([ana]);
  assert.equal(await resolveAccount(lookups, googleBinding(undefined)), null);
  assert.ok(!lookups.calls.includes("byEmail"));
});

test("a Google token does not match by phone", async () => {
  const lookups = lookupsFor([ana]);
  assert.equal(await resolveAccount(lookups, googleBinding("nobody@example.com"), ana.phone!), null);
  assert.ok(!lookups.calls.includes("byPhone"));
});

test("a Google binding wins even when the email now belongs to someone else", async () => {
  const lookups = lookupsFor([ana, bia], { "skaleclub/uid-g": bia.id });
  assert.equal((await resolveAccount(lookups, googleBinding(ana.email!)))?.id, bia.id);
});
