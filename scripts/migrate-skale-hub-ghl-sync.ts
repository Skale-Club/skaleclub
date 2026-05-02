import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0037_skale_hub_ghl_sync.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Running migration 0037: Skale Hub GHL sync columns...");
    await client.query(sql);
    console.log("Migration complete.");

    const expected: Array<{ table: string; column: string }> = [
      { table: "hub_participants", column: "ghl_contact_id" },
      { table: "hub_participants", column: "ghl_sync_status" },
      { table: "hub_participants", column: "ghl_last_synced_at" },
      { table: "hub_participants", column: "ghl_sync_error" },
      { table: "hub_access_events", column: "ghl_note_id" },
      { table: "hub_access_events", column: "ghl_sync_status" },
      { table: "hub_access_events", column: "ghl_synced_at" },
      { table: "hub_access_events", column: "ghl_sync_error" },
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
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
