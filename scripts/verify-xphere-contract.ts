// verify-xphere-contract: regression check for shared/xphere-contract.ts.
// Runs without DB, env, or network: `npx tsx scripts/verify-xphere-contract.ts`.
// The fixture is synthetic on purpose — never paste real tenant data here.
import assert from "node:assert/strict";
import { xphereLeadEnvelopeSchema } from "../shared/xphere-contract.js";

const fixture = {
  schema_version: "1.0",
  event_id: "skaleclub:barbershop-leads:9d2f1c3e-6a4b-4f0e-8c7d-2b1a0e9f8d7c",
  occurred_at: "2026-09-06T12:00:00.000Z",
  source: {
    product: "skaleclub",
    tenant_ref: "skaleclub",
    site_domain: "skale.club",
    form: "barbershop-leads",
  },
  contact: { name: "Test Lead", email: "lead@example.com", phone: "+15555550100" },
  lead: {
    status: "new",
    score: null,
    classification: null,
    page_url: "https://skale.club/barbershops",
    answers: { tipoVisita: "presencial", enderecoBarbearia: "123 Example St" },
  },
  attribution: { utm_source: null, utm_medium: null, utm_campaign: null },
};

// (a) this product's envelope parses
assert.equal(xphereLeadEnvelopeSchema.parse(fixture).event_id, fixture.event_id);
// (b) the sibling product is still accepted by the shared enum
assert.equal(
  xphereLeadEnvelopeSchema.safeParse({ ...fixture, source: { ...fixture.source, product: "skaleclub_websites" } }).success,
  true,
);
// (c) an unknown product is rejected
assert.equal(
  xphereLeadEnvelopeSchema.safeParse({ ...fixture, source: { ...fixture.source, product: "not_a_product" } }).success,
  false,
);
// (d) top-level object is .strict() — extra keys are rejected
assert.equal(xphereLeadEnvelopeSchema.safeParse({ ...fixture, org_id: "attacker-org" }).success, false);

console.log("Xphere contract verification passed: 4/4 assertions");
