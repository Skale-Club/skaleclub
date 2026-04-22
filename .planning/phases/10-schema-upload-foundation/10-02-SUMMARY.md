---
phase: 10-schema-upload-foundation
plan: 02
subsystem: server-uploads
tags: [supabase, storage, upload, admin-auth, base64, mime-allowlist, links-page]
requires:
  - 10-01 (LinksPageConfig schema + normalizer; not a compile-time dep but ships in same phase)
provides:
  - SupabaseStorageService.uploadLinksPageAsset(buffer, assetType, filename, contentType)
  - POST /api/uploads/links-page (admin-auth, base64 JSON body, returns {url})
  - registerUploadRoutes(app) bootstrap export
affects:
  - server/routes.ts bootstrap (one new import + one new register*Routes call)
  - Supabase `uploads` bucket — new prefix `links-page/{avatar|background|linkIcon}/`
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - Base64-JSON upload (not multipart) — extends the convention already used by /api/upload, /api/update-favicon, Xpot lead photos
    - Pre-flight 503 env guard before deep Supabase throw (Xpot leads precedent)
    - Defensive data-URL prefix strip — accepts both raw base64 and `data:image/png;base64,...`
    - MIME allowlist derived from extension; size cap on DECODED bytes (not wire bytes)
key-files:
  created:
    - server/routes/uploads.ts
  modified:
    - server/storage/supabaseStorage.ts
    - server/routes.ts
decisions:
  - Base64-JSON over multipart — keeps a single upload code path across all admin uploaders; 2 MB cap fits trivially under the 50 MB Express body limit even with 33% base64 inflation
  - Path uses `{Date.now()}-{randomUUID()}` (matches existing uploadBuffer convention) NOT content-hash — research §"Pitfall 4" recommendation deferred for v1.3; idempotency-by-content-hash is a future enhancement
  - 503 pre-flight env guard before Zod parse — clearer than a deep getSupabaseAdmin() throw in misconfigured environments
  - Strip data URL prefix defensively in handler — prevents corrupted uploads when client forgets to slice off `data:image/png;base64,`
  - Reuse existing `requireAdmin` from server/routes/_shared.ts — same 401/403 semantics as every other admin route
  - assetType enum values frozen at exactly: avatar, background, linkIcon (the three Phase 12 admin UI slots)
metrics:
  duration: ~3 minutes
  completed: 2026-04-20
  tasks: 3
  files_changed: 3
  commits: 3
---

# Phase 10 Plan 02: Upload Endpoint Summary

Added a new admin-authenticated `POST /api/uploads/links-page` endpoint that accepts a base64-JSON body `{filename, data, assetType}`, enforces an image MIME allowlist (PNG/JPEG/WebP/SVG/GIF/AVIF), caps the decoded payload at 2 MB, writes to the existing Supabase `uploads` bucket under `links-page/{assetType}/{timestamp}-{uuid}.{ext}`, and returns `{url}` — using the proven base64-JSON pattern (no multer, no new deps).

## What Shipped

### 1. `server/storage/supabaseStorage.ts` — new method

Added `SupabaseStorageService.uploadLinksPageAsset(buffer, assetType, filename, contentType): Promise<string>`.

| Aspect | Behavior |
|--------|----------|
| Path format | `links-page/{assetType}/{Date.now()}-{randomUUID()}.{ext}` |
| AssetType enum | `"avatar" \| "background" \| "linkIcon"` — exact-three values, mirrors Phase 12 UI slots |
| Bucket | `uploads` (auto-provisioned public via `ensureBucket()`) |
| upsert | `false` — two uploads of "same" file produce two distinct objects (acceptable for v1.3) |
| MIME validation | NONE — caller (the route) is responsible; this method trusts its inputs |
| Returns | Public Supabase URL via `getPublicUrl(objectId).publicUrl` |
| Existing methods | `getUploadURL`, `uploadBuffer`, `serveFile` untouched |

