# Schema Organization Research

**Project:** Skale Club — Drizzle Schema Splitting
**Researched:** 2026-03-30
**Confidence:** HIGH (verified with official Drizzle docs + GitHub issues)

## Problem

`shared/schema.ts` is 1,004 lines containing all Drizzle table definitions, pgEnums, Zod schemas, insert schemas, TypeScript types, and plain interfaces for the entire app. This is a maintainability bottleneck that will grow worse as the app adds features.

## How Drizzle-Kit Handles Multi-File Schemas

**Officially supported.** The `schema` field in `drizzle.config.ts` accepts three formats:

### Option A: Single file (current)
```ts
schema: "./shared/schema.ts"
```

### Option B: Folder path (recursive scan)
```ts
schema: "./shared/schema"
```
Drizzle Kit reads all `.ts` files in the folder recursively, picks up every exported `pgTable`, `pgEnum`, etc.

### Option C: Glob pattern
```ts
schema: "./shared/schema/*.ts"        // all files in folder
schema: "./shared/**/*.drizzle.ts"    // Dax's favorite pattern
```

### Option D: Array of explicit paths
```ts
schema: [
  "./shared/schema/auth.ts",
  "./shared/schema/cms.ts",
  "./shared/schema/sales.ts"
]
```

**Recommendation: Option B (folder path)** — simplest, no config to update when adding new domain files.

### The Barrel File Trap (CRITICAL)

