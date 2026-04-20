# Phase 8: Admin UI (EstimatesSection) - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an "Estimates" tab to the admin dashboard sidebar. The tab contains a list view (client name, slug, creation date, copy-link button) and a create/edit dialog. The dialog lets the admin compose service line items from the portfolio catalog via an inline checklist, add freeform custom rows, edit all fields inline, and drag-reorder rows. Delete from the list with confirmation. No new DB columns — all backed by Phase 7 API endpoints.

Endpoints consumed:
- `GET /api/estimates` — list
- `POST /api/estimates` — create
- `PUT /api/estimates/:id` — update
- `DELETE /api/estimates/:id` — delete
- `GET /api/portfolio-services` — catalog source for the picker checklist

</domain>

<decisions>
## Implementation Decisions

### Service Picker UX
- **D-01:** The dialog uses an **inline checklist** — a scrollable list of portfolio catalog services, each with a checkbox. Checking an item adds it to the services list with fields pre-filled from the catalog snapshot (title, description, price, features).
- **D-02:** Checked catalog rows are **inline editable** — each added service row shows editable inputs for title, description, and price so admin can customize before saving. This satisfies EST-07 ("pre-filled and editable before saving").
- **D-03:** When reopening an existing estimate for editing, the dialog shows **only the current estimate's service rows** as editable items (not the full catalog checklist). The checklist is used for adding NEW services; existing ones are managed via their own rows (edit inline, remove button, drag handle).

### Dialog Structure
- **D-04:** The dialog is a **single scrollable form**: client name + optional note at the top, then the service rows section (existing rows + "Add from catalog" / "Add custom row" controls), then Save. No multi-step wizard or tabs — follows the simple Dialog pattern used in PortfolioSection.

### Features Field
- **D-05:** Features array is **not editable** in the Phase 8 dialog — catalog items carry their snapshot features, custom rows start with an empty features array. Features editing is deferred (Phase 8 scope is title/description/price per EST-07/EST-08).

### Custom Rows
- **D-06:** "Add custom row" appends a blank editable row (`type: "custom"`) with empty title, description, and price inputs. Same editable row UI as catalog rows minus the pre-fill.

### Drag-Reorder
- **D-07:** dnd-kit drag-reorder is applied to the **service rows inside the dialog** — each row has a GripVertical drag handle. On save, the `order` field on each service item reflects the visual position. Follows the exact pattern from `PortfolioSection.tsx` (MouseSensor + TouchSensor, `arrayMove`, `verticalListSortingStrategy`).

### List View
- **D-08:** Estimates list shows: client name, slug (truncated), creation date, **copy-link button** (copies full URL — `window.location.origin + '/e/' + slug`), and an edit + delete action. No inline editing in the list.

### Delete
- **D-09:** Delete uses an AlertDialog confirmation before calling DELETE endpoint — same pattern as FormsSection.

### Sidebar Integration
- **D-10:** Add `'estimates'` to the `AdminSection` union in `client/src/components/admin/shared/types.ts`.
- **D-11:** Add an entry to `SIDEBAR_MENU_ITEMS` in `client/src/components/admin/shared/constants.ts` — use `FileText` or `Receipt` icon, label "Estimates".
- **D-12:** Add `estimates` to the slug maps and `{activeSection === 'estimates' && <EstimatesSection />}` in `client/src/pages/Admin.tsx`.
- **D-13:** Add `'estimates'` to the `sectionsWithOwnHeader` array in Admin.tsx so the generic header is suppressed (EstimatesSection renders its own SectionHeader).

### File Location
- **D-14:** New file `client/src/components/admin/EstimatesSection.tsx` — follows the flat naming pattern of PortfolioSection.tsx and other top-level admin sections.

### Claude's Discretion
- Exact icon for the sidebar entry
- Copy-link toast wording
- Empty state text when no estimates exist
- Whether to show a `Badge` for custom vs catalog service type in the dialog rows
- Error toast wording for failed mutations
- Loading skeleton vs spinner while list fetches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pattern Sources
- `client/src/components/admin/PortfolioSection.tsx` — closest analog for CRUD + dnd-kit drag-reorder pattern inside a dialog; read for dnd-kit sensor setup, arrayMove, row component structure
- `client/src/components/admin/forms/FormsSection.tsx` — CRUD list with AlertDialog delete confirmation; read for list row structure and mutation patterns
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS definition; must be updated
- `client/src/components/admin/shared/types.ts` — AdminSection union type; must be updated
- `client/src/pages/Admin.tsx` — section rendering switch and slug maps; must be updated

### Schema & API
- `shared/schema/estimates.ts` — Estimate, InsertEstimate, EstimateServiceItem, catalogServiceItemSchema, customServiceItemSchema types
- `shared/schema.ts` — barrel; import via `#shared/schema.js`
- `server/routes/estimates.ts` — Phase 7 output; the 5 endpoints this UI consumes

### Requirements
- `.planning/REQUIREMENTS.md` — EST-06, EST-07, EST-08, EST-09, EST-10

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) — already installed; reuse MouseSensor + TouchSensor + arrayMove + verticalListSortingStrategy from PortfolioSection
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogClose` — from `@/components/ui/dialog`
- `AlertDialog` family — from `@/components/ui/alert-dialog`; used for delete confirmation
- `Input`, `Label`, `Textarea`, `Button`, `Badge` — all available in `@/components/ui/`
- `GripVertical`, `Pencil`, `Trash2`, `Plus`, `Copy`, `Loader2` — lucide-react icons
- `useToast` — from `@/hooks/use-toast`
- `apiRequest`, `queryClient` — from `@/lib/queryClient`
- `useMutation`, `useQuery` — from `@tanstack/react-query`
- `EmptyState`, `SectionHeader` — from `./shared`

### Established Patterns
- Mutations: `useMutation` with `onSuccess` calling `queryClient.invalidateQueries` + toast, `onError` calling error toast
- List fetching: `useQuery` with query key `['/api/estimates']`
- Create/edit: single `isDialogOpen` state + `editingEstimate` state (null = create, object = edit)
- Delete confirmation: `deleteTarget` state + AlertDialog controlled open
- Copy button: `navigator.clipboard.writeText()` + toast

### Integration Points
- `client/src/components/admin/shared/types.ts` — add `'estimates'` to AdminSection
- `client/src/components/admin/shared/constants.ts` — add sidebar menu item
- `client/src/pages/Admin.tsx` — add to slug maps, sectionsWithOwnHeader array, and render switch

</code_context>

<specifics>
## Specific Ideas

- Copy-link copies full URL: `window.location.origin + '/e/' + slug`
- On create/edit dialog open for a new estimate: checklist shows all portfolio-services for picking; on edit: service rows are shown directly without the full catalog checklist (checklist appears in an "Add service" expansion)
- Drag-reorder only inside the dialog (EST-09: "order is preserved on save") — not in the list view

</specifics>

<deferred>
## Deferred Ideas

- Features array editing in the dialog — deferred past Phase 8 (title/description/price is sufficient per EST-07/EST-08)
- Estimate status tracking / expiry — out of scope per PROJECT.md
- Estimate templates — out of scope per PROJECT.md

</deferred>

---

*Phase: 08-admin-ui-estimatessection*
*Context gathered: 2026-04-19*
