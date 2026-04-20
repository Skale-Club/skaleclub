# Phase 8: Admin UI (EstimatesSection) - Research

**Researched:** 2026-04-19
**Domain:** React admin UI — shadcn/ui + dnd-kit + TanStack Query CRUD section
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Inline checklist UX — scrollable list of portfolio catalog services with checkboxes; checking adds a pre-filled service row
- **D-02:** Checked catalog rows are inline editable (title, description, price) before saving
- **D-03:** Reopening an existing estimate shows only current service rows; "Add from catalog" button expands checklist inline for adding new services
- **D-04:** Single scrollable form dialog (client name + note at top, service rows + add controls, then Save) — no wizard or tabs
- **D-05:** Features array NOT editable in Phase 8 dialog — catalog items carry snapshot features, custom rows start with empty array
- **D-06:** "Add custom row" appends a blank editable row (type: "custom") with empty title, description, price
- **D-07:** dnd-kit on service rows inside dialog — GripVertical drag handle, order field reflects visual position on save; exact PortfolioSection pattern (MouseSensor + TouchSensor, arrayMove, verticalListSortingStrategy)
- **D-08:** List view shows client name, slug (truncated), creation date, copy-link button, edit + delete action — no inline editing in list
- **D-09:** Delete uses AlertDialog confirmation — same pattern as FormsSection
- **D-10:** Add 'estimates' to AdminSection union in `client/src/components/admin/shared/types.ts`
- **D-11:** Add entry to SIDEBAR_MENU_ITEMS in `client/src/components/admin/shared/constants.ts` — Receipt icon, label "Estimates"
- **D-12:** Add 'estimates' to slug maps and render switch in `client/src/pages/Admin.tsx`
- **D-13:** Add 'estimates' to sectionsWithOwnHeader array in Admin.tsx
- **D-14:** New file `client/src/components/admin/EstimatesSection.tsx`

### Claude's Discretion

- Exact icon for the sidebar entry (resolved in UI-SPEC: `Receipt`)
- Copy-link toast wording (resolved in UI-SPEC)
- Empty state text when no estimates exist (resolved in UI-SPEC)
- Whether to show a Badge for custom vs catalog service type in dialog rows (resolved in UI-SPEC: YES)
- Error toast wording for failed mutations (resolved in UI-SPEC)
- Loading skeleton vs spinner while list fetches (resolved in UI-SPEC: spinner)

### Deferred Ideas (OUT OF SCOPE)

- Features array editing in the dialog
- Estimate status tracking / expiry
- Estimate templates
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EST-06 | Admin sees an "Estimates" tab in the sidebar with a list showing client name, slug, creation date, and a copy-link button | Sidebar integration pattern fully documented in CONTEXT.md (D-10–D-13) and verified against types.ts, constants.ts, Admin.tsx |
| EST-07 | Admin can open a create/edit dialog, pick services from the portfolio catalog, with title/description/price pre-filled and editable before saving | Catalog checklist + inline editable row pattern defined in D-01/D-02; `GET /api/portfolio-services` already available; EstimateServiceItem Zod types verified in shared/schema/estimates.ts |
| EST-08 | Admin can add freeform custom service rows (title, description, price entered manually) | Custom row append pattern defined in D-06; `customServiceItemSchema` verified in shared/schema/estimates.ts |
| EST-09 | Admin can drag service rows to reorder them; order is preserved on save and re-edit | dnd-kit pattern fully studied from PortfolioSection.tsx; verticalListSortingStrategy for single-column rows; order field on EstimateServiceItem confirmed in schema |
| EST-10 | Admin can delete any estimate from the list | AlertDialog delete pattern studied from FormsSection.tsx; `DELETE /api/estimates/:id` verified in server/routes/estimates.ts |
</phase_requirements>

---

## Summary

Phase 8 is a pure frontend addition — no new API routes, no DB changes. The phase creates a single new file (`EstimatesSection.tsx`) and makes surgical edits to three existing files to wire the new section into the admin sidebar.

All technical patterns are already established in the codebase. The dnd-kit drag-reorder pattern is copied verbatim from `PortfolioSection.tsx` (MouseSensor + TouchSensor + arrayMove). The CRUD mutation pattern with invalidateQueries and toast follows both PortfolioSection and FormsSection. The AlertDialog delete pattern is copied from FormsSection. The sidebar wiring is a mechanical three-file update with well-defined insertion points.

The only non-trivial design challenge is the dual-mode dialog: create mode shows the full catalog checklist on open; edit mode hides it behind an "Add from catalog" expansion toggle. State management for this is straightforward — a `showCatalogPicker` boolean alongside the `services` array.

