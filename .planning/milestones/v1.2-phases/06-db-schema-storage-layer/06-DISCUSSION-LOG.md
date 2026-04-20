# Phase 6: DB Schema + Storage Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 06-db-schema-storage-layer
**Areas discussed:** Service snapshot shape, Extra table columns

---

## Service Snapshot Shape

| Option | Description | Selected |
|--------|-------------|----------|
| type discriminator `"catalog"/"custom"` + sourceId on catalog items | Clean discriminated union, traceability via sourceId | ✓ |
| Single shape (no discriminator) | Simpler but loses type safety | |

**User's choice:** Delegated to recommended defaults — "do what its recommended needed"
**Notes:** Claude selected discriminated union with `type: "catalog" | "custom"`. Catalog items include `sourceId` (portfolioServices.id). Price kept as text to match existing column type.

---

## Extra Table Columns

| Option | Description | Selected |
|--------|-------------|----------|
| No extra columns | YAGNI — add only what phases 7–9 need | ✓ |
| Add status/expiresAt/totalPrice | Forward-compat, but scope creep | |

**User's choice:** Delegated to recommended defaults
**Notes:** Claude chose no forward-compat columns per CLAUDE.md constraint ("Don't add features for hypothetical future requirements"). Standard `createdAt`/`updatedAt` included.

---

## Claude's Discretion

- Exact Zod validators and nullability rules
- Import ordering in estimates.ts
- Whether to use drizzle-zod or manual Zod (chose manual, matching portfolioServices pattern)
- Storage method naming (chose `createEstimate`, `getEstimate`, `getEstimateBySlug`, `listEstimates`, `updateEstimate`, `deleteEstimate`)

## Deferred Ideas

None.