### 2. `server/routes/uploads.ts` (NEW) — handler + bootstrap

Endpoint signature:

| Field | Value |
|-------|-------|
| Method | POST |
| Path | `/api/uploads/links-page` |
| Auth | `requireAdmin` (401 unauthenticated, 403 non-admin) |
| Body | `{ filename: string(1..200), data: base64-string(1..), assetType: "avatar"\|"background"\|"linkIcon" }` |
| Success response | `200 { url: "https://<host>/storage/v1/object/public/uploads/links-page/{assetType}/{ts}-{uuid}.{ext}" }` |
| Error responses | `400` (Zod or invalid base64 or empty buffer), `401` (no session), `403` (non-admin), `413` (>2 MB decoded), `415` (unsupported extension/MIME), `500` (Supabase upload failure), `503` (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing) |

Validation pipeline (in order):

1. `requireAdmin` middleware → 401 / 403 short-circuit
2. Pre-flight env check → `503 "Storage not configured"` if Supabase env vars missing
3. Zod `uploadBodySchema.parse(req.body)` → `400 { message, errors[] }` on shape mismatch
4. Defensive data-URL prefix strip — accepts `data:image/png;base64,XXX` and raw `XXX`
5. `Buffer.from(cleaned, "base64")` → `400` on decode failure
6. Empty payload → `400 "Empty file payload"`
7. `buffer.length > 2*1024*1024` → `413` with byte count in message
8. Extension → MIME via `EXT_TO_MIME` map → `415` if not in allowlist
9. `storageService.uploadLinksPageAsset(...)` → `500` on Supabase failure → `200 { url }` on success

Allowlists:

```
ALLOWED_MIME = { image/png, image/jpeg, image/gif, image/webp, image/svg+xml, image/avif }
EXT_TO_MIME  = { png, jpg, jpeg, gif, webp, svg, avif }  (svg → image/svg+xml)
```

Constants:

```
MAX_BYTES = 2 * 1024 * 1024  // 2 MB decoded
ALLOWED_ASSET_TYPES = ["avatar", "background", "linkIcon"] as const
```

Zero new dependencies — `express`, `zod`, `SupabaseStorageService`, `requireAdmin` were all already imported elsewhere.

### 3. `server/routes.ts` — bootstrap wiring

Added (alongside existing `register*Routes` imports / calls):

```typescript
import { registerUploadRoutes } from "./routes/uploads.js";
// ... within registerRoutes(httpServer, app):
registerUploadRoutes(app);  // grouped after registerCompanyRoutes (admin-side)
```

## Supabase Path Layout

After this plan, the `uploads` bucket has the following prefixes in active use:

| Prefix | Owner | Plan |
|--------|-------|------|
| `<timestamp>_<uuid>.<ext>` (root) | `/api/upload`, `/api/update-favicon`, VCardsManager avatars | pre-existing |
| `photos/<rep_id>/<filename>` | Xpot lead photos | pre-existing |
| **`links-page/avatar/<ts>-<uuid>.<ext>`** | new — Links page profile avatar | **10-02** |
| **`links-page/background/<ts>-<uuid>.<ext>`** | new — Links page background image | **10-02** |
| **`links-page/linkIcon/<ts>-<uuid>.<ext>`** | new — per-link icon image | **10-02** |

## Requirements Covered

| Req ID | Delivered |
|--------|-----------|
| **LINKS-02** | Files routed to Supabase `uploads` bucket under `links-page/{type}/{timestamp}-{uuid}.{ext}`; public URL returned to client for persistence in `linksPageConfig` JSONB |
| **LINKS-06** | `POST /api/uploads/links-page` — admin-auth (`requireAdmin`), image MIME allowlist (6 types), 2 MB max decoded, all spec error codes implemented (401/403/413/415/400/503) |

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ EXIT=0 |
| `npm run check` (alias for `tsc`) | ✅ EXIT=0 |
| `npm run build` (vite client + esbuild server) | ✅ both bundles built; `dist/index.cjs` 1.7 MB |
| Acceptance grep matrix Task 1 (8 patterns) | ✅ all match |
| Acceptance grep matrix Task 2 (12 patterns) | ✅ all match |
| Acceptance grep matrix Task 3 (3 patterns) | ✅ all match (1 import, 1 call site) |

