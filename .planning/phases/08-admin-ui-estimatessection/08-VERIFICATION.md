---
phase: 08-admin-ui-estimatessection
verified: 2026-04-19T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
human_verification:
  - test: "Navigate to /admin/estimates and confirm Estimates tab visible in sidebar with Receipt icon"
    expected: "Sidebar shows Estimates entry after Xpot, with Receipt icon and label"
    why_human: "UI rendering and icon display cannot be verified programmatically"
  - test: "Click New Estimate — confirm dialog opens with catalog checklist visible by default"
    expected: "Dialog opens, catalog checklist (scrollable list of portfolio services with checkboxes) is visible without any extra click"
    why_human: "React state initialization and dialog open behavior require browser interaction"
  - test: "Check a catalog service item — confirm a pre-filled service row appears in the dialog"
    expected: "Service row appears with title, description, and price pre-populated from the catalog entry"
    why_human: "Checkbox → row append side-effect requires browser testing"
  - test: "Click Add custom row — confirm blank row appends"
    expected: "New row appears with empty title, description, price fields and 'custom' badge"
    why_human: "React state update behavior requires browser testing"
  - test: "Drag a service row by its GripVertical handle — confirm row reorders and order persists after Save"
    expected: "Row moves to new position; after saving and re-opening edit dialog, order matches what was dragged"
    why_human: "dnd-kit drag behavior, touch/mouse sensor activation, and persistence across save/reopen require human testing"
  - test: "Fill client name and save — confirm estimate appears in list with client name, slug, and date"
    expected: "List row shows client name in bold, truncated slug in font-mono, and formatted date (e.g. Apr 19, 2026)"
    why_human: "Full create mutation + list re-render flow requires running dev server with a real DB"
  - test: "Click Copy icon on a list row — confirm toast 'Link copied' appears"
    expected: "Toast with title 'Link copied' and description 'Share this link with your client.' appears"
    why_human: "navigator.clipboard requires browser security context; cannot test with grep"
  - test: "Click Edit (Pencil) on a list row — confirm dialog opens pre-populated with existing services, catalog checklist hidden"
    expected: "Dialog title is 'Edit Estimate', existing service rows are shown, catalog checklist is collapsed (not visible until 'Add from catalog' is clicked)"
    why_human: "Edit mode state initialization and dialog pre-population require browser testing"
  - test: "Click Delete (Trash2) — confirm AlertDialog appears; confirm deletion removes the row"
    expected: "AlertDialog with 'Delete estimate?' title appears; clicking Delete removes the estimate from the list and shows 'Estimate deleted' toast"
    why_human: "AlertDialog flow and DELETE mutation + invalidation require browser testing"
---

# Phase 08: Admin UI — EstimatesSection Verification Report

**Phase Goal:** The admin can create, edit, and delete estimates from within the admin dashboard, composing service line items from the portfolio catalog or as custom rows, with full drag-reorder and price override support
**Verified:** 2026-04-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Plan 08-01 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EstimatesSection.tsx exists and passes TypeScript strict-mode check | VERIFIED | File at 503 lines; `npm run check` exits 0 |
| 2 | List renders client name, slug (font-mono truncated), formatted creation date, copy-link button, edit button, and delete button per row | VERIFIED | Lines 418–454: `font-bold text-sm flex-1`, `font-mono truncate max-w-[160px]`, `format(new Date(est.createdAt!), 'MMM d, yyyy')`, three Buttons with Copy/Pencil/Trash2 icons |
| 3 | New Estimate button opens dialog in create mode — catalog checklist visible on open, service rows editable | VERIFIED | Line 131: `useState(!editingEstimate)` initializes `showCatalogPicker=true` in create mode; Lines 255–270 render the checklist conditionally |
| 4 | Edit button opens dialog pre-populated with that estimate's services (no catalog checklist shown initially) | VERIFIED | Lines 127–131: services initialized from `editingEstimate?.services ?? []`; `showCatalogPicker` initialized `false` when `editingEstimate` is set |
| 5 | Checking a catalog item appends a pre-filled CatalogServiceItem row; Add custom row appends a blank CustomServiceItem row | VERIFIED | Lines 144–177: `handleCatalogToggle` appends `type: 'catalog' as const` row; `handleAddCustomRow` appends `type: 'custom' as const` row |
| 6 | Service rows are draggable via GripVertical handle using verticalListSortingStrategy; new order preserved on Save | VERIFIED | Lines 272–293: DndContext + SortableContext with `verticalListSortingStrategy`; `handleDragEnd` uses `arrayMove`; `SortableServiceRow` uses `useSortable` with `CSS.Transform.toString` |
| 7 | Save calls POST (create) or PUT (update) with services mapped to set order = array index | VERIFIED | Lines 490–495: `services.map((s, i) => ({ ...s, order: i }))` before calling `createMutation.mutate` or `updateMutation.mutate` |
| 8 | Delete Trash2 button opens AlertDialog confirmation; confirming calls DELETE and invalidates the query | VERIFIED | Lines 461–481: AlertDialog with `deleteMutation.mutate(deleteTarget.id)`; line 362: `queryClient.invalidateQueries({ queryKey: ['/api/estimates'] })` on success |
| 9 | Copy-link button calls navigator.clipboard.writeText with full URL and shows success toast | VERIFIED | Lines 372–379: `navigator.clipboard.writeText(\`${window.location.origin}/e/${slug}\`)` with toast |
| 10 | All mutation states show Loader2 spinner on Save button when pending | VERIFIED | Lines 300–302: `{isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}` on submit button; line 497: `isPending={createMutation.isPending \|\| updateMutation.isPending}` |

