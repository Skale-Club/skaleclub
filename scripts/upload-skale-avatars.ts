/**
 * One-off script — uploads the 2 Skale Club avatar variants to Supabase Storage
 * and patches `company_settings` with the resulting public URLs.
 *
 *   logo_avatar_full ← N:\My Drive\Assets\Avatar\Skale Club Avatar.png  (full logo)
 *   logo_avatar_mark ← N:\My Drive\Assets\Avatar\Logo Skale Avatar.png  (S only)
 *
 * Run with:  npx tsx scripts/upload-skale-avatars.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const ASSET_DIR = "N:\\My Drive\\Assets\\Avatar";

const FILES = [
  { local: `${ASSET_DIR}\\Skale Club Avatar.png`, column: "logo_avatar_full", label: "Full logo" },
  { local: `${ASSET_DIR}\\Logo Skale Avatar.png`, column: "logo_avatar_mark", label: "S-only mark" },
] as const;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pgUrl = process.env.POSTGRES_URL;

  if (!supabaseUrl || !serviceKey || !pgUrl) {
    throw new Error("Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POSTGRES_URL");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  for (const f of FILES) {
    if (!existsSync(f.local)) {
      console.error(`SKIP ${f.label} — file not found at ${f.local}`);
      continue;
    }
    const buffer = readFileSync(f.local);
    const objectId = `${Date.now()}_${randomUUID()}.png`;

    console.log(`Uploading ${f.label} (${(buffer.length / 1024).toFixed(1)} KB) → uploads/${objectId}`);
    const { error: uploadErr } = await supabase.storage
      .from("uploads")
      .upload(objectId, buffer, { contentType: "image/png", upsert: false });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(objectId);
    const publicUrl = urlData.publicUrl;
    console.log(`  → ${publicUrl}`);

    const updateRes = await pool.query(
      `UPDATE company_settings SET ${f.column} = $1 RETURNING id, ${f.column}`,
      [publicUrl],
    );
    if (updateRes.rowCount === 0) {
      console.error(`  ! No company_settings row to update — inserting`);
      await pool.query(
        `INSERT INTO company_settings (${f.column}) VALUES ($1)`,
        [publicUrl],
      );
    } else {
      console.log(`  → company_settings.${f.column} updated (row ${updateRes.rows[0].id})`);
    }
  }

  await pool.end();
  console.log("\nDone. Refresh https://skale.club/e/vita-cell-medspa to see the new avatars.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
