# Phase 6: DB Schema + Storage Layer - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the `estimates` table in PostgreSQL with a JSONB `services` snapshot column, define Zod types in `shared/schema/estimates.ts`, run the Drizzle migration, and expose six typed CRUD methods on `DatabaseStorage` in `server/storage.ts`.

This phase is pure backend infrastructure — no routes, no UI. All other phases (7–9) depend on it.

</domain>

<decisions>
## Implementation Decisions

### Service Snapshot Shape (JSONB)
- **D-01:** Each item in the `services` JSONB array uses a `type` discriminator field with values `"catalog"` or `"custom"`
- **D-02:** Catalog item shape: `{ type: "catalog", sourceId: number, title: string, description: string, price: string, features: string[], order: number }` — `sourceId` is `portfolio_services.id` for traceability
- **D-03:** Custom item shape: `{ type: "custom", title: string, description: string, price: string, features: string[], order: number }` — same shape minus `sourceId`
- **D-04:** `price` stored as `text` (display string, e.g. "R$1.500" or "$500") — consistent with `portfolioServices.price` column; no numeric conversion
- **D-05:** `features` stored as `string[]` — consistent with `portfolioServices.features` (jsonb string array)

### Estimates Table Columns
- **D-06:** Columns: `id` (serial PK), `clientName` (text, not null), `slug` (text, not null, unique), `note` (text, nullable), `services` (jsonb, not null, default `[]`), `createdAt` (timestamp, defaultNow), `updatedAt` (timestamp, defaultNow with $onUpdate)
- **D-07:** No forward-compatibility columns (no `status`, `expiresAt`, `totalPrice`) — YAGNI, surgical scope constraint
- **D-08:** `slug` column is `text().notNull().unique()` — UUID string generated in application code (not a DB uuid column type), consistent with existing slug columns throughout the schema

### Schema File Location
- **D-09:** New file `shared/schema/estimates.ts` — follows the domain-file pattern; barrel-export added to `shared/schema.ts`

### Storage Methods
- **D-10:** Six methods on `DatabaseStorage`: `createEstimate`, `getEstimate` (by id), `getEstimateBySlug`, `listEstimates`, `updateEstimate`, `deleteEstimate` — follow the naming convention of `getPortfolioService`, `createPortfolioService`, etc.

### Claude's Discretion
- Exact Zod schema field validators (min lengths, nullability) — follow patterns in existing schema files
- Import ordering in the new schema file — follow existing conventions
- `drizzle-zod`'s `createInsertSchema` usage vs manual Zod — follow the pattern in the most similar table (portfolioServices uses manual Zod, not drizzle-zod)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Schema Pattern (source of truth for structure)
- `shared/schema/cms.ts` — portfolioServices table definition; the service snapshot fields mirror this table's columns
- `shared/schema/forms.ts` — shows uuid, jsonb, index usage and the $onUpdate pattern for updatedAt
- `shared/schema.ts` — barrel export file; new estimates.ts must be added here

### Storage Layer Pattern
- `server/storage.ts` — DatabaseStorage class; estimates methods must follow the portfolioServices method block (lines ~1740–1770) as the template

### Project Requirements
- `.planning/REQUIREMENTS.md` — EST-01, EST-02 are the requirements this phase must satisfy

### Drizzle Config
- `drizzle.config.ts` — migration config; `npm run db:push` is the migration command

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `portfolioServices` Drizzle table (`shared/schema/cms.ts`): source of the snapshot field names — `title`, `description`, `price`, `features`, `iconName`, `imageUrl`
- `jsonb().$type<T>()` pattern: used in `portfolioServices.features`, `forms.config`, `vcards.socialLinks` — same pattern for `estimates.services`
- `DatabaseStorage` class (`server/storage.ts`): all six CRUD methods are added directly to this class

### Established Patterns
- Schema files: import from `drizzle-orm/pg-core`, define table, define insert Zod schema manually (not drizzle-zod), export `Type = typeof table.$inferSelect` and `InsertType = typeof table.$inferInsert`
- `updatedAt` with `$onUpdate(() => new Date())`: see `forms.ts` line ~20
- Storage methods: async, return typed values, use `db.select()`, `db.insert().returning()`, `db.update().set({...x, updatedAt: new Date()}).returning()`, `db.delete()`

### Integration Points
- `shared/schema.ts`: add `export * from "./schema/estimates.js"` to barrel
- `server/storage.ts`: add `estimates` import at top (line ~15), add six methods to `DatabaseStorage` before the closing `}`
- `server/db.ts`: no changes needed — `db` instance already configured

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to recommended defaults — no specific visual references or "I want it like X" moments
- The JSONB discriminated union (`type: "catalog" | "custom"`) enables TypeScript to narrow the type cleanly in Phase 7+ route handlers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-db-schema-storage-layer*
*Context gathered: 2026-04-19*
