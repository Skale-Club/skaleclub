# Phase 3: Schema Organization - Research

**Researched:** 2026-03-30
**Domain:** Drizzle ORM multi-file schema, barrel re-exports, drizzle-kit folder scanning
**Confidence:** HIGH

## Summary

Split `shared/schema.ts` (1,004 lines) into 6 domain-specific files inside `shared/schema/`, converting the original file to a barrel re-export. The design is already well-understood from the SCHEMA-ORGANIZATION.md research document. The critical constraint: drizzle-kit's barrel file duplicate detection means the barrel MUST live at `shared/schema.ts` (outside the scanned folder), NOT at `shared/schema/index.ts`.

**Primary recommendation:** Create `shared/schema/{auth,cms,chat,forms,sales,settings}.ts` with colocated tables, enums, insert schemas, and types. Keep `shared/schema.ts` as a barrel `export *` re-export. Change drizzle.config.ts `schema` to `"./shared/schema"` (folder path). Zero changes to 64 import sites.

## Standard Stack

### Core
| Library | Version (local) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| drizzle-orm | ^0.39.3 | Table definitions, pgTable, pgEnum | Already in use, no change needed |
| drizzle-kit | ^0.31.8 | Migration generation, schema diffing | Already in use, folder scan supported |
| drizzle-zod | ^0.7.0 | createInsertSchema for Zod schemas | Already in use, works with split files |
| zod | (transitive) | Schema validation, manual schemas | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | (transitive) | PostgreSQL pool via server/db.ts | No changes needed |

### Alternatives Considered
| Approach | Could Use | Tradeoff |
|----------|-----------|----------|
| Glob pattern (`./shared/schema/*.ts`) | Could use instead of folder path | Equivalent but more verbose; folder path is simpler |
| Array of explicit paths | Could list each file explicitly | Must update config when adding domain files; folder path is auto-discovered |
| Separate types/ directory | Could split Zod/types from tables | Adds import complexity; colocated is standard Drizzle pattern |

**Installation:** No new packages needed — purely a restructuring of existing files.

## Architecture Patterns

### Recommended Project Structure
```
shared/
├── schema.ts                ← BARREL re-export (NOT inside schema/)
├── schema/                  ← drizzle.config.ts points here
│   ├── auth.ts              ← sessions, users, systemHeartbeats
│   ├── cms.ts               ← translations, blogPosts, faqs, portfolioServices, vcards
│   ├── chat.ts              ← conversations, conversationMessages, chatSettings, chatIntegrations
│   ├── forms.ts             ← formLeads, leadClassificationEnum, leadStatusEnum, formLeadProgressSchema
│   ├── sales.ts             ← 7 sales enums, salesReps, salesAccounts, salesVisits, salesOpportunities, salesTasks, salesSyncEvents, salesAppSettings
│   └── settings.ts          ← integrationSettings, twilioSettings, companySettings
└── pageSlugs.ts             ← unchanged, imported by settings.ts
```

### Pattern 1: Barrel Re-Export (Zero Consumer Changes)
**What:** Convert `shared/schema.ts` from a monolith to a barrel file that re-exports from 6 domain files.
**When to use:** When you want to split a module without updating import sites.
**Example:**
```typescript
// Source: shared/schema.ts (barrel file — stays OUTSIDE schema/ folder)
export * from "./schema/auth.js";
export * from "./schema/cms.js";
export * from "./schema/chat.js";
export * from "./schema/forms.js";
export * from "./schema/sales.js";
export * from "./schema/settings.js";
```

### Pattern 2: Domain-Colocated Tables + Types
**What:** Each domain file contains its pgTable, pgEnum, createInsertSchema, and TypeScript types together.
**When to use:** Standard Drizzle pattern for domain-organized schemas.
**Example:**
```typescript
// Source: shared/schema/forms.ts
import { pgTable, serial, text, integer, timestamp, boolean, uuid, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leadClassificationEnum = pgEnum("lead_classificacao", [
  "QUENTE", "MORNO", "FRIO", "DESQUALIFICADO",
]);

export const formLeads = pgTable("form_leads", {
  // ... full column definition
}, (table) => ({
  emailIdx: index("form_leads_email_idx").on(table.email),
  // ... more indexes
}));

export const insertFormLeadSchema = createInsertSchema(formLeads).omit({
  id: true, createdAt: true, updatedAt: true, /* ... */
});

export type FormLead = typeof formLeads.$inferSelect;
export type InsertFormLead = z.infer<typeof insertFormLeadSchema>;
```

### Pattern 3: Cross-Domain FK Imports
**What:** Domain files import referenced tables from sibling domain files for FK `.references()`.
**When to use:** When a table in domain A references a table in domain B.
**Example:**
```typescript
// Source: shared/schema/sales.ts
import { users } from "./auth.js";
import { vcards } from "./cms.js";

export const salesReps = pgTable("sales_reps", {
  userId: text("user_id").references(() => users.id).notNull().unique(),
  vcardId: integer("vcard_id").references(() => vcards.id),
  // ...
});
```

