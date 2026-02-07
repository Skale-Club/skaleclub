import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "#shared/schema.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL must be set. Did you forget to provision a database?",
  );
}

const isServerless = !process.env.REPL_ID;
const shouldUseSsl =
  process.env.PGSSLMODE === "require" ||
  process.env.POSTGRES_SSL === "true" ||
  Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized: false,
        // Handle self-signed certificates in Vercel and other serverless environments
        checkServerIdentity: () => undefined,
      }
    : undefined,
  max: isServerless ? 5 : 20,
  idleTimeoutMillis: isServerless ? 30000 : undefined,
});
export const db = drizzle(pool, { schema });
