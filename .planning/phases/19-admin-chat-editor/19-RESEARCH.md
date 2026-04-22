# Phase 19: Admin Presentations Editor — Research

**Researched:** 2026-04-21
**Domain:** React admin UI — list + in-section sub-view routing, JSON textarea editor, live mini-preview
**Confidence:** HIGH (all findings sourced directly from existing codebase; no external speculation)

---

## Summary

Phase 19 delivers the admin-facing UI for presentations management: a list view with per-row actions and an in-section editor view (JSON textarea + slide mini-cards). All backend infrastructure (CRUD API, SlideBlock Zod schema, PresentationWithStats type) is fully operational from Phases 15–16. This phase is purely frontend work within the existing admin section architecture.

The `'presentations'` AdminSection union member is already registered in `types.ts`, both slug maps in `Admin.tsx` are already populated, and `Admin.tsx` currently renders `<BrandGuidelinesSection />` for that route. Phase 19 replaces that render with a new `<PresentationsSection />` component. The `BrandGuidelinesSection` component moves inside `PresentationsSection` as a sub-section.

**Primary recommendation:** Build `PresentationsSection.tsx` as a single file (two internal views: list + editor, toggled by `selectedPresentationId` state). Wire it into `Admin.tsx` in place of `BrandGuidelinesSection`. Keep BrandGuidelinesSection mounted at the bottom of the list view. File should stay under 600 lines.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-14 | Presentations tab shows list with title, slide count, view count badge, copy-link button, delete button, Open Editor button | `listPresentations()` returns `PresentationWithStats[]` with `slideCount`, `viewCount`, `slug`; copy-link + delete patterns established in `EstimatesSection` |
| PRES-15 | Editor view: monospace JSON textarea with current `SlideBlock[]`, Save button calling `PUT /api/presentations/:id`, slide preview panel | `PUT /api/presentations/:id` accepts `{ slides: SlideBlock[] }`; `useQuery` for current data + `useMutation` for PUT follows `BrandGuidelinesSection` pattern |
| PRES-16 | Slide mini-cards show layout type and heading; JSON textarea reflects saved state; invalid JSON shows inline parse error | `slideBlockSchema` has `layout` (required) and `heading` (optional string); parse error = controlled textarea + `JSON.parse` on change + error state string |
</phase_requirements>

---

## Standard Stack

### Core — already in project, zero new installs

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| React Query (`@tanstack/react-query`) | project-installed | `useQuery` for list + editor data, `useMutation` for PUT/DELETE | `BrandGuidelinesSection`, `EstimatesSection` |
| shadcn/ui `Textarea` | project-installed | Monospace JSON editor textarea | `BrandGuidelinesSection` (same `font-mono text-sm` class) |
| shadcn/ui `AlertDialog` | project-installed | Delete confirmation dialog | `EstimatesSection` (exact pattern) |
| shadcn/ui `Badge` | project-installed | View count badge, layout type badge on mini-cards | `EstimatesSection` (Eye + viewCount) |
| shadcn/ui `Button` | project-installed | All action buttons | universal |
| lucide-react `Eye`, `Copy`, `Trash2`, `Plus`, `ChevronLeft`, `Presentation` | project-installed | Row action icons + section header icon | `EstimatesSection` uses all but ChevronLeft |
| `AdminCard`, `SectionHeader`, `EmptyState` from `./shared` | project-installed | Design system primitives per CLAUDE.md | `BrandGuidelinesSection`, `EstimatesSection` |
| `useTranslation` / `translations.ts` | project-installed | PT translations required by CLAUDE.md | All admin sections |

**Installation:** No new packages needed. Everything is already a project dependency.

---

## Architecture Patterns

### How AdminSection routing works (confirmed from source)

`Admin.tsx` derives `activeSection: AdminSection` from the URL path segment after `/admin/`. The slug map is a `Record<string, AdminSection>` for path → type, and a `Record<AdminSection, string>` for type → path — **both must be updated simultaneously** (TypeScript exhaustiveness check enforces this; noted as Phase 8 decision in STATE.md).

**Both maps already contain `'presentations': 'presentations'`** — no changes to `Admin.tsx` slug maps are needed.

`Admin.tsx` line 215: `{activeSection === 'presentations' && <BrandGuidelinesSection />}` is the only line to change — replace `<BrandGuidelinesSection />` with `<PresentationsSection />`.

