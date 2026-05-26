#!/usr/bin/env node
/**
 * Custom Supabase MCP Server for skaleclub
 *
 * Exposes tools for database inspection and SQL execution
 * against the project's Supabase/PostgreSQL instance.
 *
 * Usage:
 *   npx tsx mcp/supabase-mcp/index.ts
 *
 * Required env vars:
 *   POSTGRES_URL or DATABASE_URL — PostgreSQL connection string
 *   SUPABASE_URL                 — Supabase project URL (optional, for metadata)
 *   SUPABASE_SERVICE_ROLE_KEY    — Supabase service role key (optional)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const { Pool } = pg;

const rawUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL;

if (!rawUrl) {
  process.stderr.write(
    "ERROR: POSTGRES_URL, DATABASE_URL, or SUPABASE_DB_URL must be set.\n"
  );
  process.exit(1);
}

const isCloud =
  rawUrl.includes(".supabase.") ||
  rawUrl.includes(".neon.") ||
  (rawUrl.includes("sslmode=") && !rawUrl.includes("sslmode=disable"));
const sslDisabled =
  rawUrl.includes("sslmode=disable") || process.env.PGSSLMODE === "disable";
const useSsl = !sslDisabled && isCloud;

const pool = new Pool({
  connectionString: useSsl
    ? rawUrl.replace(/[?&]sslmode=[^&]*/g, (m) =>
        m.startsWith("?") ? "?" : ""
      ).replace(/\?$/, "")
    : rawUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "supabase-mcp",
  version: "1.0.0",
});

// ─── Tools ────────────────────────────────────────────────────────────────────