**Primary recommendation:** Implement EstimatesSection.tsx as a single file following the PortfolioSection structure. The UI-SPEC is fully resolved and can be used directly as the implementation blueprint.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag context, sensors, collision detection | Already installed; used in PortfolioSection |
| @dnd-kit/sortable | 10.0.0 | SortableContext, useSortable, arrayMove, verticalListSortingStrategy | Already installed |
| @dnd-kit/utilities | (bundled) | CSS.Transform.toString for sortable row styles | Already installed |
| @tanstack/react-query | 5.60.5 | useQuery + useMutation for API interaction | Project standard |
| shadcn/ui | new-york | Dialog, AlertDialog, Button, Input, Label, Textarea, Badge, Checkbox | Already installed |
| lucide-react | 0.453.0 | Receipt, Plus, Pencil, Trash2, Copy, GripVertical, Loader2 icons | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wouter | 3.3.5 | useLocation (if sub-route needed) | Not needed for Phase 8 — no sub-routes |
| date-fns | 3.6.0 | Format createdAt date in list rows | Use `format(new Date(createdAt), 'MMM d, yyyy')` |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended File Structure

```
client/src/components/admin/
├── EstimatesSection.tsx          # NEW — single file, all sub-components co-located
├── PortfolioSection.tsx          # Reference — dnd-kit pattern source
└── shared/
    ├── types.ts                  # EDIT — add 'estimates' to AdminSection union
    └── constants.ts              # EDIT — add Receipt import + SIDEBAR_MENU_ITEMS entry

client/src/pages/
└── Admin.tsx                     # EDIT — 3 insertion points
```

### Pattern 1: dnd-kit Vertical List Sortable (inside dialog)

**What:** Service rows inside the edit dialog are wrapped in DndContext + SortableContext using verticalListSortingStrategy. Each row uses useSortable. DragEnd calls arrayMove on the local services state.

**Critical distinction from PortfolioSection:** PortfolioSection uses `rectSortingStrategy` (grid layout). EstimatesSection uses `verticalListSortingStrategy` (single-column list). This is confirmed by UI-SPEC.

