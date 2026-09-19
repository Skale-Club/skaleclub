import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { pool } from '../server/db.js';

async function migrate() {
  try {
    await pool.query(readFileSync(new URL('../migrations/0058_portfolio_dashboard_preview.sql', import.meta.url), 'utf8'));
    const result = await pool.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'portfolio_services'
        AND column_name IN ('home_image_url', 'dashboard_image_url')`);
    if (result.rowCount !== 2) throw new Error('Home/dashboard preview columns not found after migration.');
    console.log('Portfolio home/dashboard preview migration applied and verified.');
  } catch (error) {
    console.error('Portfolio preview migration failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void migrate();