### Anti-Patterns to Avoid
- **Barrel index.ts inside schema/:** drizzle-kit scans ALL `.ts` files in the folder. A barrel `index.ts` inside `shared/schema/` causes duplicate table detection warnings. Keep barrel at `shared/schema.ts`.
- **Splitting insert schemas into separate files:** Keep `createInsertSchema()` calls in the same file as their table definition. Splitting adds import noise for no benefit.
- **Circular imports between domain files:** The FK dependency graph is `sales → auth, cms` and `forms → chat`. No reverse dependencies exist. Do not create any.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-domain FK resolution | Custom registry or lazy references | Direct `import { users } from "./auth.js"` | Drizzle `.references(() => table.id)` works across files |
| Insert schema generation | Manual Zod schemas matching table columns | `createInsertSchema(table).omit({...})` | Auto-syncs with column changes, handles Drizzle types |
| Barrel re-export | Custom aggregation script | `export * from "./schema/*.js"` | TypeScript resolves this natively, zero runtime cost |

**Key insight:** The barrel re-export pattern is the standard way to split TypeScript modules without breaking consumers. The only domain-specific caveat is drizzle-kit's folder scanning, which is solved by keeping the barrel outside the scanned folder.

## Cross-Domain FK Dependency Map

```
auth.ts (users)
  ↑
  ├── sales.ts (salesReps.userId → users.id)
  │
cms.ts (vcards)
  ↑
  └── sales.ts (salesReps.vcardId → vcards.id)

chat.ts (conversations)
  ↑
  └── forms.ts (formLeads.conversationId — TEXT, not FK, but semantically related)

No reverse dependencies exist — the graph is a DAG (directed acyclic graph).
```

## Common Pitfalls

### Pitfall 1: Barrel File Inside Scanned Folder
**What goes wrong:** drizzle-kit scans `shared/schema/` and finds both `sales.ts` (defines `salesReps`) and `index.ts` (re-exports `salesReps`). Reports "duplicate table name" warnings or errors.
**Why it happens:** drizzle-kit imports all `.ts` files in the folder, barrel re-exports every table, so each table is found twice.
**How to avoid:** Keep barrel at `shared/schema.ts` (outside the folder). Point `drizzle.config.ts` at `./shared/schema` (the folder). The barrel is NOT inside the scanned folder, so no duplication.
**Warning signs:** `npm run db:push` prints "duplicate table name" or "table X already exists".

### Pitfall 2: Missing `.js` Extension in Relative Imports
**What goes wrong:** TypeScript compilation errors — `"moduleResolution": "bundler"` with `"allowImportingTsExtensions": true` requires `.js` extensions on relative imports.
**Why it happens:** ESM requires explicit file extensions. TypeScript with bundler resolution maps `.js` → `.ts` at compile time.
**How to avoid:** All relative imports between schema files must use `.js` extension: `import { users } from "./auth.js"` not `from "./auth"`.
**Warning signs:** `npm run check` fails with "Cannot find module './auth'" errors.

### Pitfall 3: Breaking `import * as schema` in db.ts
**What goes wrong:** `server/db.ts` uses `import * as schema from "#shared/schema.js"` and passes the namespace to `drizzle(pool, { schema })`. If the barrel re-export is incomplete, some tables won't be available for relational queries.
**Why it happens:** Forgot to add `export *` for one domain file in the barrel.
**How to avoid:** The barrel must `export *` from ALL 6 domain files. Verify with `npm run check` and a manual spot-check that `db.select().from(salesReps)` still resolves.
**Warning signs:** TypeScript errors about missing exports, or runtime "table not found" errors from drizzle.

### Pitfall 4: `pageSlugs.ts` Import Path Changes
**What goes wrong:** `settings.ts` needs to import `DEFAULT_PAGE_SLUGS` and `PageSlugs` from `shared/pageSlugs.ts`. If the import path is wrong (relative path changes when file moves), settings.ts won't compile.
**Why it happens:** Original import was `import { DEFAULT_PAGE_SLUGS, type PageSlugs } from "./pageSlugs.js"` at the root of `shared/`. Now `settings.ts` is inside `shared/schema/`, so the relative path changes to `"../pageSlugs.js"`.
**How to avoid:** Update the import in `settings.ts` to `from "../pageSlugs.js"`.
**Warning signs:** `npm run check` fails on the import line.

## Code Examples

### Barrel Re-Export (Final shared/schema.ts)
```typescript
// Source: shared/schema.ts
export * from "./schema/auth.js";
export * from "./schema/cms.js";
export * from "./schema/chat.js";
export * from "./schema/forms.js";
export * from "./schema/sales.js";
export * from "./schema/settings.js";
```

### Updated drizzle.config.ts
```typescript
// Source: drizzle.config.ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  throw new Error("DATABASE_URL or POSTGRES_URL is missing, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema",      // ← changed from "./shared/schema.ts" (folder path)
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL!,
  },
});
```

### Domain File Template (e.g., auth.ts)
```typescript
// Source: shared/schema/auth.ts
import { pgTable, text, serial, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemHeartbeatSchema = createInsertSchema(systemHeartbeats).omit({
  id: true,
  createdAt: true,
});
export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
export type InsertSystemHeartbeat = z.infer<typeof insertSystemHeartbeatSchema>;
```

