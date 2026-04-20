---
phase: 12-admin-redesign-core-editing
plan: 02
subsystem: ui-uploads
tags: [react, admin, links-page, upload, base64, supabase, file-reader, drag-drop, i18n]

# Dependency graph
requires:
  - phase: 10-schema-upload-foundation
    provides: POST /api/uploads/links-page endpoint (admin-auth, base64 JSON body, returns {url}); LinksPageConfig shape with avatarUrl + theme.backgroundImageUrl
  - phase: 12-admin-redesign-core-editing
    plan: 01
    provides: Three-zone layout with Profile card containing avatar + background text inputs marked TODO(12-02)
provides:
  - Reusable DragDropUploader component (assetType: avatar | background | linkIcon) exported from ./admin/shared
  - Drag-drop + click-to-browse image upload flow wired into Profile zone of LinksSection (Avatar + Background)
  - Client-side MIME allowlist + 2 MB cap (pre-wire rejection) with toast + inline error state
  - idle / uploading / success / error state machine with 2-second "Uploaded ✓" confirmation
  - 13 new PT translation keys for uploader states and field labels
affects:
  - Plan 12-03 (drag-reorder) — same file; merged cleanly, each plan owned distinct blocks
  - Plan 13 (per-link icon picker) — can reuse DragDropUploader with assetType='linkIcon'

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — FileReader + fetch + existing Loader2/Label/useToast/cn
  patterns:
    - Base64 JSON upload with defensive data-URL prefix strip (matches server's defensive strip in Phase 10-02)
    - `credentials: 'include'` for admin-authenticated uploads (cookie-based session)
    - Drop-zone uses border-dashed + border-border (hairline alpha token) per CLAUDE.md border rule
    - State-driven border colors: neutral (idle) → primary (drag-over) → green-500 (success) → destructive (error)
    - Square (64x64) vs wide (120x64) thumbnail variants for avatar vs background aspect
    - Keyboard-accessible: role=button, tabIndex=0, Enter/Space triggers file picker

key-files:
  created:
    - client/src/components/admin/shared/DragDropUploader.tsx
  modified:
    - client/src/components/admin/shared/index.ts
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "Component lives in admin/shared/ (not co-located in LinksSection) — Plan 13 will reuse it for per-link icon uploads via assetType='linkIcon', which Phase 10-02 already supports server-side"
  - "MIME check uses File.type (browser-inferred) rather than filename extension — browsers already do this reliably for the 6 allowed types; server does its own extension check as defense-in-depth"
  - "2 MB check is on file.size (pre-FileReader) not on base64 wire size — saves a FileReader round-trip and matches server's decoded-bytes cap; no need for the 2.5 MB safety margin the plan's interface contract mentions (that's only relevant if we sent wire bytes, which we don't)"
  - "success state auto-reverts to idle after 2s via setTimeout — matches standard upload UX (Google Drive, Dropbox); no explicit 'clear' action needed"
  - "onChange triggers both setConfig and saveSettings in LinksSection — writes to queryClient + DB in one shot, same pattern as every other Profile field, so thumbnail updates instantly AND persists to /api/company-settings in one user action"
  - "Kept all Plan 12-03 dnd-kit imports and SortableContext body untouched — surgical scope per coordination note; only Profile zone inputs swapped"
  - "Proactively added PT translations for all 13 uploader strings even though DragDropUploader renders hardcoded English — same stance as Plan 12-01: later t() wrap is a no-op on the translation side"

patterns-established:
  - "Admin image uploader contract: DragDropUploader<avatar|background|linkIcon> + onChange(url) — any future admin surface uploading to /api/uploads/links-page reuses this, not a bespoke component"
  - "Client-side validation mirrors server contract (6 MIMEs + 2 MB) — keeps error UX instant; server remains the authoritative gate (defense-in-depth)"
  - "Profile-zone persistence: onChange → { setConfig(...); saveSettings(...) } — two calls instead of updateConfig helper because we need the post-URL config synchronously for the save call, and the helper only accepts Partial<LinksPageConfig> which doesn't compose with theme-nesting"

requirements-completed:
  - LINKS-08

# Metrics
duration: ~15min
completed: 2026-04-19
---

# Phase 12 Plan 02: DragDropUploader + Profile Zone Wiring Summary

**Reusable drag-drop image uploader component (DragDropUploader) wired into the Profile zone Avatar and Background Image slots, replacing text inputs with a base64-JSON POST to `/api/uploads/links-page` (admin-auth cookie, 6-MIME allowlist, 2 MB cap), showing idle/uploading/success/error states and persisting URLs through the existing saveSettings path.**

## Performance

- **Duration:** ~15 min (including coordinated merge with Plan 12-03 running in parallel on the same file)
- **Started:** 2026-04-19
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- Created `client/src/components/admin/shared/DragDropUploader.tsx` (207 lines) — a reusable drag-drop image uploader with typed props `{ value?, assetType: 'avatar'|'background'|'linkIcon', onChange, label, helperText?, thumbnailShape?: 'square'|'wide', className? }`
- Implemented idle / uploading / success / error state machine with 2-second auto-revert from `success` → `idle` and on-screen inline error + destructive toast for reject cases
- Client-side validation: MIME allowlist (`image/png|jpeg|gif|webp|svg+xml|avif`) + 2 MB cap enforced before FileReader runs (saves a wire round-trip for bad files)
- Upload flow: `FileReader.readAsDataURL(file)` → strip `data:*;base64,` prefix → POST JSON `{filename, data, assetType}` with `credentials: 'include'` → parse `{url}` → call `onChange(url)`
- Drag-drop handlers: `onDragEnter/Over` highlight border with primary color; `onDrop` calls the same handler as the hidden `<input type=file>` click-to-browse path
- Keyboard accessibility: `role="button"`, `tabIndex={0}`, `Enter`/`Space` opens the file picker; wrapped in a proper `<Label>`
- Exported from `./admin/shared/index.ts` barrel (both value and type)
- Wired two instances in LinksSection Profile zone: Avatar (`square` thumbnail, 64×64) and Background Image (`wide` thumbnail, 120×64) — both removed the preceding text `Input` and the `TODO(12-02)` comment markers
- Both uploaders persist via the existing `saveSettings` helper — Avatar writes to `config.avatarUrl`, Background writes to `config.theme.backgroundImageUrl` (merged with existing theme)
- Added 13 PT translation keys under a new `// Admin — Links Page Uploaders (Phase 12-02)` block in `client/src/lib/translations.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DragDropUploader component + barrel export** — `f231b57` (feat)
2. **Task 2: Wire Avatar + Background uploaders into LinksSection + PT translations** — `02ed2e9` (feat)

## Files Created/Modified

- **CREATED** `client/src/components/admin/shared/DragDropUploader.tsx` — 207 lines; default export region: `DragDropUploaderProps` interface (7 props), internal `UploaderState` union type, `ALLOWED_MIME` + `MAX_BYTES` constants, `handleFile(file)` async function (validate → FileReader → POST → onChange → state transition), render block with thumbnail + state messaging + hidden file input
- **MODIFIED** `client/src/components/admin/shared/index.ts` — appended 2 lines (`export { DragDropUploader }` + `export type { DragDropUploaderProps }`); existing exports (`AdminCard`, `SectionHeader`, `EmptyState`, `FormGrid`, util helpers) untouched
- **MODIFIED** `client/src/components/admin/LinksSection.tsx` — merged `DragDropUploader` into the existing `./shared` import line; replaced two `<Input>` blocks (Avatar URL + Background Image URL) with `<DragDropUploader>` instances; removed both `TODO(12-02)` comments; no changes to Main Links / SortableContext / dnd-kit block (owned by Plan 12-03, which landed in parallel)
- **MODIFIED** `client/src/lib/translations.ts` — appended 13 PT keys under new `// Admin — Links Page Uploaders (Phase 12-02)` comment block, directly after Plan 12-03's `'Drag to reorder'` key; no existing translations changed

## Decisions Made

- **DragDropUploader lives in `admin/shared/` (not co-located)** — Plan 13 per-link icon picker will instantiate the same component with `assetType="linkIcon"`; Phase 10-02 already allocated the `links-page/linkIcon/` Supabase path for exactly this. Extracting now avoids a Plan-13-time refactor.
- **MIME check uses `file.type` (browser-inferred) not filename extension** — browsers derive this reliably for the 6 allowed image types; server still verifies via extension-to-MIME map as defense-in-depth per Phase 10-02.
- **2 MB cap applied to `file.size` (pre-FileReader) not to wire base64 bytes** — matches the server's decoded-byte semantics and saves a FileReader round-trip on rejections. The 2.5 MB "wire bytes" note in the plan's interfaces applies only to clients that send raw base64 over the size limit; we validate the raw file first, so we can't exceed the cap on the wire.
- **`success` state auto-reverts to `idle` after 2 s via `setTimeout`** — standard upload UX (Google Drive, Dropbox); no explicit "clear" button needed. Thumbnail remains visible because `value` flows from parent state that already got the new URL.
- **`onChange` callback in LinksSection uses explicit `setConfig` + `saveSettings` (not `updateConfig` helper)** — the helper only accepts `Partial<LinksPageConfig>`, which doesn't compose cleanly with the nested `theme.backgroundImageUrl` update; two-call form is 3 lines and keeps the post-URL config synchronous for the save.
- **Added PT translations proactively even though DragDropUploader renders hardcoded English** — consistent with Plan 12-01's stance; future `t()` wrap-up is zero-touch on the translation side.
- **Stayed strictly inside the coordination scope** — did NOT touch any dnd-kit imports, `SortableLinkRow` component (introduced by Plan 12-03 mid-execution), or the Main Links `SortableContext` body. Clean merge with zero conflicts.

## Deviations from Plan

None — plan executed exactly as written. One coordination surprise: when the first `tsc` ran at end of Task 1, LinksSection.tsx contained a broken `import { useLanguage } from '@/context/LanguageContext'` (Plan 12-03's in-flight edit). Within seconds that file was corrected upstream to `import { useTranslation } from '@/hooks/useTranslation'` and the subsequent `tsc` passed `EXIT=0`. No action was taken on my side — the error was in a scope I was explicitly told not to touch, and it self-resolved from the parallel plan's completion.

## Issues Encountered

- **Pre-existing working-tree noise** — as noted in Plan 10-02's summary, session start already had ~50 unstaged modifications across `client/src/**` and `server/routes/company.ts` plus untracked `client/src/components/ui/loader.tsx` and `client/src/lib/leadDisplay.ts`. None were touched by this plan; they remain as pre-existing noise for whoever owns them. My atomic commits `f231b57` and `02ed2e9` captured ONLY the files this plan owns (via explicit `git add` by path).
- **Stale context snapshot** — the `<files_to_read>` context loaded the pre-12-03 version of LinksSection.tsx (no dnd-kit). Resolved by re-reading the file mid-execution to pick up the live state, then making surgical edits against the current block structure. No edits were lost.

## User Setup Required

None — no new environment variables, no new Supabase bucket, no new database migration. The endpoint (`POST /api/uploads/links-page`) was shipped in Phase 10-02 and uses the already-provisioned `uploads` bucket.

## Server Error Paths Exercised

**Live smoke tests not run in this shell** — no admin `cookies.txt` session available (same context as Plan 10-02). Compile + structural validation are green:

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ EXIT=0 |
| `npm run build` (vite client + esbuild server) | ✅ both bundles built (`dist/index.cjs` 1.7 MB) |
| `<DragDropUploader` count in LinksSection.tsx | ✅ 2 (avatar + background) |
| `assetType="avatar"` count | ✅ 1 |
| `assetType="background"` count | ✅ 1 |
| `id="avatarUrl"` count (old text input) | ✅ 0 (removed) |
| `TODO(12-02)` count | ✅ 0 (both markers removed) |
| `theme?.backgroundImageUrl` count | ✅ 1 (uploader onChange merge) |
| PT: `'Drop image here or click to browse': 'Solte a imagem aqui ou clique para procurar'` | ✅ 1 |
| PT: `'Background Image': 'Imagem de Fundo'` | ✅ 1 |
| PT: `'Uploaded ✓': 'Enviado ✓'` | ✅ 1 |

Live error-path verification should be run at `/gsd:verify-work`:

1. **Happy path (200)** — open Admin → Links Page → drop a PNG onto Avatar; expect spinner for <1 s, "Uploaded ✓" for 2 s, thumbnail updates. Network tab should show `POST /api/uploads/links-page` → `200 {url}` with URL containing `/links-page/avatar/`.
2. **Unsupported type (client 415-equivalent)** — drop a `.exe` file; expect immediate inline error "Unsupported file type" + destructive toast, no wire request.
3. **Oversized (client 413-equivalent)** — drop a 3 MB image; expect inline "File too large (max 2 MB)" + destructive toast, no wire request.
4. **401 unauthenticated** — in an incognito window without admin cookie, POST happy-path body manually; expect 401 + inline error with the server's message.
5. **413 server-side** — craft a 2.5 MB base64 payload that passes client checks (e.g. if user bypasses via DevTools); expect server 413 propagated to inline error.
6. **Persistence** — after success, reload `/admin`; thumbnail should still render from `linksPageConfig.avatarUrl` (written via `PUT /api/company-settings` in the `onChange` callback).

## Supabase Storage Paths Written During Smoke Test

**None yet.** When `/gsd:verify-work` runs the live smokes above, up to two test objects will land at `links-page/avatar/<ts>-<uuid>.png` and `links-page/background/<ts>-<uuid>.webp`. They are safe to delete from the Supabase dashboard after verification (no DB rows reference them until the admin saves a real avatar/background).

## Downstream Enablement

**Plan 12-03 (drag-reorder):**
- Ran in parallel; we merged cleanly with zero conflicts. The file now contains BOTH sets of changes (DragDropUploader in Profile zone, SortableContext in Main Links zone).

**Plan 13 (icon picker + live preview):**
- `DragDropUploader` is ready to accept `assetType="linkIcon"` — server-side path `links-page/linkIcon/{ts}-{uuid}.{ext}` is already provisioned.
- Integration pattern: add an `iconUrl` slot to each link row; wire a `<DragDropUploader assetType="linkIcon" value={link.iconUrl} onChange={(url) => updateLink(index, { iconUrl: url })} label="Icon" thumbnailShape="square" className="w-16" />` inside the SortableLinkRow component (Plan 12-03 owns that file block).
- Live preview zone (currently placeholder in Profile zone-2) will read `config.avatarUrl` and `config.theme.backgroundImageUrl` directly from the same `config` state — no additional wiring needed once uploaders persist.

**Plan 14 (public render):**
- Public `/links` page renders from `linksPageConfig` JSONB — no new endpoint to call, no changes to consuming code. Once admin uploads a new avatar, public page updates after the 5-minute CDN cache (noted in Phase 10-02 environment gotchas).

## Known Stubs

None. DragDropUploader is a complete end-to-end upload path:
- Real drag + drop handlers (not placeholder)
- Real FileReader + fetch call (not mock)
- Real `onChange` wiring to `saveSettings` → `PUT /api/company-settings` (not stubbed)
- Real thumbnail render from the persisted URL (not placeholder)

The only placeholder-adjacent element is the Live Preview zone (Profile zone-2), which is Plan 13's scope per Phase 12-01's summary — NOT a stub introduced by this plan.

---
*Phase: 12-admin-redesign-core-editing*
*Completed: 2026-04-19*

## Self-Check: PASSED

- ✅ `client/src/components/admin/shared/DragDropUploader.tsx` exists (207 lines, matches >120 min_lines requirement)
- ✅ `client/src/components/admin/shared/index.ts` exports `DragDropUploader` + `DragDropUploaderProps`
- ✅ `client/src/components/admin/LinksSection.tsx` contains 2 `<DragDropUploader` instances, 1 `assetType="avatar"`, 1 `assetType="background"`, 0 `id="avatarUrl"` text input, 0 `TODO(12-02)` markers
- ✅ `client/src/lib/translations.ts` contains all 13 new PT keys under `// Admin — Links Page Uploaders (Phase 12-02)` block
- ✅ Commit `f231b57` (feat(12-02): add DragDropUploader component) — verified via `git log --oneline`
- ✅ Commit `02ed2e9` (feat(12-02): wire DragDropUploader into Profile zone + PT translations) — verified
- ✅ `npx tsc --noEmit` EXIT=0
- ✅ `npm run build` succeeds (client + server bundles)
- ⏭️ Live upload smoke — deferred to `/gsd:verify-work` (no admin session in shell)
