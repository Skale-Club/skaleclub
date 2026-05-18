// Script to create the landing_pages table (Phase 43)
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'migrations/0044_create_landing_pages.sql'), 'utf-8');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 43 migration: landing_pages...');
    await client.query(sql);
    console.log('Migration complete.');

    // Verify landing_pages table
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'landing_pages'"
    );
    if (result.rows.length === 0) throw new Error('landing_pages table not found after migration.');
    console.log('Verified: landing_pages table exists in public schema.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