### Domain File with Cross-Domain FK (sales.ts)
```typescript
// Source: shared/schema/sales.ts
import { pgTable, text, serial, integer, timestamp, boolean, jsonb, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.js";   // ← cross-domain import for FK
import { vcards } from "./cms.js";   // ← cross-domain import for FK

export const salesRepRoleEnum = pgEnum("sales_rep_role", ["rep", "manager", "admin"]);
// ... remaining 6 enums, 11 tables, insert schemas, and types
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic schema.ts (1,004 lines) | 6 domain files + barrel (~200 lines each) | This phase | Maintainability, IDE navigation |
| `schema: "./shared/schema.ts"` (single file) | `schema: "./shared/schema"` (folder path) | drizzle-kit 0.x | Auto-discovers new domain files |

**Deprecated/outdated:**
- Nothing deprecated — folder path scanning is an official, well-supported drizzle-kit feature.

## Open Questions

None — the architecture is fully determined from the SCHEMA-ORGANIZATION.md research. All technical decisions (barrel placement, folder scanning, cross-domain FK imports) have been validated against Drizzle docs and community issues.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm run check, npm run db:push | ✓ | — | — |
| PostgreSQL | npm run db:push | ✓ (env) | — | — |
| drizzle-kit | Schema scanning | ✓ | 0.31.8 | — |
| drizzle-orm | Table definitions | ✓ | 0.39.3 | — |
| DATABASE_URL or POSTGRES_URL | db:push connectivity | ✓ (env) | — | — |

**Missing dependencies with no fallback:** None — all dependencies are already installed.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no test runner configured) |
| Config file | none |
| Quick run command | `npm run check` (TypeScript validation) |
| Full suite command | `npm run check && npm run db:push` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHM-01 | 6 domain files created in shared/schema/ | manual | `ls shared/schema/` | ❌ Wave 0 |
| SCHM-02 | shared/schema.ts is barrel re-export | automated | `npm run check` (TS resolution) | ❌ Wave 0 |
| SCHM-03 | drizzle.config.ts uses folder path | manual | grep verification | ❌ Wave 0 |
| SCHM-04 | db:push detects schema changes | manual | `npm run db:push` | N/A (runtime) |

### Sampling Rate
- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check && npm run db:push --dry-run` (if available)
- **Phase gate:** `npm run check` green, `npm run db:push` connects and lists tables

### Wave 0 Gaps
- None — existing tooling (`npm run check`, `npm run db:push`) covers validation. No test framework to set up.

## Import Surface Summary

| Consumer Area | Import Pattern | Count | Impact |
|---------------|---------------|-------|--------|
| `server/routes.ts` | `#shared/schema.js` | ~11 lines | Barrel handles it |
| `server/db.ts` | `import * as schema from "#shared/schema.js"` | 1 | Barrel handles it |
| `server/storage.ts` | `#shared/schema.js` | 1 | Barrel handles it |
| `server/replit_integrations/` | `#shared/schema.js` | 1 | Barrel handles it |
| `server/integrations/` | `#shared/schema.js` | 1 | Barrel handles it |
| `client/src/` (pages, components, hooks) | `@shared/schema` | ~35 | Barrel handles it |
| `scripts/` | `../shared/schema` or `@shared/schema` | ~15 | Barrel handles it |
| `drizzle.config.ts` | `./shared/schema.ts` → `./shared/schema` | 1 | **Requires change** |

**Total import sites: 70 lines across ~58 files. Only drizzle.config.ts needs a change.**

## Sources

### Primary (HIGH confidence)
- Drizzle ORM docs — Schema Declaration: https://orm.drizzle.team/docs/sql-schema-declaration (multi-file support confirmed)
- Drizzle ORM docs — Config File: https://orm.drizzle.team/docs/drizzle-config-file (folder path confirmed)
- GitHub Issue #5353 — barrel file duplicate detection (closed, fixed)
- Local verification: `npm view drizzle-kit version` → 0.31.10 (folder scan supported)
- Local verification: `package.json` → drizzle-kit ^0.31.8, drizzle-orm ^0.39.3, drizzle-zod ^0.7.0
- Local verification: `tsconfig.json` paths `@shared/* → ./shared/*` + `package.json` imports `#shared/* → ./shared/*`

### Secondary (MEDIUM confidence)
- SCHEMA-ORGANIZATION.md research document (this project's own analysis)
- Community consensus on barrel file workaround (GitHub discussions, Stack Overflow)

### Tertiary (LOW confidence)
- None — all findings are verified against official docs or local project state.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — using existing versions, no new dependencies
- Architecture: HIGH — barrel pattern is standard TypeScript, folder scanning is official Drizzle feature
- Pitfalls: HIGH — barrel trap confirmed by GitHub issue, FK dependency graph verified from source
- Import surface: HIGH — all 70 import lines enumerated and verified against barrel strategy

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days — Drizzle schema splitting is stable)
