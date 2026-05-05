import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db.js";

const sql = readFileSync(
  join(process.cwd(), "migrations/0042_blog_jobs_durations_ms.sql"),
  "utf-8",
);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running Phase 38 migration: blog_generation_jobs.durations_ms ...");
    await client.query(sql);
    console.log("Migration complete.");

    const check = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'blog_generation_jobs'
         AND column_name = 'durations_ms'`,
    );
    if (check.rows.length === 0) {
      throw new Error("durations_ms column not found after migration.");
    }
    console.log("Verified: blog_generation_jobs.durations_ms exists.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