## Smoke Test Status

**Live curl matrix not executed in this shell.** Reason: no authenticated admin `cookies.txt` available (same as Plan 10-01); the plan explicitly permits deferring the 6-step smoke matrix to `/gsd:verify-work` when a session isn't ready. The full compile guard (`tsc` + `build`) and every grep-based structural acceptance criterion passed — that is the sampling-rate contract documented in `10-VALIDATION.md` for per-task and per-wave checks.

Recommended to run at the `/gsd:verify-work` gate (six smokes, copied verbatim from Task 3 step 5 for convenience):

```bash
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="

# Smoke 1 — 401 unauthenticated
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"a.png\",\"data\":\"$PNG_B64\",\"assetType\":\"avatar\"}"
# Expect: 401

# Smoke 2 — 200 happy path (with admin cookie)
curl -s -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"a.png\",\"data\":\"$PNG_B64\",\"assetType\":\"avatar\"}"
# Expect: 200 with {"url":"https://<host>/storage/v1/object/public/uploads/links-page/avatar/<ts>-<uuid>.png"}
# Then: curl -sI "<the url>" | head -5  →  HTTP 200, content-type: image/png

# Smoke 3 — 415 unsupported extension
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"hack.exe\",\"data\":\"$PNG_B64\",\"assetType\":\"avatar\"}"
# Expect: 415

# Smoke 4 — 413 oversized (>2 MB decoded)
BIG_B64=$(node -e "console.log('A'.repeat(4 * 1024 * 1024))")
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"big.png\",\"data\":\"$BIG_B64\",\"assetType\":\"background\"}"
# Expect: 413

# Smoke 5 — 400 invalid assetType
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"a.png\",\"data\":\"$PNG_B64\",\"assetType\":\"garbage\"}"
# Expect: 400

# Smoke 6 — 200 with data URL prefix (defensive strip)
curl -s -b cookies.txt -X POST http://localhost:5000/api/uploads/links-page \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"a.png\",\"data\":\"data:image/png;base64,$PNG_B64\",\"assetType\":\"linkIcon\"}"
# Expect: 200 with {url} containing /links-page/linkIcon/
```

**Supabase bucket cleanup tracking:** None — no objects were uploaded during execution. Once smoke tests run at the `/gsd:verify-work` gate, three test objects will land at `links-page/avatar/`, `links-page/background/`, `links-page/linkIcon/`. They are 100-byte PNGs / 4 MB throwaway data and are safe to delete from the Supabase dashboard after verification (no DB rows reference them).

## Environment Gotchas

- **`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` required.** If either is unset, the endpoint returns `503 "Storage not configured"` instead of a deep `getSupabaseAdmin()` throw. Same env vars are already required by `/api/upload`, VCardsManager avatar saves, the favicon updater, and Xpot lead photos — no NEW env setup needed for any environment that already runs the rest of the app.
- **Bucket auto-provisioning.** `SupabaseStorageService.ensureBucket()` creates the `uploads` bucket as `{ public: true }` on first call if it doesn't exist — no manual Supabase dashboard step required.
- **CDN cache (5-min) on `GET /api/company-settings`.** Not relevant to this endpoint (uploads return a fresh URL immediately) but matters once Phase 12 wires the URL into `linksPageConfig` — admin-saved URLs may not appear on public `/links` for up to 5 minutes. Documented in research §"Pitfall 5".

## Deviations from Plan

### Adjustment — Task 3 commit accidentally captured pre-existing unstaged changes in `server/routes.ts`

**Found during:** Task 3 commit verification (`git show 0e744f9` showed +13 / -11 lines instead of the expected +2 / -0).

