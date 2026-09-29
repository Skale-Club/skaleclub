/**
 * Guard for `npm run db:push`.
 *
 * `drizzle-kit push` diffs shared/schema against the live database and applies
 * whatever it finds, including drops. The connection string in this repo's
 * .env points at the production Supabase database, so the push is refused there
 * unless the operator opts in explicitly with ALLOW_DB_PUSH=1.
 *
 * Schema changes normally ship as SQL files in supabase/migrations, applied
 * with `npm run db:migrate`.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
const looksRemote = /supabase\.co|pooler/i.test(url);

if (looksRemote && process.env.ALLOW_DB_PUSH !== "1") {
  console.error(
    [
      "db:push refused: the connection string points at Supabase (supabase.co / pooler).",
      "drizzle-kit push can drop columns and tables on a live database.",
      "Prefer a SQL file in supabase/migrations + `npm run db:migrate`.",
      "If you really mean it, re-run with ALLOW_DB_PUSH=1.",
    ].join("\n"),
  );
  process.exit(1);
}

// drizzle-kit loads shared/schema through its own CJS loader; tsx makes the
// ".js" import specifiers resolve to the .ts sources (same as the old script).
const run = (command, args) =>
  spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import=tsx"].filter(Boolean).join(" ") },
  });

const push = run("npx", ["drizzle-kit", "push"]);
if (push.status !== 0) process.exit(push.status ?? 1);

const rls = run("npx", ["tsx", "scripts/enforce-rls.ts"]);
process.exit(rls.status ?? 0);
