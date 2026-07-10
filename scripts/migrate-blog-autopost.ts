import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db.js";

const sql = readFileSync(
  join(process.cwd(), "migrations/0053_blog_autopost_openrouter.sql"),
  "utf-8",
);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running blog autopost migration: blog_settings columns + blog_post_feedback ...");
    await client.query(sql);
    console.log("Migration complete.");

    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'blog_settings'
         AND column_name IN ('system_prompt', 'auto_approve', 'openrouter_text_model', 'openrouter_image_model')`,
    );
    if (columns.rows.length !== 4) {
      throw new Error("blog_settings autopost columns not found after migration.");
    }

    const table = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'blog_post_feedback'`,
    );
    if (table.rows.length === 0) {
      throw new Error("blog_post_feedback table not found after migration.");
    }
    console.log("Verified: blog_settings columns + blog_post_feedback exist.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
