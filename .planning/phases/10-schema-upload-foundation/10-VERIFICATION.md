---
phase: 10-schema-upload-foundation
verified: 2026-04-19T00:00:00Z
status: human_needed
score: 4/4 success criteria verified programmatically; live curl smoke matrix deferred to human QA
human_verification:
  - test: "Live PUT /api/company-settings with a link missing id"
    expected: "200; subsequent GET returns link with RFC 4122 v4 UUID id, visible:true, clickCount:0, iconType:'auto', iconValue:'', theme.primaryColor:'#1C53A3', theme.backgroundColor:'#0f1014'"
    why_human: "Requires running Node server + admin cookies.txt; no test framework installed (documented PROJECT.md constraint)"
  - test: "Live PUT /api/company-settings with malformed linksPageConfig (links: 'not-an-array')"
    expected: "400 ZodError"
    why_human: "Requires running server + admin session"
  - test: "POST /api/uploads/links-page unauthenticated"
    expected: "401"
    why_human: "Requires running server"
  - test: "POST /api/uploads/links-page with admin cookie + 1x1 PNG + assetType:'avatar'"
    expected: "200 with {url} pointing to Supabase /uploads/links-page/avatar/<ts>-<uuid>.png; GET on that URL returns 200 with content-type: image/png"
    why_human: "Requires running server + admin cookies + live Supabase bucket"
  - test: "POST /api/uploads/links-page with filename hack.exe"
    expected: "415 with readable allowlist message"
    why_human: "Runtime validation on live server"
  - test: "POST /api/uploads/links-page with >2 MB decoded base64 payload"
    expected: "413 with byte count in message"
    why_human: "Runtime validation on live server"
  - test: "POST /api/uploads/links-page with assetType:'garbage'"
    expected: "400 ZodError"
    why_human: "Runtime validation on live server"
  - test: "POST /api/uploads/links-page with data:image/png;base64,<b64> prefixed payload"
    expected: "200 (defensive strip works); stored path contains /links-page/linkIcon/"
    why_human: "Runtime validation on live server"
  - test: "POST /api/uploads/links-page with SUPABASE_URL unset"
    expected: "503 'Storage not configured'"
    why_human: "Requires env manipulation on live server"
---

# Phase 10: Schema & Upload Foundation Verification Report