**When to use:** Any time items need to reorder inside a dialog before committing to the server. Order is embedded in the saved array (each item's `order` field = its index).

```typescript
// Source: PortfolioSection.tsx lines 26-29, adapted for vertical list
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
);

// DragEnd handler — update local state only, persist on Save
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = services.findIndex((_, i) => i === Number(active.id));
  const newIndex = services.findIndex((_, i) => i === Number(over.id));
  setServices(prev => arrayMove(prev, oldIndex, newIndex));
};

// Sortable row — use array index as ID (service items have no persistent DB id)
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={services.map((_, i) => i)} strategy={verticalListSortingStrategy}>
    {services.map((item, i) => (
      <SortableServiceRow key={i} id={i} item={item} onChange={...} onRemove={...} />
    ))}
  </SortableContext>
</DndContext>
```

**Important:** Service items don't have a stable DB id until saved. Use array index as the dnd-kit ID for in-dialog sorting. The `order` field is assigned at save time by mapping `services.map((item, i) => ({ ...item, order: i }))`.

### Pattern 2: Controlled Dialog with Dual-Mode State

**What:** Single `isDialogOpen` boolean + `editingEstimate` state (null = create, Estimate object = edit). Dialog state (clientName, note, services, showCatalogPicker) is initialized from editingEstimate when opening.

```typescript
// Source: PortfolioSection.tsx lines 22-25, adapted for estimates
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
const [deleteTarget, setDeleteTarget] = useState<Estimate | null>(null);

// Dialog internal state — reset on each open via key prop
const [clientName, setClientName] = useState(editingEstimate?.clientName ?? '');
const [note, setNote] = useState(editingEstimate?.note ?? '');
const [services, setServices] = useState<EstimateServiceItem[]>(
  editingEstimate?.services ?? []
);
const [showCatalogPicker, setShowCatalogPicker] = useState(false);
```

**Key pattern:** Pass `key={editingEstimate?.id ?? 'new'}` to the inner form component so React remounts it (resetting all state) on each open. This is the exact PortfolioSection approach (`key={editingService?.id ?? 'new'}`).

### Pattern 3: AlertDialog Delete with External State

**What:** deleteTarget state drives a controlled AlertDialog. Delete button in list row calls `setDeleteTarget(estimate)`. AlertDialog is rendered outside the list, controlled by `open={!!deleteTarget}`.

```typescript
// Source: FormsSection.tsx lines 285-305
{deleteTarget && (
  <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently remove the estimate for {deleteTarget.clientName}. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => deleteMutation.mutate(deleteTarget.id)}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

### Pattern 4: TanStack Query Mutation with Cache Invalidation

**What:** All mutations use `queryClient.invalidateQueries` on success (not optimistic setQueryData) to keep the list in sync with server state. This is simpler than optimistic updates and appropriate for admin UIs.

```typescript
// Source: FormsSection.tsx mutation pattern (lines 125-137)
const deleteMutation = useMutation({
  mutationFn: async (id: number) => {
    await apiRequest('DELETE', `/api/estimates/${id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
    toast({ title: 'Estimate deleted' });
    setDeleteTarget(null);
  },
  onError: (err: Error) => {
    toast({ title: 'Failed to delete estimate', description: err.message, variant: 'destructive' });
  },
});
```

### Pattern 5: Catalog Checklist Picker

**What:** The catalog picker renders portfolio-services as a scrollable Checkbox list. Checking an item snapshots the catalog row into a `CatalogServiceItem` and appends it to the local services state. Unchecking removes it. A service is "checked" if its `sourceId` is already in the services array.

```typescript
// Derive checked state from services array
const checkedSourceIds = new Set(
  services
    .filter((s): s is CatalogServiceItem => s.type === 'catalog')
    .map(s => s.sourceId)
);

const handleCatalogToggle = (catalogService: PortfolioService, checked: boolean) => {
  if (checked) {
    setServices(prev => [
      ...prev,
      {
        type: 'catalog',
        sourceId: catalogService.id,
        title: catalogService.title,
        description: catalogService.description ?? '',
        price: catalogService.price ?? '',
        features: catalogService.features ?? [],
        order: prev.length,
      }
    ]);
  } else {
    setServices(prev => prev.filter(
      s => !(s.type === 'catalog' && s.sourceId === catalogService.id)
    ));
  }
};
```

### Anti-Patterns to Avoid

- **Using rectSortingStrategy for the dialog list:** Portfolio uses a grid — estimates dialog uses a vertical list. Use `verticalListSortingStrategy` instead.
- **Sending order field to POST/PUT as a separate field:** The `order` field lives inside each service item in the JSONB array, not as a top-level estimate field. Set `order` by mapping services with their index before calling the mutation.
- **Auto-saving drag reorder via PUT:** Order is not persisted on drag — it is preserved in local state and committed on the Save button. No separate reorder endpoint exists.
- **Showing catalog checklist when reopening an edit:** Per D-03, edit mode starts with `showCatalogPicker = false`. The checklist expands only when admin clicks "Add from catalog".
- **Using DialogTrigger for the "New Estimate" button:** PortfolioSection uses DialogTrigger inside the Dialog wrapper on the SectionHeader action. Follow this exact pattern — don't manage dialog open state from outside the Dialog component mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-reorder | Custom mousedown/touchstart handlers | dnd-kit (already installed) | Accessibility, mobile touch, ghost overlays, collision detection all handled |
| Scroll-safe drag activation | None | MouseSensor `distance: 6` + TouchSensor `delay: 150` | Prevents accidental drags during scroll; exact values from PortfolioSection are battle-tested |
| Controlled dialog with reset | useEffect to reset state | `key` prop on inner form component | Forces React to remount = clean state; no stale field values on reopen |
| Copy to clipboard | document.execCommand | `navigator.clipboard.writeText()` | Modern async API; wrap in try/catch for fallback toast |
| Date formatting | Manual string ops | `date-fns format()` or `toLocaleDateString()` | i18n-aware, already installed |

---

## Common Pitfalls

### Pitfall 1: dnd-kit ID Type Mismatch
**What goes wrong:** dnd-kit returns `active.id` as `string | number` but array indices are `number`. Comparison fails silently — items don't reorder.
**Why it happens:** dnd-kit normalizes IDs to strings internally in some versions.
**How to avoid:** Use `Number(active.id)` and `Number(over.id)` when comparing to array indices. PortfolioSection does this explicitly on line 126: `s.id === Number(active.id)`.
**Warning signs:** Drag appears to work visually but array state doesn't update.

### Pitfall 2: Stale Dialog State on Reopen
**What goes wrong:** Admin edits an estimate, closes without saving, reopens the same estimate — old edited values persist.
**Why it happens:** React reuses the mounted component; useState doesn't reinitialize.
**How to avoid:** Pass `key={editingEstimate?.id ?? 'new'}` to the inner form/dialog content component. PortfolioSection uses this on line 171.

### Pitfall 3: Order Field Not Set Before Save
**What goes wrong:** Services are saved with `order: 0` on all items, or with the original pre-drag order.
**Why it happens:** The `order` field on EstimateServiceItem must be explicitly set to the item's index in the array at save time.
**How to avoid:** Before calling the mutation, map services: `services.map((s, i) => ({ ...s, order: i }))`.

### Pitfall 4: Catalog Checklist Shows Unavailable Services on Reopen
**What goes wrong:** In edit mode, the catalog checklist shows services that are already in the estimate as unchecked, making the admin think they can be added again.
**Why it happens:** The checked state derives from the live `services` state, not persisted data.
**How to avoid:** Derive `checkedSourceIds` from current local `services` state (not from `editingEstimate.services` directly). Since services state is initialized from editingEstimate on open, this is automatically correct.

### Pitfall 5: AdminSection Union Not Extended in Both Maps
**What goes wrong:** Adding 'estimates' to the AdminSection union but forgetting one of the two slug maps in Admin.tsx (the `useMemo` map for reading location, and the `handleSectionSelect` switch map).
**Why it happens:** Admin.tsx has two separate maps — one that converts URL segment → AdminSection (line 40–57) and one that converts AdminSection → URL segment (line 93–110).
**How to avoid:** Search Admin.tsx for both maps and update both. Also update `sectionsWithOwnHeader` array (line 183).

### Pitfall 6: Checkbox Component Not Imported
**What goes wrong:** `Checkbox` from `@/components/ui/checkbox` is not currently imported anywhere in admin sections — easy to forget.
**Why it happens:** It's a shadcn component that exists on disk but isn't used in canonical reference files.
**How to avoid:** Import explicitly: `import { Checkbox } from '@/components/ui/checkbox'`. File confirmed present at `client/src/components/ui/checkbox.tsx`.

---

## Code Examples

### Saving Service Order

```typescript
// Source: UI-SPEC state model + estimates schema (shared/schema/estimates.ts)
const handleSave = () => {
  const servicesWithOrder = services.map((s, i) => ({ ...s, order: i }));
  if (editingEstimate) {
    updateMutation.mutate({
      id: editingEstimate.id,
      data: { clientName, note: note || null, services: servicesWithOrder }
    });
  } else {
    createMutation.mutate({ clientName, note: note || null, services: servicesWithOrder });
  }
};
```

### SortableServiceRow Component Skeleton

```typescript
// Source: PortfolioSection.tsx SortableServiceCard pattern, adapted for vertical list
function SortableServiceRow({ id, item, onChange, onRemove }: {
  id: number;
  item: EstimateServiceItem;
  onChange: (updated: EstimateServiceItem) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="p-1 cursor-grab hover:bg-muted rounded touch-none mt-1 min-h-[44px] flex items-center">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <Badge variant={item.type === 'catalog' ? 'secondary' : 'outline'} className="mt-2 shrink-0">
        {item.type}
      </Badge>
      {/* Input fields for title, description, price */}
    </div>
  );
}
```

### Sidebar Integration Points

```typescript
// types.ts — add 'estimates' to union (after 'fieldSales')
export type AdminSection =
  | 'dashboard' | 'leads' | 'forms' | 'website' | 'company'
  | 'seo' | 'faqs' | 'users' | 'chat' | 'integrations'
  | 'blog' | 'portfolio' | 'links' | 'vcards' | 'fieldSales'
  | 'estimates';  // ADD

// constants.ts — add Receipt to import, add to SIDEBAR_MENU_ITEMS
import { ..., Receipt } from 'lucide-react';  // ADD Receipt
{ id: 'estimates', title: 'Estimates', description: 'Client proposals with shareable links', icon: Receipt }

// Admin.tsx slugMap (useMemo — READ direction):
estimates: 'estimates',  // ADD

// Admin.tsx slugMap (handleSectionSelect — WRITE direction):
estimates: 'estimates',  // ADD

// Admin.tsx sectionsWithOwnHeader array:
'estimates',  // ADD

// Admin.tsx render switch:
{activeSection === 'estimates' && <EstimatesSection />}  // ADD
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is a pure frontend code addition. No external tools, services, CLI utilities, or runtimes beyond the project's existing Node/npm stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — CLAUDE.md explicitly states "Manual QA only: No test framework available" |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type-check only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| EST-06 | Estimates tab appears in sidebar, list renders | manual | `npm run check` (type safety) | Manual: navigate to /admin/estimates |
| EST-07 | Dialog opens, catalog checklist shows, pre-fills fields | manual | `npm run check` | Manual: create estimate, verify pre-fill |
| EST-08 | Custom row appends with empty fields | manual | `npm run check` | Manual: "Add custom row" flow |
| EST-09 | Drag reorder works, order persists after save + reopen | manual | `npm run check` | Manual: drag, save, reopen |
| EST-10 | Delete shows confirmation, removes from list | manual | `npm run check` | Manual: delete flow |

### Sampling Rate

- **Per task commit:** `npm run check` — TypeScript compilation must pass
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green + manual QA of all 5 requirements before `/gsd:verify-work`

### Wave 0 Gaps

None — no test files to create. The project's validation strategy is manual QA + TypeScript type-checking per CLAUDE.md.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Detail |
|------------|--------|
| Surgical scope | Minimize changes — only EstimatesSection.tsx (new) + 3 file edits |
| API stability | All `/api/estimates/*` endpoint signatures must remain unchanged |
| No DB changes | Don't modify table schemas or create migrations |
| No feature changes | Behavior must be identical before/after (within spec) |
| Manual QA only | No test framework — verify critical flows manually |
| TypeScript strict | `"strict": true` — all new code must type-check cleanly |
| ESM modules | `"type": "module"` — use ESM import syntax |
| Import aliases | `@/` = `client/src/`, `@shared/` = `shared/` |
| shadcn style | new-york preset, neutral base, css-variables |
| No JSDoc | TypeScript types serve as documentation |
| 2-space indent | Consistent with codebase |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate reorder endpoint (PortfolioSection sends PUT /reorder) | In-dialog drag reorder saved inline with estimate body | EstimatesSection embeds order in JSONB array — no separate reorder call needed |

---

## Open Questions

1. **Catalog checklist in edit mode expansion**
   - What we know: D-03 says checklist appears via "Add from catalog" button expansion in edit mode; UI-SPEC confirms `showCatalogPicker` boolean
   - What's unclear: Whether the checklist should pre-check items already in the estimate (so re-checking won't duplicate) or always show all items unchecked
   - Recommendation: Pre-derive `checkedSourceIds` from current services state; in the checklist, show catalog items where sourceId is NOT already in services, or show all items and use checked state to prevent duplicates. The simpler path: show all catalog items, derive checked state from services — checking an already-present item is a no-op.

2. **PortfolioService type availability on client**
   - What we know: PortfolioSection imports `PortfolioService` from `@shared/schema`; the catalog picker in EstimatesSection needs the same type
   - What's unclear: Nothing — import path is identical: `import type { PortfolioService } from '@shared/schema'`
   - Recommendation: Import both `Estimate`, `EstimateServiceItem`, `CatalogServiceItem`, `CustomServiceItem` from `@shared/schema` and `PortfolioService` from `@shared/schema`.

---

## Sources

### Primary (HIGH confidence)
- `client/src/components/admin/PortfolioSection.tsx` — dnd-kit sensor setup, arrayMove, key prop pattern, ServiceForm structure, mutation patterns
- `client/src/components/admin/forms/FormsSection.tsx` — AlertDialog delete pattern, deleteTarget state, table-based list view
- `client/src/components/admin/shared/types.ts` — AdminSection union (current state)
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS structure
- `client/src/pages/Admin.tsx` — Both slug maps, sectionsWithOwnHeader, render switch
- `shared/schema/estimates.ts` — Estimate, InsertEstimate, EstimateServiceItem, discriminated union types
- `server/routes/estimates.ts` — All 5 endpoint signatures confirmed
- `.planning/phases/08-admin-ui-estimatessection/08-CONTEXT.md` — 14 locked decisions
- `.planning/phases/08-admin-ui-estimatessection/08-UI-SPEC.md` — Full visual + interaction contract
- `client/src/components/admin/shared/index.ts` — Shared exports (SectionHeader, EmptyState, AdminCard)
- `client/src/components/ui/checkbox.tsx` — Confirmed present on disk

### Secondary (MEDIUM confidence)
- dnd-kit documentation patterns — verticalListSortingStrategy vs rectSortingStrategy distinction verified by UI-SPEC and PortfolioSection code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified installed; no new dependencies
- Architecture: HIGH — all patterns read directly from production code in canonical reference files
- Pitfalls: HIGH — derived from code inspection of the exact files being replicated
- UI contract: HIGH — UI-SPEC fully resolved with no open design questions

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable tech stack; 30-day window appropriate)