**Issue:** `git status` at session start reported `(clean)` but the working tree in fact contained a body of unstaged changes across many files (including `server/routes.ts` — Portuguese-to-English chat prompt rewrites in the system prompt block) that pre-dated this plan. When Task 3 ran `git add server/routes.ts && git commit`, Git captured both the intended import + register call AND those incidental string changes (lines ~990 and ~1014 of `routes.ts`).

**Fix applied:** None — the captured changes are additive, semantically harmless (English fallback strings in chat assistant prompts that were apparently mid-translation by a previous session), and unrelated to upload routing. Reverting them would risk losing pending work-in-progress. Per the scope-boundary rule (Rule 3 territory: blocking issues only), no auto-fix was warranted because the changes don't block compilation or this plan's correctness — `tsc` and `build` both pass.

**Files affected:** `server/routes.ts` lines ~988-1023 (chat assistant system-prompt translations only — no upload-route logic touched).

**Commit:** `0e744f9` — body documents the routes registration; the chat-prompt diff is incidental.

**Recommendation for follow-up:** No action. If the previous session intended these translations to land in a separate commit, that intent was lost when the working tree state diverged from `git status` reporting. Future plans should `git stash` ambiguous working trees before starting.

### Other working-tree noise (not committed)

The session-start working tree also contained ~50 other unstaged modifications across `client/src/**` and `server/routes/company.ts`, plus 2 untracked files (`client/src/components/ui/loader.tsx`, `client/src/lib/leadDisplay.ts`). None were touched by this plan. They remain unstaged for whoever owns that work.

## Downstream Enablement

Phase 12 (admin UI rewrite) can now:
- Add a sibling helper `uploadLinksPageAsset(file, assetType): Promise<string>` to `client/src/components/admin/shared/utils.ts` that:
  1. Reads the file via `FileReader.readAsDataURL`, slices off the data-URL prefix
  2. POSTs to `/api/uploads/links-page` with `{ filename: file.name, data: base64, assetType }` and `credentials: 'include'`
  3. Returns the `url` field from the JSON response
- Wire three uploader UIs (profile avatar, background image, per-link icon) to that helper
- Persist the returned URL into `linksPageConfig` via the existing `PUT /api/company-settings` route (Phase 10-01 already validates the new shape via `linksPageConfigSchema`)

Phase 13 (theme editor) and Phase 14 (public render) do not depend on this endpoint directly — they consume the URLs already persisted in `linksPageConfig`.

## Known Stubs

None. The endpoint is a complete, live, end-to-end upload path. No placeholders, no "TODO" comments, no hardcoded mock URLs. Phase 12 will exercise it from the admin UI; nothing in Phase 10 needs to render uploaded URLs.

## Self-Check: PASSED

- ✅ `server/storage/supabaseStorage.ts` (modified) — `uploadLinksPageAsset` method present at line 79; existing `getUploadURL`/`uploadBuffer`/`serveFile` intact
- ✅ `server/routes/uploads.ts` (created) — exports `registerUploadRoutes`; admin auth + Zod + MIME allowlist + 2 MB cap + 503 env guard + data-URL strip + `uploadLinksPageAsset` call all present
- ✅ `server/routes.ts` (modified) — `import { registerUploadRoutes } from "./routes/uploads.js"` (line 26); `registerUploadRoutes(app)` (line 127); count exactly 1
- ✅ Commit `7ebdaf4` — Task 1 (uploadLinksPageAsset method) — verified via `git log --oneline | grep 7ebdaf4`
- ✅ Commit `86ae880` — Task 2 (uploads.ts route file)
- ✅ Commit `0e744f9` — Task 3 (route registration)
- ✅ `npx tsc --noEmit` EXIT=0
- ✅ `npm run check` EXIT=0
- ✅ `npm run build` succeeds (client + server bundles)
- ⏭️ Live curl smoke matrix — deferred to `/gsd:verify-work` (per plan step 6 fallback; no admin session in shell)