The `'presentations'` section is already in `sectionsWithOwnHeader` array (line 189) — no SectionHeader will be auto-rendered by Admin.tsx; the section component must render its own.

### Sub-view navigation: internal state, not a new URL route

The editor view should be implemented as a **local state** within `PresentationsSection`, not as a new route. Pattern reasoning:
- No new entry in the slug maps or `AdminSection` union is needed
- The `useLocation` / `setLocation` wiring is only needed for top-level sections
- Consistent with how `EstimateDialogForm` is a nested in-component view (Dialog); here we go full-panel instead of a modal, but the same principle applies: state lives in the parent section component

```typescript
// In PresentationsSection:
const [selectedId, setSelectedId] = useState<string | null>(null);

if (selectedId) {
  return <PresentationEditor id={selectedId} onBack={() => setSelectedId(null)} />;
}
// otherwise render the list
```

This is the simplest pattern. The editor occupies the same scroll container as the list (Admin.tsx `flex-1 overflow-y-auto` div).

### Recommended file structure

```
client/src/components/admin/
├── PresentationsSection.tsx    # New file — replaces BrandGuidelinesSection in Admin.tsx
```

`BrandGuidelinesSection.tsx` stays as-is; `PresentationsSection.tsx` imports and renders it at the bottom of the list view (or as a second accordion/card below the presentations list).

**Line-budget guidance (CLAUDE.md: max 600 lines):**
- List view UI: ~80 lines
- Editor view (sub-component): ~120 lines  
- Slide mini-card sub-component: ~30 lines
- Mutations + queries: ~60 lines
- Translation keys: ~20 keys
- Total estimate: ~310–350 lines — well within limit

### Pattern 1: Presentations list row (from EstimatesSection)

```typescript
// Source: client/src/components/admin/EstimatesSection.tsx lines 435-496
<div className="flex items-center gap-3 border rounded-lg p-4 bg-card">
  <span className="font-bold text-sm flex-1">{est.title}</span>
  <Badge variant="secondary" className="text-xs gap-1 shrink-0">
    <Eye className="w-3 h-3" />
    {est.viewCount ?? 0}
  </Badge>
  <div className="flex gap-2 shrink-0">
    <Button variant="ghost" size="icon" onClick={() => handleCopyLink(est.slug)}>
      <Copy className="w-4 h-4" />
    </Button>
    <Button variant="ghost" size="icon" className="text-destructive"
      onClick={() => setDeleteTarget(est)}>
      <Trash2 className="w-4 h-4" />
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setSelectedId(est.id)}>
      Open Editor
    </Button>
  </div>
</div>
```

Additional columns vs Estimates: `slideCount` badge (similar to viewCount). Both are `number` on `PresentationWithStats`.

### Pattern 2: Copy-link (from EstimatesSection)

```typescript
// Source: client/src/components/admin/EstimatesSection.tsx lines 393-400
const handleCopyLink = async (slug: string) => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
    toast({ title: t('Link copied'), description: t('Share this link with your client.') });
  } catch {
    toast({ title: t('Copy failed'), description: t('Please copy the URL manually.'), variant: 'destructive' });
  }
};
```

Only change: path is `/p/${slug}` not `/e/${slug}`.

### Pattern 3: Delete AlertDialog (from EstimatesSection)

```typescript
// Source: client/src/components/admin/EstimatesSection.tsx lines 498-519
{deleteTarget && (
  <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete presentation?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently remove "{deleteTarget.title}". This action cannot be undone.
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

`deleteTarget` is typed as `PresentationWithStats | null`. The `id` is a UUID string (not integer — presentations use UUID PKs, unlike estimates which use serial integer PKs).

### Pattern 4: Monospace JSON textarea with inline validation

```typescript
// Pattern (no prior project reference — standard React controlled textarea)
const [jsonText, setJsonText] = useState(() => JSON.stringify(presentation.slides, null, 2));
const [jsonError, setJsonError] = useState<string | null>(null);

const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value;
  setJsonText(val);
  try {
    JSON.parse(val);
    setJsonError(null);
  } catch (err) {
    setJsonError((err as Error).message);
  }
};

// In JSX:
<Textarea
  value={jsonText}
  onChange={handleJsonChange}
  className="font-mono text-sm resize-y min-h-[300px]"
/>
{jsonError && (
  <p className="text-xs text-destructive mt-1">{jsonError}</p>
)}
<Button onClick={handleSave} disabled={!!jsonError || saveMutation.isPending}>
  Save
