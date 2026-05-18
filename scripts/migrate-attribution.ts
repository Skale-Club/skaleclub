// scripts/migrate-attribution.ts
// Phase 45 — apply migrations/0045_visitor_sessions_attribution_conversions.sql
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(process.cwd(), 'migrations/0045_visitor_sessions_attribution_conversions.sql'),
  'utf-8',
);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 45 migration: visitor_sessions, attribution_conversions, form_leads.visitor_id...');
    await client.query(sql);
    console.log('Migration SQL executed.');

    const visitorSessions = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visitor_sessions'"
    );
    if (visitorSessions.rows.length === 0) throw new Error('visitor_sessions table not found.');
    console.log('Verified: visitor_sessions exists.');

    const conversions = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attribution_conversions'"
    );
    if (conversions.rows.length === 0) throw new Error('attribution_conversions table not found.');
    console.log('Verified: attribution_conversions exists.');

    const visitorCol = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'form_leads' AND column_name = 'visitor_id'`
    );
    if (visitorCol.rows.length === 0) throw new Error('form_leads.visitor_id column not found.');
    console.log('Verified: form_leads.visitor_id exists.');

    const uniqueIdx = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'visitor_sessions' AND indexname = 'visitor_sessions_visitor_id_unique'`
    );
    if (uniqueIdx.rows.length === 0) throw new Error('visitor_sessions_visitor_id_unique index not found.');
    console.log('Verified: unique index on visitor_id exists.');

    const fkConstraint = await client.query(
      `SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'form_leads' AND constraint_name = 'form_leads_visitor_id_fkey'`
    );
    if (fkConstraint.rows.length === 0) throw new Error('form_leads_visitor_id_fkey constraint not found.');
    console.log('Verified: form_leads.visitor_id FK constraint exists.');

    // Single-tenant invariant — neither new table may carry tenant_id.
    const strayTenant = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_name IN ('visitor_sessions','attribution_conversions')
          AND column_name = 'tenant_id'`
    );
    if (strayTenant.rows.length > 0) {
      throw new Error(`Stray tenant_id columns found: ${strayTenant.rows.map((r: any) => `${r.table_name}.${r.column_name}`).join(', ')}`);
    }
    console.log('Verified: no tenant_id columns on visitor_sessions or attribution_conversions.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
