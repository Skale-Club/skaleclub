import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyTranslationsTable() {
  console.log("📝 Applying translations table migration...");

  const migrationPath = path.join(__dirname, "../migrations/0019_add_translations_table.sql");
  const migrationSQL = fs.readFileSync(migrationPath, "utf8");

  console.log("Executing SQL:");
  console.log(migrationSQL);

  try {
    await db.execute(sql.raw(migrationSQL));
    console.log("✅ Translations table created successfully!");
  } catch (error) {
    console.error("❌ Error creating translations table:", error);
    process.exit(1);
  }

  process.exit(0);
}

applyTranslationsTable();
