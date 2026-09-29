import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  throw new Error("DATABASE_URL or POSTGRES_URL is missing, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  // Xpot (sales_*) tables live in the same database but are managed elsewhere.
  tablesFilter: ["!sales_*"],
  schema: "./shared/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL!,
  },
});