</Button>
```

**Important:** Save button must be disabled when `jsonError` is non-null. No Zod validation client-side — server validates via `insertPresentationSchema`. Client-side validation is JSON.parse only.

**State sync:** When editor mounts for a presentation, `jsonText` must be initialized from the fetched data. Use `useEffect` keyed to `data?.slides` (same pattern as BrandGuidelinesSection line 22–26 for `content`). JSON.stringify with `null, 2` for readable indentation.

### Pattern 5: Slide mini-cards

```typescript
// SlideBlock has: layout (required), heading (optional string)
// Mini-card: compact, show layout badge + heading (or layout name as fallback)
function SlideCard({ slide, index }: { slide: SlideBlock; index: number }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
      <Badge variant="outline" className="text-xs capitalize">
        {slide.layout}
      </Badge>
      <p className="text-xs text-muted-foreground truncate">
        {slide.heading ?? slide.layout}
      </p>
    </div>
  );
}
```

Layout for the preview panel: `grid grid-cols-2 sm:grid-cols-3 gap-2` — shows 2-3 cards per row, all visible without horizontal scrolling on desktop. For larger decks (10+ slides), this grid wraps naturally.

### Pattern 6: Editor layout (two-column on desktop)

```
|  JSON textarea (flex-1)  |  Slide mini-cards (w-80)  |
```

On mobile: stacked (JSON editor on top, cards below).

```typescript
<div className="flex flex-col lg:flex-row gap-6">
  <div className="flex-1 min-w-0 space-y-3">
    {/* JSON textarea + error + Save button */}
  </div>
  <div className="w-full lg:w-80 space-y-3">
    <p className="text-sm font-medium">Slide preview</p>
    <div className="grid grid-cols-2 gap-2">
      {parsedSlides.map((slide, i) => <SlideCard key={i} slide={slide} index={i} />)}
    </div>
  </div>
</div>
```

`parsedSlides` is derived state: the slides parsed from `jsonText` when `jsonError` is null, otherwise falls back to the last successfully parsed state (or empty array).

### Pattern 7: Editor back navigation + header

```typescript
// BrandGuidelinesSection moves to bottom of list view, not inside editor
// Editor header shows Back button + title
<SectionHeader
  title={presentation.title}
  description={`${parsedSlides.length} slide${parsedSlides.length !== 1 ? 's' : ''}`}
  icon={<Presentation className="w-5 h-5" />}
  action={
    <Button variant="outline" onClick={onBack}>
      <ChevronLeft className="w-4 h-4 mr-2" />
      {t('Back to presentations')}
    </Button>
  }
