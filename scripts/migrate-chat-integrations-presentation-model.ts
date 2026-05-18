// Apply migration 0043: add presentation_model column to chat_integrations.
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db";

const sql = readFileSync(
  join(process.cwd(), "migrations/0043_chat_integrations_presentation_model.sql"),
  "utf-8",
);

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying migration 0043...");
    await client.query(sql);
    console.log("Migration applied. Verifying column...");
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'chat_integrations' AND column_name = 'presentation_model'`,
    );
    if (rows.length === 0) throw new Error("Column not present after migration.");
    console.log("✓ presentation_model column verified.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
