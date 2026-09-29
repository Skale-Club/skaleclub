import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "node:fs";
import * as Sentry from "@sentry/node";
import * as schema from "#shared/schema.js";

const { Pool } = pg;

const rawDatabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!rawDatabaseUrl) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL must be set. Did you forget to provision a database?",
  );
}

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
  process.env.POSTGRES_SSL === "true");

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
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Client-side timeout. A server-side `-c statement_timeout` startup option can be
  // refused by the Supabase transaction pooler (port 6543), so prefer setting it at the
  // database: ALTER ROLE <app_role> SET statement_timeout = '15s';
  query_timeout: 15_000,
});
pool.on("error", (err) => {
  console.error("[pg] idle client error", err);
  Sentry.captureException(err);
});
export const db = drizzle(pool, { schema });