/>
```

### Pattern 8: Create new presentation

The list view SectionHeader action button: "New Presentation" → POST `/api/presentations` with `{ title: "Untitled Presentation" }` → immediately open the editor for the returned `id`.

```typescript
const createMutation = useMutation({
  mutationFn: async () => {
    const res = await apiRequest('POST', '/api/presentations', { title: 'Untitled Presentation' });
    return res.json() as Promise<{ id: string; slug: string; slides: SlideBlock[] }>;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
    setSelectedId(data.id); // immediately open editor
  },
});
```

### Anti-Patterns to Avoid

- **Adding a new AdminSection type for the editor view:** The editor is an in-component sub-view, not a URL route. No new AdminSection member, no new slug map entry.
- **Routing to `/admin/presentations/:id`:** The admin router only handles top-level sections. Sub-views use local state.
- **Running Zod validation client-side before save:** The server validates via `insertPresentationSchema`. Client only needs `JSON.parse` to catch syntax errors before making the request.
- **Replacing BrandGuidelinesSection:** It must stay accessible. Mount it below the presentations list (or as a collapsible AdminCard) in the list view. Do not hide it behind the editor.
- **Using integer IDs:** Presentation IDs are UUID strings. Never call `Number(id)` or `parseInt(id)` — unlike estimates which use serial integers.
- **Splitting into two files when one suffices:** Small sub-components (`SlideCard`, list row) should be co-located in `PresentationsSection.tsx` per the `EstimatesSection` `SortableServiceRow` precedent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete confirmation | Custom modal/confirm() | `AlertDialog` from shadcn/ui | Matches all other delete flows in admin; keyboard accessible |
| Clipboard copy | execCommand('copy') | `navigator.clipboard.writeText` | Modern async API; already used in `EstimatesSection.handleCopyLink` |
| Toast notifications | Custom toast | `useToast` from shadcn/ui | Project standard — all sections use it |
| Loading spinner | Custom spinner | `Loader2` from `@/components/ui/loader` | Project standard |
| Card container | Custom div with styles | `AdminCard` | Ensures neutral charcoal dark theme compliance |

---

## Common Pitfalls

### Pitfall 1: UUID vs integer IDs
**What goes wrong:** Passing presentation `id` to a Number() cast or comparing with `===` to a number literal.
**Why it happens:** Estimates use serial integer PKs; presentations use UUID string PKs (Phase 15 decision, STATE.md).
**How to avoid:** Type `id` as `string`, never as `number`. Pass directly to `storage.deletePresentation(id)` and `PUT /api/presentations/:id`.
**Warning signs:** TypeScript errors when passing `id` to functions expecting `number`.

### Pitfall 2: JSON textarea state sync on re-open
**What goes wrong:** Editing JSON in the editor, navigating back to list, reopening same presentation — textarea shows stale text from first open.
**Why it happens:** Local `jsonText` state survives component re-mounts if the editor is not re-keyed.
**How to avoid:** Add `key={selectedId}` to the editor sub-component, or reset `jsonText` via `useEffect` when `selectedId` changes. BrandGuidelinesSection pattern: `useEffect(() => { if (data?.content !== undefined) setContent(data.content) }, [data?.content])`.

### Pitfall 3: Disabled Save button while JSON is invalid
**What goes wrong:** Admin pastes partial JSON (typing in progress), clicks Save, server receives malformed slides, returns 400 — confusing error toast.
**Why it happens:** Save not gated on parse result.
**How to avoid:** `disabled={!!jsonError || saveMutation.isPending}`. The parse error message displayed inline replaces the need for a server validation round-trip.

### Pitfall 4: parsedSlides reflecting uncommitted edits
**What goes wrong:** Slide mini-cards show layout from the in-flight textarea (including partial/invalid JSON), then flicker when error clears.
**Why it happens:** Deriving `parsedSlides` from `jsonText` directly.
**How to avoid:** Keep a separate `parsedSlides` state that only updates on successful `JSON.parse`:
```typescript
const [parsedSlides, setParsedSlides] = useState<SlideBlock[]>(presentation.slides ?? []);
// in handleJsonChange, after successful parse:
setParsedSlides(parsed as SlideBlock[]);
```
This makes mini-cards show the last valid parse, not mid-edit garbage.

### Pitfall 5: Losing BrandGuidelinesSection access
**What goes wrong:** Admin can no longer reach the Brand Guidelines editor after Phase 19 swaps the component.
**Why it happens:** `BrandGuidelinesSection` was the sole content of the `presentations` route.
**How to avoid:** `PresentationsSection` list view imports and renders `<BrandGuidelinesSection />` below the presentations list card. Only the editor sub-view hides it (editor occupies full view).

### Pitfall 6: Missing PT translations
**What goes wrong:** PT locale shows English strings for all new labels.
**Why it happens:** CLAUDE.md requires adding PT translations to `translations.ts` whenever new `t()` strings are introduced.
**How to avoid:** Add all new translation keys in the same commit as the component. See required keys section below.

---

## API Shape Reference

### GET /api/presentations response (`PresentationWithStats[]`)

```typescript
// Source: shared/schema/presentations.ts + server/storage.ts lines 1869-1888
type PresentationWithStats = {
  id: string;            // UUID
  slug: string;          // UUID (public URL token)
  title: string;
  slides: SlideBlock[];  // full JSONB array
  guidelinesSnapshot: string | null;
  accessCode: string | null;
  version: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  slideCount: number;    // derived: jsonb_array_length
  viewCount: number;     // derived: count(presentation_views)
}
```

### PUT /api/presentations/:id request body

```typescript
// Source: server/routes/presentations.ts lines 49-66
// Accepts insertPresentationSchema.partial() — any combination of:
{ title?: string; slides?: SlideBlock[]; accessCode?: string | null }
// version is injected server-side (existing.version + 1) — do NOT send version from client
```

### POST /api/presentations response

```typescript
// Source: server/routes/presentations.ts line 40
{ id: string; slug: string; slides: SlideBlock[] }
```

### SlideBlock fields relevant to mini-cards

```typescript
// Source: shared/schema/presentations.ts lines 6-30
type SlideBlock = {
  layout: "cover" | "section-break" | "title-body" | "bullets" | "stats" | "two-column" | "image-focus" | "closing";
  heading?: string;     // show this in mini-card (fallback: layout name)
  headingPt?: string;
  body?: string;
  // ... other bilingual fields not needed for mini-card display
}
```

---

## Required PT Translation Keys

New keys to add to `client/src/lib/translations.ts` in the Phase 19 commit:

```typescript
// Admin — Presentations Section (Phase 19)
'Presentations': already exists ('Apresentações')  // already in file line 357
'New Presentation': 'Nova Apresentação',
'Open Editor': 'Abrir Editor',
'Back to presentations': 'Voltar às apresentações',
'Delete presentation?': 'Excluir apresentação?',
'This will permanently remove this presentation. This action cannot be undone.': 'Isso removerá permanentemente esta apresentação. Esta ação não pode ser desfeita.',
'Presentation deleted': 'Apresentação excluída',
'Failed to delete presentation': 'Falha ao excluir apresentação',
'Presentation created': 'Apresentação criada',
'Slides saved': 'Slides salvos',
'Failed to save slides': 'Falha ao salvar slides',
'Link copied': already exists — reuse
'Copy failed': already exists — reuse
'No presentations yet': 'Nenhuma apresentação ainda',
'Create your first presentation to get started.': 'Crie sua primeira apresentação para começar.',
'slides': 'slides',
'Slide preview': 'Pré-visualização dos slides',
'JSON — paste Claude Code output here': 'JSON — cole a saída do Claude Code aqui',
'Invalid JSON': 'JSON inválido',
```

Existing keys that can be reused: `'Cancel'`, `'Delete'`, `'Save'`, `'Back'`, `'Link copied'`, `'Copy failed'`, `'Save failed'`.

---

## Code Examples

### Minimal PresentationsSection skeleton

```typescript
// Source: patterns from EstimatesSection.tsx + BrandGuidelinesSection.tsx

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Presentation } from 'lucide-react';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import { BrandGuidelinesSection } from './BrandGuidelinesSection';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import type { PresentationWithStats, SlideBlock } from '@shared/schema';

