// Script to create estimates table (Phase 6.2)
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'migrations/0031_create_estimates.sql'), 'utf-8');

async function createTable() {
  const client = await pool.connect();
  try {
    console.log('Creating estimates table...');
    await client.query(sql);
    console.log('estimates table created (or already exists).');
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'estimates'"
    );
    if (result.rows.length > 0) {
      console.log('Verified: estimates table exists in public schema.');
    } else {
      throw new Error('Table creation failed: estimates not found after migration.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

createTable().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
