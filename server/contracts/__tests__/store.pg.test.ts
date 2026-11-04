// This suite drops public.contracts / contract_events. Disposable Postgres only.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ContractService } from "../service.js";
import { contractDraftSchema } from "#shared/contracts.js";

describe(
  "contract records on Postgres",
  {
    skip:
      process.env.WHITEBOARDS_PG_TEST !== "1" &&
      "use npm run test:pg with a disposable DATABASE_URL",
  },
  () => {
    let pool: typeof import("../../db.js").pool;
    let service: ContractService;
    let code: string;
    const evidence = { ipAddress: "203.0.113.1", userAgent: "Postgres test" };
    const draft = contractDraftSchema.parse({
      title: "Service agreement",
      body: "The service and payment terms are specified in this agreement.",
      companyName: "Skale Club",
      companyEmail: "company@example.com",
      signerName: "Jane Customer",
      signerEmail: "jane@example.com",
    });
    before(async () => {
      ({ pool } = await import("../../db.js"));
      for (const role of ["service_role", "anon", "authenticated"])
        await pool.query(
          `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
        );
      await pool.query(
        "DROP TABLE IF EXISTS public.contract_events, public.contracts CASCADE",
      );
      const migration = await readFile(
        new URL(
          "../../../supabase/migrations/20261103120000_contract_signatures.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await pool.query(migration);
      await pool.query(migration); // Idempotent deployment.
      const { postgresContractStore } = await import("../store.js");
      service = new ContractService(postgresContractStore, {
        secret: () => "pg-test-persistent-signing-secret-123456",
        mail: async (_to, _subject, body) => {
          code = body.match(/\b\d{6}\b/)?.[0] ?? "";
          return true;
        },
      });
    });
    after(async () => {
      await pool?.end();
    });

    it("JSONB round-trips, concurrent signing and evidence immutability", async () => {
      const draftRow = await service.create(draft, "admin", evidence);
      const issued = await service.issue(draftRow.id, 1, "admin", evidence);
      const token = issued.sharePath!.split("#")[1];
      const { challengeToken } = await service.requestCode(
        issued.id,
        token,
        evidence,
      );
      const v = await service.verify(
        issued.id,
        token,
        challengeToken,
        code,
        evidence,
      );
      await assert.rejects(
        pool.query(
          "UPDATE public.contracts SET body = 'changed' WHERE id = $1",
          [issued.id],
        ),
        /immutable/,
      );
      const sign = () =>
        service.sign(
          issued.id,
          token,
          v.accessToken,
          draft.signerName,
          issued.documentHash!,
          evidence,
        );
      const results = await Promise.allSettled([sign(), sign()]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const record = await service.store.get(issued.id);
      assert.equal(record!.status, "signed");
      assert.deepEqual(service.verifyReceipt(record!.receipt!), {
        documentMatches: true,
        sealMatches: true,
      });
      assert.equal(
        (await service.store.events(issued.id)).filter(
          (e) => e.type === "signed",
        ).length,
        1,
      );
      await assert.rejects(
        pool.query(
          "UPDATE public.contracts SET receipt = '{}'::jsonb WHERE id = $1",
          [issued.id],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query("DELETE FROM public.contracts WHERE id = $1", [issued.id]),
        /cannot be deleted/,
      );
      await assert.rejects(
        pool.query(
          "DELETE FROM public.contract_events WHERE contract_id = $1",
          [issued.id],
        ),
        /append-only/,
      );
      const rls = await pool.query(
        "SELECT relrowsecurity FROM pg_class WHERE relname IN ('contracts','contract_events')",
      );
      assert.equal(rls.rows.length, 2);
      assert.ok(rls.rows.every((row) => row.relrowsecurity));
    });
  },
);