// Sub-components: SlideCard, PresentationRow, PresentationEditor (co-located)

export function PresentationsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PresentationWithStats | null>(null);

  const { data: presentations = [], isLoading } = useQuery<PresentationWithStats[]>({
    queryKey: ['/api/presentations'],
  });

  // createMutation, deleteMutation (see patterns above)

  if (selectedId) {
    return (
      <PresentationEditor
        id={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Presentations')}
        description={t('Build AI-powered slide decks and share them as immersive fullscreen experiences.')}
        icon={<Presentation className="w-5 h-5" />}
        action={<Button onClick={() => createMutation.mutate()}><Plus ... /></Button>}
      />
      {/* Presentations list */}
      {/* AlertDialog for deleteTarget */}
      {/* BrandGuidelinesSection below */}
      <BrandGuidelinesSection />
    </div>
  );
}
```

### Admin.tsx change (single line)

```typescript
// Before (line 215):
{activeSection === 'presentations' && <BrandGuidelinesSection />}

// After:
{activeSection === 'presentations' && <PresentationsSection />}

// Also update import at top of file:
// Remove: import { BrandGuidelinesSection } from '@/components/admin/BrandGuidelinesSection';
// Add:    import { PresentationsSection } from '@/components/admin/PresentationsSection';
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 19 is a pure frontend React component with no external CLI tools, services, runtimes, or new npm dependencies. All dependencies (React Query, shadcn/ui, lucide-react) are already installed.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, vitest.config, pytest.ini) |
| Config file | None — Wave 0 must establish test infrastructure if automated tests are planned |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-14 | Presentations list renders with title, slideCount, viewCount, copy-link, delete, Open Editor | manual-only (no test framework) | — | N/A |
| PRES-15 | JSON textarea shows current SlideBlock[]; Save calls PUT /api/presentations/:id | manual-only | — | N/A |
| PRES-15 | PUT /api/presentations/:id accepts { slides } and increments version | server integration | `curl -X PUT /api/presentations/:id -d '{"slides":[]}' ...` | N/A — manual curl |
| PRES-16 | Invalid JSON shows inline error and does not trigger save | manual-only | — | N/A |
| PRES-16 | Slide mini-cards display layout badge + heading field | manual-only | — | N/A |

### Sampling Strategy (manual UAT — no automated test runner)

