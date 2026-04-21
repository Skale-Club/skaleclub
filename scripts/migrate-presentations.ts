// Script to create presentations, presentation_views, and brand_guidelines tables (Phase 15)
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'migrations/0033_create_presentations.sql'), 'utf-8');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 15 migration: presentations, presentation_views, brand_guidelines...');
    await client.query(sql);
    console.log('Migration complete.');

    // Verify presentations table
    const presentationsResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presentations'"
    );
    if (presentationsResult.rows.length === 0) throw new Error('presentations table not found after migration.');
    console.log('Verified: presentations table exists in public schema.');

    // Verify presentation_views table
    const viewsResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presentation_views'"
    );
    if (viewsResult.rows.length === 0) throw new Error('presentation_views table not found after migration.');
    console.log('Verified: presentation_views table exists in public schema.');

    // Verify brand_guidelines table
    const guidelinesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'brand_guidelines'"
    );
    if (guidelinesResult.rows.length === 0) throw new Error('brand_guidelines table not found after migration.');
    console.log('Verified: brand_guidelines table exists in public schema.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