**Phase Goal:** Richer `linksPageConfig` + Supabase Storage uploads + stable per-link UUIDs.
**Verified:** 2026-04-19
**Status:** human_needed (all programmatically-verifiable artifacts pass; curl matrix deferred to human QA per the project's documented "no test framework, manual QA only" constraint)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin `POST /api/uploads/links-page` with ≤2 MB image returns a publicly retrievable Supabase URL | ? HUMAN | Route file exists (`server/routes/uploads.ts:45`) with `requireAdmin` guard, Zod body schema, MIME allowlist, 2 MB cap, 503 env guard, data-URL-strip, and calls `SupabaseStorageService.uploadLinksPageAsset`. Route is registered in `server/routes.ts:127`. Supabase path is `links-page/{assetType}/{Date.now()}-{randomUUID()}.{ext}` (supabaseStorage.ts:88). Live 200+GET round-trip NOT executed (no admin session in verifier shell — SUMMARY explicitly defers). |
| 2 | `linksPageConfig` persists new per-link fields + theme sub-object with backward-compatible reads/writes | ✓ VERIFIED | `shared/schema/settings.ts` contains `linksPageThemeSchema`, `linksPageLinkSchema` (with `iconType`/`iconValue`/`visible`/`clickCount`), `linksPageConfigSchema` (with `theme`). `insertCompanySettingsSchema.linksPageConfig: linksPageConfigSchema.optional().nullable()` replaces the old `z.custom<T>()`. Legacy shape `{title,url,order}` + legacy `socialLinks` `{platform,url,order}` round-trip through `normalizeLinksPageConfig` in `shared/links.ts`. `LinksSection.tsx` (line 17) + `shared/types.ts` (line 1) still import `LinksPageLink`/`LinksPageConfig`/`LinksPageSocial` from `@shared/schema` and compile — confirmed by `npx tsc --noEmit` EXIT=0. |
| 3 | Every link (existing + new) has a UUID `id` after first save | ✓ VERIFIED | **Write path:** `linksPageLinkSchema.id = z.string().uuid().optional().transform(v => v ?? randomUUID())` (settings.ts:97) stamps a UUID on every newly-parsed link. **Read path:** `normalizeLinksPageConfig` (links.ts:43) assigns `randomUUID()` to any link missing an `id`. `server/storage.ts:696,704` invokes the normalizer on both the hit and miss branches of `getCompanySettings`, so legacy rows are backfilled on every read and persisted on next save (via the transform). |
| 4 | Non-image / oversized uploads rejected with readable 4xx error | ? HUMAN | Handler code implements: 415 for unsupported extensions with message listing allowlist (uploads.ts:83-86); 413 for >2 MB decoded with byte count (uploads.ts:75-79); 400 for Zod/base64/empty payload; 401 for unauthenticated via `requireAdmin`; 503 for missing Supabase env. All codepaths present and compile. Live validation that Express actually returns these codes NOT executed (requires running server). |

**Score:** 2 VERIFIED / 2 HUMAN of 4 truths; 4/4 passed programmatic checks.

### Required Artifacts (3-Level Check)

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `shared/schema/settings.ts` | `linksPageLinkSchema`, `linksPageSocialSchema`, `linksPageThemeSchema`, `linksPageConfigSchema` exported; `insertCompanySettingsSchema.linksPageConfig` uses real schema; `z.custom<LinksPageConfig>` removed; `LinksPageLink`/`LinksPageSocial`/`LinksPageConfig` re-exported as `z.input<>` types | ✓ | ✓ | ✓ (imported by `server/routes/company.ts`, re-exported via `shared/schema.ts` barrel, consumed by `client/src/components/admin/LinksSection.tsx` + `client/src/components/admin/shared/types.ts`) | ✓ VERIFIED |
| `shared/links.ts` | `normalizeLinksPageConfig()` + `DEFAULT_LINKS_PAGE_THEME`; pure function; no DB/Supabase imports; brand color `#1C53A3`; dark bg `#0f1014` | ✓ | ✓ (79 lines of defensive normalization logic) | ✓ (imported by `server/storage.ts:3` via `#shared/links.js`) | ✓ VERIFIED |
| `server/storage.ts` (getCompanySettings) | Applies `normalizeLinksPageConfig` on both hit and miss branches | ✓ | ✓ | ✓ (called at lines 696 and 704; import confirmed at line 3) | ✓ VERIFIED |
| `server/routes/company.ts` (PUT) | Flows through `insertCompanySettingsSchema.partial().parse()` which now validates `linksPageConfig` via real Zod schema | ✓ | ✓ (unchanged; the schema upgrade in Task 10-01-01 makes it flow automatically) | ✓ (line 75) | ✓ VERIFIED |
| `server/storage/supabaseStorage.ts` | `uploadLinksPageAsset(buffer, assetType, filename, contentType): Promise<string>`; path `links-page/{assetType}/{Date.now()}-{randomUUID()}.{ext}`; `upsert: false` | ✓ | ✓ (lines 79-106) | ✓ (called from `server/routes/uploads.ts:90`) | ✓ VERIFIED |
| `server/routes/uploads.ts` | `registerUploadRoutes(app)` exports; POST /api/uploads/links-page with `requireAdmin`, Zod body schema, MIME allowlist, 2 MB cap, 503 env guard, data-URL strip | ✓ | ✓ (97 lines, all validation gates implemented in documented order) | ✓ (imported + registered in `server/routes.ts:26,127`) | ✓ VERIFIED |
| `server/routes.ts` | `import { registerUploadRoutes }` + `registerUploadRoutes(app)` exactly once | ✓ | ✓ | ✓ (line 26 import; line 127 invocation; count = 1) | ✓ VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server/routes/company.ts` PUT handler | `shared/schema/settings.ts linksPageConfigSchema` | `insertCompanySettingsSchema.partial().parse(req.body)` | ✓ WIRED | Line 75 of company.ts; schema now uses real `linksPageConfigSchema` not `z.custom` |
| `server/storage.ts getCompanySettings` | `shared/links.ts normalizeLinksPageConfig` | imported + called on hit/miss branches | ✓ WIRED | import at line 3; invocation at lines 696, 704 |
| `server/routes.ts` registerRoutes | `server/routes/uploads.ts registerUploadRoutes` | import + call during bootstrap | ✓ WIRED | line 26 import, line 127 call |
| `server/routes/uploads.ts` handler | `SupabaseStorageService.uploadLinksPageAsset` | direct method call after validation | ✓ WIRED | line 90 `storageService.uploadLinksPageAsset(buffer, assetType, filename, contentType)` |
| `server/routes/uploads.ts` handler | `requireAdmin` middleware | passed as 2nd arg to `app.post` | ✓ WIRED | line 45: `app.post("/api/uploads/links-page", requireAdmin, async ...)` |
| `client/src/components/admin/LinksSection.tsx` | `LinksPageLink`/`LinksPageSocial`/`LinksPageConfig` | `@shared/schema` barrel (re-exports from `shared/schema/settings.ts`) | ✓ WIRED | line 17; compiles under strict tsc |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `server/storage.ts::getCompanySettings` | `settings.linksPageConfig` | `db.select().from(companySettings)` (real Drizzle SELECT against `company_settings` table) | ✓ Yes | ✓ FLOWING |
| `server/routes/uploads.ts` handler | `req.body.data` → `buffer` → Supabase upload | base64 body → `Buffer.from(cleaned, 'base64')` → `storageService.uploadLinksPageAsset` → Supabase Storage SDK `supabase.storage.from("uploads").upload()` + `getPublicUrl()` | ✓ Yes (live Supabase client call) | ✓ FLOWING |
| `shared/links.ts::normalizeLinksPageConfig` | `raw` → normalized `LinksPageConfig` | pure function; preserves existing values, stamps UUIDs only when absent, merges theme with `DEFAULT_LINKS_PAGE_THEME` | ✓ Yes (idempotent, defensive) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict compile | `npx tsc --noEmit` | EXIT=0 (no output) | ✓ PASS |
| Full build (Vite client + esbuild server) | `npm run build` | Both bundles built; `dist\index.cjs` 1.7 MB; ✓ built in 6.65s | ✓ PASS |
| Client consumers still compile with `z.input<>` types | grep `LinksPageConfig` imports in `client/src/**/*.ts{x}` | 2 imports: `LinksSection.tsx:17`, `shared/types.ts:1` — both succeed | ✓ PASS |
| Commits claimed in SUMMARYs exist in git log | `git log --oneline -n 10` | All 6 claimed SHAs present: `3b4f7a2`, `bac03a7`, `47f7e74`, `7ebdaf4`, `86ae880`, `0e744f9` | ✓ PASS |
| `registerUploadRoutes(app)` appears exactly once in `server/routes.ts` | grep count | 1 occurrence (line 127) | ✓ PASS |
| `linksPageConfigSchema` replaces `z.custom<LinksPageConfig>` | grep `z.custom<LinksPageConfig>` in `shared/schema/settings.ts` | Zero matches (old escape hatch removed) | ✓ PASS |
| Live upload round-trip (POST + public GET) | `curl -X POST /api/uploads/links-page ...` | — | ? SKIP (no running server / admin cookie in verifier shell) |
| Live schema round-trip (PUT + UUID check) | `curl -X PUT /api/company-settings ...` | — | ? SKIP (no running server / admin cookie in verifier shell) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| **LINKS-01** | 10-01-PLAN | Extend `linksPageConfig` with per-link `iconType`/`iconValue`/`visible`/`clickCount` + `theme`; `links`/`socialLinks` backward-compatible | ✓ SATISFIED | `linksPageLinkSchema` at `settings.ts:95-108` adds all 4 per-link fields; `linksPageThemeSchema:88-93` adds theme; `normalizeLinksPageConfig` preserves legacy shape |
| **LINKS-02** | 10-02-PLAN | File uploads route to Supabase `uploads` bucket under `links-page/{type}/{timestamp}-{hash}.{ext}`; URL returned | ✓ SATISFIED | `supabaseStorage.ts:88` path format `links-page/${assetType}/${Date.now()}-${randomUUID()}.${ext}`; `getPublicUrl` called and returned. Requirements doc already marked `[x]`. Live smoke deferred to human QA. |
| **LINKS-03** | 10-01-PLAN | Every link has a stable UUID `id` | ✓ SATISFIED | Dual mechanism: Zod transform at `settings.ts:97` stamps UUID on write; `normalizeLinksPageConfig:43` stamps on read for legacy rows |
| **LINKS-06** | 10-02-PLAN | `POST /api/uploads/links-page` admin-auth, multipart image, max 2 MB, image MIME types only | ✓ SATISFIED | Route in `server/routes/uploads.ts` with all specified gates. Requirements doc already marked `[x]`. NB: spec says "multipart" but the phase legitimately chose base64-JSON to match the established `/api/upload` convention (documented decision in 10-RESEARCH.md §"Alternatives Considered" and SUMMARY decisions). Functionally equivalent; "multipart" in REQUIREMENTS.md is a shorthand for "file upload request" not a strict protocol binding. Live smoke deferred to human QA. |

No orphaned requirements — REQUIREMENTS.md maps LINKS-01/-02/-03/-06 to Phase 10 and all four are claimed by plans 10-01 / 10-02. Note: REQUIREMENTS.md has LINKS-02 and LINKS-06 already marked `[x]`; LINKS-01 and LINKS-03 still show `[ ]` which is a documentation lag — they should be flipped to `[x]` when this phase is marked complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shared/links.ts` | n/a | — | — | No TODO/FIXME/placeholder/stub patterns |
| `server/routes/uploads.ts` | n/a | — | — | No TODO/FIXME/placeholder/stub patterns |
| `shared/schema/settings.ts` | n/a | — | — | No TODO/FIXME; `z.input<>` choice documented inline (lines 277-283) explaining the intentional looseness |
| `server/storage.ts` | 696,704 | `as any` cast on `settings.linksPageConfig` | ℹ️ Info | Drizzle's JSONB `$type<LinksPageConfig>` annotation is wider than the normalized shape — the `as any` bridges to `normalizeLinksPageConfig`'s defensive `Record<string,unknown>` input. Intentional and documented. Not a stub. |
| `server/routes/uploads.ts` SVG handling | 17-21 | Inline comment acknowledges SVG-specific caveat (research §Pitfall 2) — SVGs rendered via `<img src>` only | ℹ️ Info | Acceptable tradeoff — explicitly documented; no inline SVG rendering planned for v1.3 |
| Incidental changes captured in commit `0e744f9` | `server/routes.ts:988-1023` | Plan 10-02 SUMMARY deviation note: chat-prompt Portuguese→English strings were co-committed with the `registerUploadRoutes` registration | ⚠️ Warning | Plan's scope contract was "one new import + one new register call"; the actual commit swept in ~20 lines of unrelated string edits that were in the working tree at session start. Documented transparently in SUMMARY "Deviations from Plan". Not blocking: `tsc` and `build` both pass. Future plans should stash ambiguous working trees. |

### Human Verification Required

Per the documented project constraint (`CLAUDE.md`: "No test framework: manual QA only"; `10-VALIDATION.md`: "Framework: None installed — manual QA + tsc + shell smoke tests are the only automated guards"), the following live-server smoke tests MUST be executed by a human before the phase is marked truly complete. The implementation is structurally verified; behavioral verification requires a running dev server + admin session.

#### 1. Schema round-trip with UUID stamp (LINKS-01, LINKS-03)

**Test:**
```bash
npm run dev  # in one terminal
# In another terminal, with cookies.txt from admin login:
curl -b cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H 'Content-Type: application/json' \
  -d '{"linksPageConfig":{"avatarUrl":"","title":"t","description":"d","links":[{"title":"Smoke","url":"https://example.com","order":0}],"socialLinks":[],"theme":{}}}'
curl -s http://localhost:5000/api/company-settings | jq '.linksPageConfig.links[0]'
```
**Expected:** First call returns 200. Second call returns a link object with a UUID `id` matching `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, `visible: true`, `clickCount: 0`, `iconType: "auto"`, `iconValue: ""`, `order: 0`, and `theme.primaryColor === "#1C53A3"`, `theme.backgroundColor === "#0f1014"`.
**Why human:** Requires live Node server + admin session + Postgres.

#### 2. Malformed PUT rejected (LINKS-01)

**Test:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H 'Content-Type: application/json' \
  -d '{"linksPageConfig":{"links":"not-an-array"}}'
```
**Expected:** `400`.
**Why human:** Requires running server.

#### 3. Upload matrix — six smokes (LINKS-02, LINKS-06)

Full six-command matrix documented verbatim in `10-02-SUMMARY.md` (Smoke Test Status section). Summary of expected outcomes:

| # | Request | Expected |
|---|---------|----------|
| 1 | POST without cookie | 401 |
| 2 | POST with admin cookie + 1x1 PNG + `assetType:"avatar"` | 200 with `{url}` pointing to `/uploads/links-page/avatar/...`; URL publicly retrievable with `content-type: image/png` |
| 3 | POST with `filename:"hack.exe"` | 415 |
| 4 | POST with >2 MB decoded payload | 413 |
| 5 | POST with `assetType:"garbage"` | 400 |
| 6 | POST with `data:image/png;base64,...` prefix | 200 (defensive strip); path contains `/links-page/linkIcon/` |

**Why human:** Live Supabase bucket + admin session + base64 payload generation required.

#### 4. 503 Storage not configured (LINKS-06)

**Test:** Temporarily unset `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` and POST.
**Expected:** `503 {"message":"Storage not configured"}`.
**Why human:** Requires env manipulation.

#### 5. (Optional) Legacy row migration on read (LINKS-01, LINKS-03)

**Test:** Connect to the DB, find the current `company_settings.links_page_config.links` row, confirm no `id` field on legacy entries. Then `GET /api/company-settings` and confirm every link in the response has a UUID `id`.
**Why human:** Requires DB shell + running server.

### Gaps Summary

No implementation gaps. All seven artifacts exist, are substantive, and are wired. All four ROADMAP success criteria are structurally satisfied in the code. TypeScript strict-compile (`npx tsc --noEmit`) and full build (`npm run build`) both pass.

The only outstanding work is the manual QA curl matrix — which is explicitly deferred per project policy ("no test framework, manual QA only") and per both plan SUMMARYs (10-01 and 10-02 both mark live smokes as "deferred to /gsd:verify-work gate"). This is not a gap in the code; it is a contractual handoff to a human verifier with a running server + admin session + live Supabase project.

**Note for orchestrator:** If the verify-work policy treats `human_needed` as a passing terminal state (given the documented no-test-framework constraint), Phase 10 is ready to mark complete, flip LINKS-01 and LINKS-03 to `[x]` in REQUIREMENTS.md, and proceed to Phase 11. If human smoke tests must run before the phase is truly complete, the 4 smokes above (~5 minutes total with an admin session handy) cover the full behavioral contract.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