**GitHub Issue [#5353](https://github.com/drizzle-team/drizzle-orm/issues/5353)** (closed, fixed in #5363): In drizzle-kit 1.0.0-beta.12, if you have a `schema/index.ts` barrel file that re-exports everything AND you point `drizzle.config.ts` at the folder, drizzle-kit sees each table twice — once from the source file and once from the barrel re-export — producing "duplicate table name" warnings.

**Workaround (from the fix and community consensus):**
- **Do NOT create a barrel `schema/index.ts` for drizzle-kit purposes.** Point `drizzle.config.ts` directly at the folder.
- **For runtime imports**, create a separate barrel re-export file that all consumers use. drizzle-kit won't import this file unless it's inside the schema folder.

**Recommended file layout:**
```
shared/
├── schema/              ← drizzle.config.ts points here
│   ├── auth.ts          ← table + enum definitions only
│   ├── cms.ts
│   ├── chat.ts
│   ├── forms.ts
│   ├── sales.ts
│   └── settings.ts
├── types/               ← shared Zod schemas, TS interfaces, insert schemas
│   ├── auth.ts
│   ├── cms.ts
│   ├── chat.ts
│   ├── forms.ts
│   ├── sales.ts
│   └── settings.ts
└── schema.ts            ← barrel re-export file (NOT inside schema/ folder)
```

**Alternative (simpler, keep Zod + types colocated):**
```
shared/
├── schema/              ← drizzle.config.ts points here
│   ├── auth.ts          ← table + enum + insertSchema + types
│   ├── cms.ts
│   ├── chat.ts
│   ├── forms.ts
│   ├── sales.ts
│   └── settings.ts
└── schema.ts            ← barrel re-export (NOT in schema/ folder)
```

The second approach is simpler and matches what most Drizzle projects do. The barrel file lives outside `schema/` so drizzle-kit won't scan it.

## Cross-Domain Foreign Key References

Foreign keys like `salesReps.userId → users.id` require importing across domain files. This works fine with direct imports:

```ts
// shared/schema/sales.ts
import { users } from "./auth.js";

export const salesReps = pgTable("sales_reps", {
  userId: text("user_id").references(() => users.id).notNull().unique(),
  // ...
});
```

**Cyclic dependency risk:** If `auth.ts` references `sales.ts` and `sales.ts` references `auth.ts`, you get a circular import. In this codebase, the dependency graph is **unidirectional**:
- `sales` → references `auth` (users) and `cms` (vcards)
- `forms` → references `chat` (conversations)
- Nothing references `sales` from within schema definitions

**No cyclic dependencies expected** based on the current FK structure.

**Drizzle Relations:** If using `relations()` from `drizzle-orm`, keep all relations in a single `relations.ts` file to avoid cyclic imports. This codebase doesn't currently use `relations()`, so this is a non-issue for now.

## Impact on `drizzle-zod` and `createInsertSchema`

`createInsertSchema()` takes a table reference and returns a Zod schema. It doesn't care where the table is defined — only that it's a valid Drizzle table object.

**No compatibility issues** with splitting. Each domain file can define its own insert schemas right next to its tables:

```ts
// shared/schema/forms.ts
import { createInsertSchema } from "drizzle-zod";

export const formLeads = pgTable("form_leads", { /* ... */ });

export const insertFormLeadSchema = createInsertSchema(formLeads).omit({
  id: true, createdAt: true, updatedAt: true, /* ... */
});
```

## Impact on `import * as schema` (db.ts)

`server/db.ts` currently does:
```ts
import * as schema from "#shared/schema.js";
const db = drizzle(pool, { schema });
```

This requires a barrel file that re-exports everything. The barrel file at `shared/schema.ts` serves this purpose. As long as the barrel re-exports all tables, `db.select().from(salesReps)` etc. continue working.

## Import Surface Analysis

**64 import sites** across the codebase reference `@shared/schema` or `#shared/schema.js`:

| Consumer | Count | What they import |
|----------|-------|-----------------|
| `server/routes.ts` | 1 file | Tables, insert schemas, types, enums (heaviest consumer) |
| `server/storage.ts` | 1 file | Many tables + types |
| `server/db.ts` | 1 file | `* as schema` |
| `client/src/` | ~40 files | Mostly `type` imports (`CompanySettings`, `HomepageContent`, `FormLead`, etc.) |
| `shared/xpot.ts` | 1 file | Insert schemas for sales domain |
| `shared/routes.ts` | 1 file | Form schemas + enums |
| `shared/form.ts` | 1 file | Types only |
| `scripts/` | ~10 files | Specific tables + types |

**Key insight:** Most client imports are `import type` — these are erased at compile time and have zero runtime cost. Only server files import actual table objects.

**Migration strategy:** Keep `shared/schema.ts` as a barrel file. All 64 import sites continue working unchanged. New code can import from specific domain files directly.

## Proposed Domain Boundaries

Based on the current schema contents:

### `shared/schema/auth.ts` (~30 lines)
- `sessions` table
- `users` table
- Types: `User`, `UpsertUser`
- `systemHeartbeats` table + insert schema + types

### `shared/schema/cms.ts` (~130 lines)
- `translations` table + insert schema + types
- `blogPosts` table + insert schema + types
- `faqs` table + insert schema + types
- `portfolioServices` table + insert schema + types
- `vcards` table + insert schema + types

### `shared/schema/chat.ts` (~80 lines)
- `conversations` table + insert schema
- `conversationMessages` table + insert schema + index definitions
- `chatSettings` table + insert schema
- `chatIntegrations` table + insert schema
- Types: `Conversation`, `ConversationMessage`, `ChatSettings`, `ChatIntegrations`, etc.

### `shared/schema/forms.ts` (~180 lines)
- `leadClassificationEnum`, `leadStatusEnum` enums
- `formLeads` table + insert schema + index definitions
- `formLeadProgressSchema` (manual Zod schema)
- Types: `FormLead`, `LeadClassification`, `LeadStatus`, `FormLeadProgressInput`
- Form configuration interfaces (`FormConfig`, `FormQuestion`, etc.)

### `shared/schema/sales.ts` (~280 lines)
- All `sales*` enums (7 enums)
- `salesReps`, `salesAccounts`, `salesAccountLocations`, `salesAccountContacts`
- `salesVisits`, `salesVisitNotes`, `salesOpportunitiesLocal`
- `salesTasks`, `salesSyncEvents`, `salesAppSettings`
- All corresponding insert schemas + types
- **Imports:** `users` from `./auth.js`, `vcards` from `./cms.js`

### `shared/schema/settings.ts` (~120 lines)
- `integrationSettings` table + insert schema + types
- `twilioSettings` table + insert schema + types
- `companySettings` table + insert schema + types (biggest single table)
- Homepage, consulting steps, horizontal scroll interfaces
- Types: `CompanySettings`, `InsertCompanySettings`, `HomepageContent`, etc.

### `shared/schema.ts` (barrel file, ~40 lines)
```ts
export * from "./schema/auth.js";
export * from "./schema/cms.js";
export * from "./schema/chat.js";
export * from "./schema/forms.js";
export * from "./schema/sales.js";
export * from "./schema/settings.js";
```

## `drizzle.config.ts` Change

```ts
// Before
schema: "./shared/schema.ts"

// After
schema: "./shared/schema"
```

One line change. drizzle-kit will recursively scan `shared/schema/` for all exported Drizzle objects.

## Recommendation

**Split into 6 domain files inside `shared/schema/`, keep barrel re-export at `shared/schema.ts`.**

This approach:
1. ✅ Works with drizzle-kit (folder scan)
2. ✅ Avoids barrel file duplicate detection issue (barrel outside scanned folder)
3. ✅ Zero changes to 64 existing import sites
4. ✅ No cyclic dependency risk (dependency graph is unidirectional)
5. ✅ `createInsertSchema` works unchanged
6. ✅ `import * as schema` in db.ts continues working
7. ✅ New code can import from specific domain files for better tree-shaking

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| drizzle-kit regression with folder scanning | LOW | Official feature since 0.x, well-tested; fallback to array config |
| Circular imports if schema grows | LOW | Current FK graph is unidirectional; monitor when adding new cross-domain refs |
| Barrel file re-export duplication | LOW | Keep barrel outside `schema/` folder; drizzle-kit ignores it |
| Breaking `npm run db:push` | MEDIUM | Test immediately after split; `schema: "./shared/schema"` should be equivalent |
| Type-only import breakage | NONE | Barrel re-exports everything; TS resolves types through barrel |

## Phase 2 Implementation Order

1. Create `shared/schema/` directory
2. Move tables + enums + insert schemas into 6 domain files (one at a time)
3. Update `drizzle.config.ts` to `schema: "./shared/schema"`
4. Convert `shared/schema.ts` into barrel re-export
5. Run `npm run check` (TypeScript validation)
6. Run `npm run db:push` (verify drizzle-kit reads all tables)
7. Verify `npm run dev` starts without errors

## Sources

- **Official Drizzle Docs — Schema Declaration:** https://orm.drizzle.team/docs/sql-schema-declaration (CONFIRMED: multi-file support documented)
- **Official Drizzle Docs — Config File:** https://orm.drizzle.team/docs/drizzle-config-file (CONFIRMED: `schema` accepts string, string[], or glob)
- **GitHub Issue #5353:** drizzle-kit generate fails in multi-file schema with barrel exports (CONFIRMED: closed, fixed)
- **GitHub Issue #5379:** Negation patterns in schema array ignored (CONFIRMED: use folder path, not array with negation)
- **GitHub Discussion #2577:** Relations in separate files + cyclic dependency workaround (CONFIRMED: keep relations in single file)
