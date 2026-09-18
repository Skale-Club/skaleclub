import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "node:fs";
import * as schema from "#shared/schema.js";

const { Pool } = pg;

const rawDatabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!rawDatabaseUrl) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL must be set. Did you forget to provision a database?",
  );
}

const isServerless = !!process.env.VERCEL;
const sslExplicitlyDisabled =
  rawDatabaseUrl.includes('sslmode=disable') ||
  process.env.PGSSLMODE === "disable";
const isCloudDb =
  rawDatabaseUrl.includes('.supabase.') ||
  rawDatabaseUrl.includes('.neon.') ||
  (rawDatabaseUrl.includes('sslmode=') && !rawDatabaseUrl.includes('sslmode=disable'));
export const shouldUseSsl =
  !sslExplicitlyDisabled &&
  (isCloudDb ||
  process.env.PGSSLMODE === "require" ||
  process.env.POSTGRES_SSL === "true" ||
  Boolean(process.env.VERCEL || process.env.VERCEL_ENV));

// Strip sslmode from URL so pg doesn't override our ssl config
export const databaseUrl = shouldUseSsl
  ? rawDatabaseUrl.replace(/[?&]sslmode=[^&]*/g, (match) =>
      match.startsWith('?') ? '?' : '')
    .replace(/\?$/, '')
    .replace(/\?&/, '?')
  : rawDatabaseUrl;

export const pool = new Pool({
  connectionString: databaseUrl,
  // Verification is opt-in until the Supabase CA is shipped with the image:
  // PG_SSL_REJECT_UNAUTHORIZED=true (plus PG_SSL_CA=/path/to/ca.crt if the
  // pooler's chain is not in the system store) makes production fail closed.
  ssl: shouldUseSsl
    ? process.env.PG_SSL_REJECT_UNAUTHORIZED === "true"
      ? {
          rejectUnauthorized: true,
          ...(process.env.PG_SSL_CA ? { ca: fs.readFileSync(process.env.PG_SSL_CA, "utf8") } : {}),
        }
      : { rejectUnauthorized: false }
    : false,
  max: isServerless ? 5 : 20,
  idleTimeoutMillis: isServerless ? 30000 : undefined,
  connectionTimeoutMillis: isServerless ? 10000 : undefined,
});
export const db = drizzle(pool, { schema });
