---
phase: 10
slug: schema-upload-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None installed** — manual QA + `tsc` + shell smoke tests are the only automated guards (documented constraint in PROJECT.md and CLAUDE.md) |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~12 seconds (tsc) / ~35 seconds (full build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full compile green + one curl smoke against `/api/uploads/links-page` on `npm run dev`
- **Max feedback latency:** 35 seconds (full build)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | LINKS-01 | unit (compile) | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | LINKS-01, LINKS-03 | unit (compile) | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | LINKS-01, LINKS-03 | smoke | `curl PUT /api/company-settings` + GET — verify normalized shape + UUID `id` | manual | ⬜ pending |
| 10-02-01 | 02 | 2 | LINKS-02, LINKS-06 | unit (compile) | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | LINKS-02, LINKS-06 | smoke | `curl POST /api/uploads/links-page` — 200 with image, 401 without auth, 413 oversized, 415 non-image | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No Wave 0 gaps — all implementation-side infrastructure exists:*
- Drizzle schema file (`shared/schema/settings.ts`) compiles today
- Route registration (`server/routes/*.ts`) exists and works
- `SupabaseStorageService` class exists and is used elsewhere
- `requireAdmin` middleware exists
- `express.json({ limit: '50mb' })` already configured

*Optional convenience: `scripts/smoke-links-upload.ts` for repeatable manual QA — deferred.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload round-trip with real Supabase bucket | LINKS-02 | Requires live Supabase env + admin session; no test framework to mock | Start `npm run dev`, log in as admin, `curl -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page -H 'Content-Type: application/json' -d '{"filename":"a.png","data":"<b64>","assetType":"avatar"}'` → expect 200 with URL; hit URL in browser to confirm public access |
| Legacy row migration on read | LINKS-01, LINKS-03 | One-time invariant not re-exercised by normal flow | Inspect `company_settings.links_page_config.links` in DB for a seed row → confirm no `id` field → GET `/api/company-settings` → confirm response has `id: <UUID>` on every link |
| Oversize rejected with clear error | LINKS-06 | 413 path depends on Express body limit + explicit handler | `curl -X POST .../uploads/links-page -d '{"filename":"big.png","data":"<3MB of base64>","assetType":"avatar"}'` → expect 413 |
| Non-image MIME rejected | LINKS-06 | Validation is runtime-only | `curl` with `filename: "x.exe"` → expect 415 |
| Auth guard | LINKS-06 | Middleware semantics | `curl` with no cookie → expect 401 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (`tsc`) or manual QA instructions with concrete curl commands
- [x] Sampling continuity: every task commits through `tsc`; smoke tests at wave merge
- [x] Wave 0 covers all MISSING references (none — nothing missing)
- [x] No watch-mode flags
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-20 (documented constraint — no test framework; `tsc` + manual QA is the contract)