**Score: 10/10 truths verified (Plan 08-01)**

### Observable Truths (Plan 08-02 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to /admin/estimates renders EstimatesSection | VERIFIED | Admin.tsx line 211: `{activeSection === 'estimates' && <EstimatesSection />}` |
| 2 | 'estimates' is a valid value for AdminSection type | VERIFIED | types.ts line 20: `\| 'estimates';` in union; `npm run check` exits 0 |
| 3 | Sidebar shows 'Estimates' menu item with Receipt icon after 'Xpot' entry | VERIFIED | constants.ts line 48: `{ id: 'estimates', title: 'Estimates', description: 'Client proposals with shareable links', icon: Receipt }` — last entry after fieldSales |
| 4 | Both slug maps in Admin.tsx handle estimates in READ and WRITE direction | VERIFIED | Admin.tsx lines 57 and 111: `estimates: 'estimates'` in both maps |

**Score: 4/4 truths verified (Plan 08-02)**

**Combined score: 14/14 must-haves verified**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/admin/EstimatesSection.tsx` | Full EstimatesSection component — list + dialog + dnd-kit + mutations | VERIFIED | 503 lines; exports `EstimatesSection`; contains all 3 co-located functions |
| `client/src/components/admin/shared/types.ts` | AdminSection union extended with 'estimates' | VERIFIED | Line 20 adds `\| 'estimates'` |
| `client/src/components/admin/shared/constants.ts` | SIDEBAR_MENU_ITEMS with Estimates entry and Receipt icon import | VERIFIED | Receipt in lucide-react import; estimates entry as last item |
| `client/src/pages/Admin.tsx` | Slug maps, sectionsWithOwnHeader, and render switch updated | VERIFIED | Import line 26, slug maps lines 57 + 111, sectionsWithOwnHeader line 186, render switch line 211 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| EstimatesSection list | /api/estimates | `useQuery queryKey ['/api/estimates']` | WIRED | Line 321 in EstimatesSection.tsx |
| catalog checklist | /api/portfolio-services | `useQuery queryKey ['/api/portfolio-services']` | WIRED | Line 134 in EstimatesSection.tsx |
| createMutation | POST /api/estimates | `apiRequest('POST', '/api/estimates', data)` | WIRED | Line 326 |
| updateMutation | PUT /api/estimates/:id | `apiRequest('PUT', \`/api/estimates/${data.id}\`, ...)` | WIRED | Line 341 |
| deleteMutation | DELETE /api/estimates/:id | `apiRequest('DELETE', \`/api/estimates/${id}\`)` | WIRED | Line 360 |
| Admin.tsx slug map (read) | AdminSection 'estimates' | `estimates: 'estimates'` in read map | WIRED | Admin.tsx line 57 |
| Admin.tsx render switch | EstimatesSection component | `activeSection === 'estimates' && <EstimatesSection />` | WIRED | Admin.tsx line 211 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| EstimatesSection (list) | `estimates` (useState default `[]`) | `GET /api/estimates` → `storage.listEstimates()` → Drizzle SELECT from `estimates` table | Yes — `storage.ts` line 1776: direct DB query | FLOWING |
| EstimateDialogForm (catalog picker) | `catalogServices` (useState default `[]`) | `GET /api/portfolio-services` → `storage.listPortfolioServices()` → Drizzle SELECT from `portfolioServices` table | Yes — `storage.ts` line 1745: DB query with order | FLOWING |
| Server POST/PUT mutation | `estimate` return value | `storage.createEstimate` / `storage.updateEstimate` | Yes — `storage.ts` lines 1790, 1795: Drizzle INSERT/UPDATE with real data | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for React component artifacts — all checks require a running dev server with browser rendering. Programmatic curl checks are not applicable for React state-driven UI. Human verification covers these behaviors.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EST-06 | 08-01, 08-02 | Admin sees an "Estimates" tab in the sidebar with a list showing client name, slug, creation date, and copy-link button | SATISFIED | Sidebar entry wired in constants.ts; list row renders all four fields; copy-link handler at line 372 |
| EST-07 | 08-01 | Admin can open a create/edit dialog, pick services from portfolio catalog with title/description/price pre-filled and editable | SATISFIED | `handleCatalogToggle` pre-fills from `PortfolioService` fields; all fields are `Input`/`Textarea` components that are editable |
| EST-08 | 08-01 | Admin can add freeform custom service rows (title, description, price entered manually) alongside catalog items | SATISFIED | `handleAddCustomRow` appends `type: 'custom'` row with empty fields; rows rendered in same `SortableServiceRow` as catalog items |
| EST-09 | 08-01 | Admin can drag service rows to reorder them; order is preserved on save and re-edit | SATISFIED (automated) | dnd-kit `verticalListSortingStrategy` + `arrayMove` in `handleDragEnd`; `services.map((s, i) => ({ ...s, order: i }))` before mutation; re-edit initializes from `editingEstimate.services` which includes saved order. Persistence through full save/reopen cycle needs human verification |
| EST-10 | 08-01 | Admin can delete any estimate from the list | SATISFIED | `deleteMutation` calls DELETE endpoint; AlertDialog gate prevents accidental deletion; query invalidation refreshes list |

No orphaned requirements found. REQUIREMENTS.md maps EST-06 through EST-10 to Phase 8 (lines 55–59) — all five are claimed by the plans and verified above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No anti-patterns found |

Scanned for: TODO/FIXME/XXX, placeholder implementations, `return null`/`return {}`/`return []`, hardcoded empty props. The word "placeholder" appears only as legitimate HTML `placeholder=` input attributes. All mutations and queries hit real endpoints. No stubs detected.

### Human Verification Required

All 14 automated must-haves are verified. The following behaviors require a running browser session to confirm end-to-end correctness:

#### 1. Sidebar Rendering and Navigation

**Test:** Start `npm run dev`, navigate to `/admin/estimates`
**Expected:** "Estimates" appears in the admin sidebar after "Xpot" with a Receipt icon; clicking it renders the EstimatesSection list view
**Why human:** CSS/icon rendering and Wouter routing behavior require a browser

#### 2. Create Flow with Catalog Picker

**Test:** Click "New Estimate" in the Estimates section
**Expected:** Dialog opens immediately showing the catalog checklist (scrollable list of portfolio services with checkboxes) without any extra click. Check one service → a service row with pre-filled title/description/price appears in the dialog body.
**Why human:** React `useState(!editingEstimate)` initialization and dialog open state require browser

#### 3. Add Custom Row

**Test:** Inside the create dialog, click "Add custom row"
**Expected:** A blank row with empty title/description/price inputs and a "custom" badge appends to the service list
**Why human:** React `handleAddCustomRow` state update requires browser

#### 4. Drag-Reorder Persistence

**Test:** In the dialog, add two or more service rows. Drag one by its GripVertical handle. Click "Create Estimate". Re-open the estimate via the Edit button.
**Expected:** The order from dragging is reflected in the saved estimate when re-opened
**Why human:** dnd-kit drag event behavior, order mapping at save time, and re-population from `editingEstimate.services` require end-to-end browser testing

#### 5. Copy-Link Toast

**Test:** After creating an estimate, click the Copy icon on the list row
**Expected:** Toast "Link copied" / "Share this link with your client." appears. The clipboard contains `{origin}/e/{slug}`
**Why human:** `navigator.clipboard` requires a browser security context

#### 6. Edit Mode — Catalog Picker Collapsed

**Test:** Click the Pencil/Edit icon on an existing estimate
**Expected:** Dialog title is "Edit Estimate", existing service rows are shown with pre-populated fields, and the catalog checklist is NOT visible by default (requires clicking "Add from catalog" to expand)
**Why human:** Edit-mode `showCatalogPicker=false` initialization and pre-populated form state require browser

#### 7. Delete with AlertDialog

**Test:** Click the Trash2/Delete icon on a list row
**Expected:** AlertDialog appears with "Delete estimate?" title and the client name in the description. Clicking "Delete" removes the row from the list and shows "Estimate deleted" toast.
**Why human:** AlertDialog controlled state, DELETE mutation, and list re-render require browser

### Gaps Summary

No gaps found. All 14 must-have truths are verified at all automated levels (exists, substantive, wired, data-flowing). The phase is complete pending human QA of the 7 browser-testable behaviors listed above — these are standard UI interaction checks that cannot be automated without a running dev server.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