**Per-task verification:**
1. `npm run check` — TypeScript must pass clean after every file change
2. `npm run dev` then manual browser smoke test

**Phase gate checklist (before `/gsd:verify-work`):**
- [ ] Admin `Presentations` tab loads without JS error; existing `Brand Guidelines` section still visible below list
- [ ] "New Presentation" button creates a new row and immediately opens the editor for it
- [ ] List shows title, slide count (0 for new), view count (0), Copy Link, Delete, Open Editor buttons
- [ ] Copy Link copies `{origin}/p/{slug}` to clipboard; toast appears
- [ ] Delete shows AlertDialog; confirming removes the row without page reload; toast appears
- [ ] Open Editor opens editor view; monospace textarea shows `[]` (empty slides JSON) 
- [ ] Pasting valid JSON array of SlideBlocks: error message disappears; Save button enables; mini-cards appear
- [ ] Pasting malformed JSON (e.g. `[{`): red error message appears below textarea; Save button disabled
- [ ] Clicking Save: PUT request fires; toast "Slides saved"; mini-cards reflect new content
- [ ] Back button returns to list; re-opening editor shows last-saved state (not last-typed state)
- [ ] `npm run check` passes cleanly

### Wave 0 Gaps

- No automated test framework exists in the project. All validation is manual UAT as documented above.
- `npm run check` (TypeScript) is the only automated gate — this is sufficient per project convention.

*(None — existing project has no test infrastructure gap to fill for this phase; TypeScript check is the automated gate.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<BrandGuidelinesSection />` renders at `presentations` route | `<PresentationsSection />` wraps both presentations list and BrandGuidelinesSection | Phase 19 | Admin sees both features in one tab; no new route needed |

---

## Open Questions

1. **Create presentation title**
   - What we know: `POST /api/presentations` requires `{ title }` (min length 1)
   - What's unclear: Should "New Presentation" use a hardcoded default title (`"Untitled Presentation"`) or prompt admin for a title first?
   - Recommendation: Use hardcoded `"Untitled Presentation"` and open editor immediately — admin can edit the title later via the textarea if we expose a title field in the editor, or a future phase can add inline rename. Keeps the creation flow fast (one click).

2. **Title editing in editor**
   - What we know: `PUT /api/presentations/:id` accepts `{ title }` as optional field
   - What's unclear: PRES-15/16 do not mention title editing; PRES-14 shows title in list but no edit action
   - Recommendation: Exclude title editing from Phase 19 scope. Title remains as created. A simple `<Input>` for title in the editor would add complexity; the requirements do not call for it.

3. **BrandGuidelinesSection placement in PresentationsSection**
   - What we know: It must remain accessible from the presentations route
   - What's unclear: Below the list (always visible) or collapsed/accordion?
   - Recommendation: Below the list, always visible (same flat layout as current). Accordion adds complexity with no requirement justification.

---

## Sources

### Primary (HIGH confidence — sourced directly from project files)

- `client/src/pages/Admin.tsx` — AdminSection routing, slug maps, section render switch, presentations already wired
- `client/src/components/admin/shared/types.ts` — AdminSection union type ('presentations' already present)
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS with Presentation icon
- `client/src/components/admin/BrandGuidelinesSection.tsx` — useQuery/useMutation/AdminCard/SectionHeader/Textarea pattern
- `client/src/components/admin/EstimatesSection.tsx` — list row pattern, copy-link, AlertDialog delete confirmation, EmptyState
- `shared/schema/presentations.ts` — SlideBlock schema, PresentationWithStats type, insertPresentationSchema
- `server/routes/presentations.ts` — PUT accepts `insertPresentationSchema.partial()`, version injected server-side
- `server/storage.ts` lines 1869–1924 — listPresentations(), updatePresentation(), deletePresentation() implementations
- `client/src/lib/translations.ts` — existing PT keys, last additions at line 348 (Phase 17 Brand Guidelines)
- `.planning/config.json` — nyquist_validation: true, commit_docs: true

### Secondary (MEDIUM confidence)

None required — all research is directly from codebase.

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase
- Architecture: HIGH — AdminSection routing, slug maps, and sub-view patterns read directly from source
- API shapes: HIGH — PresentationWithStats, PUT contract, SlideBlock all read from TypeScript source
- Pitfalls: HIGH — UUID vs integer confirmed from schema + STATE.md decisions; others inferred from existing patterns

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable codebase; only invalidated by changes to Admin.tsx routing or presentations API)
