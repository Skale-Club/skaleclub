import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0036_create_skale_hub_tables.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Running Phase 25 migration: Skale Hub foundation tables...");
    await client.query(sql);
    console.log("Migration complete.");

    for (const tableName of ["hub_lives", "hub_participants", "hub_registrations", "hub_access_events"]) {
      const result = await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1",
        [tableName]
      );

      if (result.rows.length === 0) {
        throw new Error(`${tableName} table not found after migration.`);
      }

      console.log(`Verified: ${tableName} table exists in public schema.`);
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