server.tool(
  "execute_sql",
  "Execute a SQL query against the Supabase database. Use $1, $2, … placeholders for parameters.",
  {
    sql: z.string().describe("SQL query to execute"),
    params: z
      .array(z.unknown())
      .optional()
      .default([])
      .describe("Positional parameters for the query"),
    max_rows: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe("Maximum rows to return for SELECT queries (default 100)"),
  },
  async ({ sql: rawSql, params = [], max_rows = 100 }) => {
    const isSelect =
      /^\s*(select|with|explain|show|table)\b/i.test(rawSql);

    const sql = isSelect
      ? `SELECT * FROM (${rawSql}) _q LIMIT ${max_rows}`
      : rawSql;

    try {
      const rows = await query(sql, params as unknown[]);
      const text =
        rows.length === 0
          ? "Query executed successfully — no rows returned."
          : JSON.stringify(rows, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `SQL Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_tables",
  "List all tables in the public schema with row counts and size information.",
  {
    schema: z
      .string()
      .optional()
      .default("public")
      .describe("Schema name (default: public)"),
  },
  async ({ schema: schemaName = "public" }) => {
    try {
      const rows = await query<{
        table_name: string;
        row_count: string;
        size: string;
        has_rls: string;
      }>(
        `
        SELECT
          t.table_name,
          c.reltuples::bigint AS row_count,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
          CASE WHEN c.relrowsecurity THEN 'yes' ELSE 'no' END AS has_rls
        FROM information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = $1
        WHERE t.table_schema = $1
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.reltuples DESC
        `,
        [schemaName]
      );

      if (rows.length === 0) {
        return {
          content: [{ type: "text", text: `No tables found in schema "${schemaName}".` }],
        };
      }

      const lines = rows.map(
        (r) =>
          `• ${r.table_name.padEnd(40)} rows≈${String(r.row_count).padStart(8)}  size=${r.size.padStart(8)}  rls=${r.has_rls}`
      );

      return {
        content: [
          {
            type: "text",
            text: `Tables in schema "${schemaName}" (${rows.length}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "describe_table",
  "Show columns, types, defaults, nullability, indexes, and RLS policies for a table.",
  {
    table: z.string().describe("Table name"),
    schema: z
      .string()
      .optional()
      .default("public")
      .describe("Schema name (default: public)"),
  },
  async ({ table, schema: schemaName = "public" }) => {
    try {
      const columns = await query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        is_identity: string;
      }>(
        `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          is_identity
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        `,
        [schemaName, table]
      );

      if (columns.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Table "${schemaName}.${table}" not found or has no columns.`,
            },
          ],
        };
      }

      const indexes = await query<{
        indexname: string;
        indexdef: string;
      }>(
        `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2
        ORDER BY indexname
        `,
        [schemaName, table]
      );

      const policies = await query<{
        policyname: string;
        cmd: string;
        roles: string;
        qual: string | null;
      }>(
        `
        SELECT
          policyname,
          cmd,
          array_to_string(roles, ', ') AS roles,
          qual
        FROM pg_policies
        WHERE schemaname = $1 AND tablename = $2
        ORDER BY policyname
        `,
        [schemaName, table]
      );

      const fks = await query<{
        constraint_name: string;
        column_name: string;
        foreign_table: string;
        foreign_column: string;
      }>(
        `
        SELECT
          kcu.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc
          ON kcu.constraint_name = rc.constraint_name
          AND kcu.constraint_schema = rc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
        WHERE kcu.table_schema = $1 AND kcu.table_name = $2
        `,
        [schemaName, table]
      );

      const colLines = columns.map((c) => {
        const identity = c.is_identity === "YES" ? " IDENTITY" : "";
        const nullable = c.is_nullable === "YES" ? "" : " NOT NULL";
        const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
        return `  ${c.column_name.padEnd(35)} ${c.data_type}${nullable}${def}${identity}`;
      });

      const idxLines =
        indexes.length > 0
          ? indexes.map((i) => `  ${i.indexname}: ${i.indexdef}`)
          : ["  (none)"];

      const polLines =
        policies.length > 0
          ? policies.map((p) => `  ${p.policyname} [${p.cmd}] roles=${p.roles}`)
          : ["  (none — RLS may be disabled)"];

      const fkLines =
        fks.length > 0
          ? fks.map(
              (f) =>
                `  ${f.column_name} → ${f.foreign_table}.${f.foreign_column}`
            )
          : ["  (none)"];

      const text = [
        `Table: ${schemaName}.${table}`,
        "",
        "Columns:",
        ...colLines,
        "",
        "Indexes:",
        ...idxLines,
        "",
        "Foreign Keys:",
        ...fkLines,
        "",
        "RLS Policies:",
        ...polLines,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_rls_policies",
  "List all Row Level Security policies across all tables.",
  {
    schema: z
      .string()
      .optional()
      .default("public")
      .describe("Schema name (default: public)"),
  },
  async ({ schema: schemaName = "public" }) => {
    try {
      const rows = await query<{
        tablename: string;
        policyname: string;
        permissive: string;
        roles: string;
        cmd: string;
        qual: string | null;
        with_check: string | null;
      }>(
        `
        SELECT
          tablename,
          policyname,
          permissive,
          array_to_string(roles, ', ') AS roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = $1
        ORDER BY tablename, policyname
        `,
        [schemaName]
      );

      const tablesWithRls = await query<{ relname: string }>(
        `
        SELECT relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
        ORDER BY relname
        `,
        [schemaName]
      );

      const lines: string[] = [];

      if (rows.length === 0) {
        lines.push("No RLS policies found.");
      } else {
        let currentTable = "";
        for (const r of rows) {
          if (r.tablename !== currentTable) {
            currentTable = r.tablename;
            lines.push(`\n${r.tablename}:`);
          }
          lines.push(
            `  [${r.cmd}] ${r.policyname} (${r.permissive}) — roles: ${r.roles || "PUBLIC"}`
          );
          if (r.qual) lines.push(`    USING: ${r.qual}`);
          if (r.with_check) lines.push(`    WITH CHECK: ${r.with_check}`);
        }
      }

      if (tablesWithRls.length > 0) {
        lines.push(
          `\nTables WITHOUT RLS enabled (${tablesWithRls.length}):`
        );
        tablesWithRls.forEach((t) => lines.push(`  ⚠ ${t.relname}`));
      }

      return { content: [{ type: "text", text: lines.join("\n").trim() }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_migrations",
  "List local Supabase migration files and which ones have been applied to the database.",
  {},
  async () => {
    try {
      const migrationsDir = path.join(projectRoot, "supabase", "migrations");
      const localFiles = fs.existsSync(migrationsDir)
        ? fs
            .readdirSync(migrationsDir)
            .filter((f) => f.endsWith(".sql"))
            .sort()
        : [];

      let applied: Set<string> = new Set();
      try {
        const rows = await query<{ name: string }>(
          "SELECT name FROM supabase_migrations.schema_migrations ORDER BY name"
        );
        applied = new Set(rows.map((r) => r.name));
      } catch {
        // table may not exist in local dev
      }

      if (localFiles.length === 0) {
        return {
          content: [{ type: "text", text: "No local migration files found." }],
        };
      }

      const lines = localFiles.map((f) => {
        const name = f.replace(".sql", "");
        const status = applied.has(name) ? "✓ applied" : "○ pending";
        return `  [${status}] ${f}`;
      });

      const text = [
        `Local migrations (${localFiles.length}):`,
        ...lines,
        "",
        applied.size > 0
          ? `Applied in DB: ${applied.size}`
          : "Could not read applied migrations from DB.",
      ].join("\n");

      return { content: [{ type: "text", text: text }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_db_stats",
  "Get database statistics: connection info, database size, table count, and slow queries.",
  {},
  async () => {
    try {
      const [dbInfo] = await query<{
        current_database: string;
        pg_version: string;
        db_size: string;
        active_connections: string;
      }>(
        `
        SELECT
          current_database(),
          version() AS pg_version,
          pg_size_pretty(pg_database_size(current_database())) AS db_size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::text AS active_connections
        `
      );

      const tableCount = await query<{ count: string }>(
        `SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );

      const slowQueries = await query<{
        query: string;
        calls: string;
        mean_exec_time: string;
        total_exec_time: string;
      }>(
        `
        SELECT
          left(query, 80) AS query,
          calls::text,
          round(mean_exec_time::numeric, 2)::text AS mean_exec_time,
          round(total_exec_time::numeric, 2)::text AS total_exec_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
        ORDER BY mean_exec_time DESC
        LIMIT 5
        `
      ).catch(() => [] as { query: string; calls: string; mean_exec_time: string; total_exec_time: string }[]);

      const lines = [
        `Database:          ${dbInfo.current_database}`,
        `Size:              ${dbInfo.db_size}`,
        `Active connections:${dbInfo.active_connections}`,
        `Table count:       ${tableCount[0]?.count ?? "unknown"}`,
        `PostgreSQL:        ${dbInfo.pg_version.split(" ").slice(0, 2).join(" ")}`,
      ];

      if (slowQueries.length > 0) {
        lines.push("\nTop 5 slowest queries (avg ms):");
        slowQueries.forEach((q) => {
          lines.push(
            `  ${q.mean_exec_time.padStart(8)}ms avg (${q.calls} calls) — ${q.query}`
          );
        });
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_rows",
  "Search for rows in a table using a text pattern across all text columns.",
  {
    table: z.string().describe("Table name to search"),
    pattern: z.string().describe("Text pattern to search for (case-insensitive)"),
    schema: z
      .string()
      .optional()
      .default("public")
      .describe("Schema name (default: public)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(20)
      .describe("Max rows to return (default 20)"),
  },
  async ({ table, pattern, schema: schemaName = "public", limit = 20 }) => {
    try {
      const textCols = await query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND data_type IN ('text', 'character varying', 'character', 'name', 'citext')
        ORDER BY ordinal_position
        `,
        [schemaName, table]
      );

      if (textCols.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No text columns found in "${schemaName}.${table}".`,
            },
          ],
        };
      }

      const conditions = textCols
        .map((c, i) => `${c.column_name}::text ILIKE $${i + 1}`)
        .join(" OR ");
      const params = textCols.map(() => `%${pattern}%`);
      params.push(String(limit));

      const rows = await query(
        `SELECT * FROM ${schemaName}.${table} WHERE ${conditions} LIMIT $${params.length}`,
        params
      );

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No rows found matching "${pattern}" in ${schemaName}.${table}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${rows.length} row(s) in ${schemaName}.${table}:\n\n${JSON.stringify(rows, null, 2)}`,
          },
        ],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ─── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
