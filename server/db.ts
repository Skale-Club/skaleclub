import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isServerless = !process.env.REPL_ID;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isServerless ? 5 : 20,
  idleTimeoutMillis: isServerless ? 30000 : undefined,
});
export const db = drizzle(pool, { schema });
