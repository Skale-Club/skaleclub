import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0035_create_blog_automation_tables.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Running Phase 21 migration: blog_settings, blog_generation_jobs...");
    await client.query(sql);
    console.log("Migration complete.");

    const settingsResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blog_settings'"
    );
    if (settingsResult.rows.length === 0) {
      throw new Error("blog_settings table not found after migration.");
    }
    console.log("Verified: blog_settings table exists in public schema.");

    const jobsResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blog_generation_jobs'"
    );
    if (jobsResult.rows.length === 0) {
      throw new Error("blog_generation_jobs table not found after migration.");
    }
    console.log("Verified: blog_generation_jobs table exists in public schema.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
