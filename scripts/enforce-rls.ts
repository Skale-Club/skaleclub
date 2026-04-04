import { pool } from '../server/db.js';

async function enforceRLS() {
  const client = await pool.connect();
  try {
    console.log('Enabling Row Level Security on all public tables...');
    
    // Get all tables in the public schema
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    
    for (const row of result.rows) {
      const tableName = row.tablename;
      console.log(`Processing table: ${tableName}`);
      
      // Enable RLS
      await client.query(`ALTER TABLE "public"."${tableName}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`  - Enabled RLS for ${tableName}`);
      
      // Drop existing service_role_all_access policy if it exists to recreate it cleanly
      await client.query(`DROP POLICY IF EXISTS "service_role_all_access" ON "public"."${tableName}";`);
      
      // Create policy to allow service_role to do anything (optional if using postgres role, but good practice)
      // Note: postgres role already bypasses RLS, but service_role might not depending on setup.
      await client.query(`
        CREATE POLICY "service_role_all_access" 
        ON "public"."${tableName}" 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
      `);
      console.log(`  - Granted full access to service_role for ${tableName}`);
    }
    
    console.log('Successfully secured all public tables with RLS.');
  } catch (error) {
    console.error('Error enforcing RLS:', error);
  } finally {
    client.release();
    pool.end();
  }
}

enforceRLS();