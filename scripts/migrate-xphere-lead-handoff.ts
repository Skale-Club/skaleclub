import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0054_xphere_lead_handoff.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Running migration 0054: Xphere lead handoff tables...");
    await client.query(sql);
    console.log("Migration complete.");

    for (const table of ["xphere_settings", "integration_deliveries"]) {
      const result = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [table]
      );
      if (result.rows.length === 0) {
        throw new Error(`Table ${table} not found after migration.`);
      }
      console.log(`Verified: table ${table}`);
    }

    const expected: Array<{ table: string; column: string }> = [
      { table: "xphere_settings", column: "booking_profile_slug" },
      { table: "xphere_settings", column: "visit_type_question_id" },
      { table: "xphere_settings", column: "tenant_ref" },
      { table: "integration_deliveries", column: "idempotency_key" },
      { table: "integration_deliveries", column: "provider_receipt_id" },
    ];

    for (const { table, column } of expected) {
      const result = await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
        [table, column]
      );

      if (result.rows.length === 0) {
        throw new Error(`${table}.${column} not found after migration.`);
      }

      console.log(`Verified: ${table}.${column}`);
    }

    const idx = await client.query(
      "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1",
      ["integration_deliveries_due_idx"]
    );
    if (idx.rows.length === 0) {
      throw new Error("Index integration_deliveries_due_idx not found after migration.");
    }
    console.log("Verified: index integration_deliveries_due_idx");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
