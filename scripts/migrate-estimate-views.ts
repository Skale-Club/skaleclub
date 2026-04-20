// Script to add access_code column and create estimate_views table (Phase 9.1)
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'migrations/0032_estimate_views_and_access_code.sql'), 'utf-8');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 9.1 migration: access_code + estimate_views...');
    await client.query(sql);
    console.log('Migration complete.');

    // Verify
    const colResult = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'access_code'"
    );
    if (colResult.rows.length === 0) throw new Error('access_code column not found after migration.');
    console.log('Verified: access_code column exists on estimates table.');

    const tableResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'estimate_views'"
    );
    if (tableResult.rows.length === 0) throw new Error('estimate_views table not found after migration.');
    console.log('Verified: estimate_views table exists in public schema.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
