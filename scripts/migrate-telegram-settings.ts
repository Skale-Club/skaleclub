import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0040_create_telegram_settings.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running Phase 32 migration: telegram_settings table...");
    await client.query(sql);
    console.log("Migration complete.");

    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'telegram_settings'"
    );
    if (result.rows.length === 0) {
      throw new Error("telegram_settings table not found after migration.");
    }
    console.log("Verified: telegram_settings table exists in public schema.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
