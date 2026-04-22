# Phase 17: Brand Guidelines - Research

**Researched:** 2026-04-21
**Domain:** Express route expansion + React admin editor UI
**Confidence:** HIGH

## Summary

Phase 17 is a narrow, well-constrained phase. The storage layer is fully implemented — `getBrandGuidelines()` and `upsertBrandGuidelines(content)` both exist in `server/storage.ts` with working Drizzle queries (verified by reading the file). The only work is wiring two API routes and building the admin editor UI.

The backend adds `GET /api/brand-guidelines` (public, no auth) and `PUT /api/brand-guidelines` (admin-auth required, 2,000-character limit) into `server/routes/presentations.ts` — the existing file already registered and imported in `routes.ts`. The frontend adds a `PresentationsSection` component (new file) that renders inside the Presentations tab, which requires adding `'presentations'` to the `AdminSection` union, `SIDEBAR_MENU_ITEMS`, and `Admin.tsx` routing.

There are no new npm dependencies, no schema changes, and no migration required. The character-count UI is a pure React controlled-input pattern with no external library.

**Primary recommendation:** Add brand-guidelines routes to `server/routes/presentations.ts`, add `presentations` as a new `AdminSection`, and implement `PresentationsSection.tsx` with a textarea that shows character count and calls `PUT /api/brand-guidelines` on save.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-09 | `GET /api/brand-guidelines` (public) + `PUT /api/brand-guidelines` (admin-auth) upsert; GET before any PUT returns 200 with null/empty content | Storage stubs `getBrandGuidelines`/`upsertBrandGuidelines` fully implemented in `server/storage.ts`; route pattern follows existing `GET /api/company-settings` (public) + `PUT /api/company-settings` (requireAdmin) in `server/routes/company.ts` |
| PRES-10 | Admin Brand Guidelines sub-section in Presentations tab — textarea/markdown editor, save with confirmation, live character count, server rejects > 2,000 chars with 400 + human message | Admin section wiring pattern established in `Admin.tsx`; `SectionHeader`/`AdminCard`/`EmptyState` primitives from `client/src/components/admin/shared/`; `useMutation` + `apiRequest` pattern from `EstimatesSection.tsx` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Frontend stack:** React 18, TypeScript, Vite, Wouter, React Query, shadcn/ui, Tailwind CSS
- **Backend stack:** Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Auth:** Session-based; admin routes use `requireAdmin` middleware from `server/routes/_shared.ts`
- **Schema source of truth:** `shared/schema.ts` (barrel re-exporting `shared/schema/presentations.ts`) — do NOT re-define types in routes
- **Storage layer pattern:** All DB ops go through `server/storage.ts` implementing `IStorage`; routes call storage methods, never raw SQL
- **State management:** React Query for server state; no Redux
- **Translation rule (MEMORY):** Any new `t()` call requires a matching PT entry in `client/src/lib/translations.ts`
- **Border rule (MEMORY):** Use `border` class (resolves to `--border` alpha token); never `border-black`, `border-slate-*`, etc.
- **Admin design system (MEMORY):**
  - `SectionHeader` is rendered by `Admin.tsx` shell — do NOT add a duplicate h1 inside the section component
  - Use `AdminCard`, `EmptyState`, `FormGrid` from `client/src/components/admin/shared/`
  - Neutral charcoal dark theme (bg-card, bg-muted tokens — no hardcoded hex)
  - Max 600 lines per `.tsx` file
- **Brand colors:** Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` for CTAs; CTA buttons pill-shaped `rounded-full`

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | (project) | Server state: fetch guidelines, invalidate on save | Already used everywhere in admin |
| `express` | (project) | Route handlers | Project backend |
| `zod` | (project) | Content validation (2,000-char limit) | Used in all route validation |
| `drizzle-orm` | (project) | Storage queries already implemented | Project ORM |

No new packages. `npm install` is not required for this phase.

---

## Architecture Patterns

### Recommended File Changes

```
server/routes/
└── presentations.ts         # ADD brand-guidelines GET + PUT routes (append to existing file)

client/src/components/admin/
└── PresentationsSection.tsx  # NEW — brand guidelines editor UI

client/src/components/admin/shared/
├── types.ts                 # ADD 'presentations' to AdminSection union
└── constants.ts             # ADD presentations entry to SIDEBAR_MENU_ITEMS

client/src/pages/
└── Admin.tsx                # ADD import + {activeSection === 'presentations' && <PresentationsSection />}

client/src/lib/
└── translations.ts          # ADD PT translations for all new t() strings
```

### Pattern 1: Brand Guidelines API Routes (append to presentations.ts)

The GET endpoint must return `{ content: string | null }` even when no row exists (200, never 404). The PUT endpoint validates content length server-side before calling storage.

```typescript
// Source: verified against existing GET /api/company-settings (server/routes/company.ts:63)
// and existing IStorage.getBrandGuidelines (server/storage.ts:1923)

// PRES-09: Public GET — no auth required
app.get("/api/brand-guidelines", async (_req, res) => {
  try {
    const row = await storage.getBrandGuidelines();
    res.json({ content: row?.content ?? null });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PRES-09: Admin PUT — requireAdmin, 2000-char limit
const brandGuidelinesSchema = z.object({
  content: z.string().max(2000, "Brand guidelines cannot exceed 2,000 characters"),
});

app.put("/api/brand-guidelines", requireAdmin, async (req, res) => {
  try {
    const parsed = brandGuidelinesSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Validation error";
      return res.status(400).json({ message: msg });
    }
    const row = await storage.upsertBrandGuidelines(parsed.data.content);
    res.json({ content: row.content });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});
```

### Pattern 2: AdminSection Registration (three locations)

`AdminSection` is a string union in `types.ts`. Adding `'presentations'` there causes TypeScript to enforce exhaustiveness in `Admin.tsx` (the `slugMap: Record<AdminSection, string>` will fail `npm run check` until the slug is added). Update all three locations atomically or expect TS errors.

**Location 1 — `shared/types.ts`:**
```typescript
// Add to the union:
| 'presentations'
```

**Location 2 — `shared/constants.ts` (SIDEBAR_MENU_ITEMS):**
```typescript
// Source: verified pattern from constants.ts:48 (estimates entry)
{ id: 'presentations', title: 'Presentations', description: 'Build branded slide decks with AI', icon: Presentation }
// Icon: import { Presentation } from 'lucide-react' (verified available in lucide-react)
```

**Location 3 — `Admin.tsx` (both slugMap and sectionsWithOwnHeader and render switch):**
```typescript
// slugMap additions:
const slugMap: Record<string, AdminSection> = { ..., 'presentations': 'presentations' };
const slugMap: Record<AdminSection, string> = { ..., presentations: 'presentations' };

// sectionsWithOwnHeader: PresentationsSection renders its own SectionHeader in the
// design system sense — add to sectionsWithOwnHeader if it manages its own header.
// BUT per MEMORY rule, the shell SectionHeader is auto-rendered for sections NOT in
// sectionsWithOwnHeader. Since PresentationsSection is simple, let the shell render
// the header. Do NOT add to sectionsWithOwnHeader.

// Render switch:
{activeSection === 'presentations' && <PresentationsSection />}
```

### Pattern 3: PresentationsSection Component

The component fetches current guidelines on mount, displays a textarea with live character count, and saves via PUT with a "Saved" confirmation using `useToast`.

```typescript
// Source: pattern from EstimatesSection.tsx useMutation shape + useToast usage
// Source: React Query useQuery shape from all admin sections

export function PresentationsSection() {
  const { toast } = useToast();
  const [content, setContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/brand-guidelines"],
    queryFn: async () => {
      const res = await fetch("/api/brand-guidelines");
      return res.json() as Promise<{ content: string | null }>;
    },
  });

  useEffect(() => {
    if (data?.content != null) setContent(data.content);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/brand-guidelines", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-guidelines"] });
      toast({ title: t("Saved"), description: t("Brand guidelines updated.") });
    },
    onError: (err: Error) => {
      toast({ title: t("Error"), description: err.message, variant: "destructive" });
    },
  });

  const MAX = 2000;
  const count = content.length;
  const isOverLimit = count > MAX;

  return (
    <AdminCard>
      <div className="space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="w-full rounded-lg border bg-muted/30 p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t("Write your brand guidelines here...")}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between">
          <span className={cn("text-xs", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
            {count} / {MAX}
          </span>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isOverLimit}
            className="rounded-full bg-[#FFFF01] text-black font-bold hover:bg-[#FFFF01]/90"
          >
            {saveMutation.isPending ? t("Saving...") : t("Save")}
          </Button>
        </div>
      </div>
    </AdminCard>
  );
}
```

### Anti-Patterns to Avoid

- **Do not add a `<SectionHeader>` inside `PresentationsSection.tsx`** — per MEMORY feedback, the Admin.tsx shell renders it. The component must NOT be added to `sectionsWithOwnHeader` (since the shell handles it automatically for unlisted sections).
- **Do not return 404 from `GET /api/brand-guidelines` when no row exists** — the success criterion requires 200 with null content. `storage.getBrandGuidelines()` returns `undefined` when no row; the route converts to `{ content: null }`.
- **Do not use `border-black` or `border-slate-*`** — use `border` class only (alpha token).
- **Do not skip translations** — all new `t("...")` strings must be added to `translations.ts` in the same commit.
- **Do not add the `presentations` ID to `sectionsWithOwnHeader`** unless the section manages its own full-page header (Phase 19 may warrant this, but Phase 17 does not).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert logic for singleton row | Custom SQL upsert | `storage.upsertBrandGuidelines(content)` | Already implemented in storage.ts with select-then-update-or-insert |
| Admin auth on PUT | Custom session check | `requireAdmin` from `server/routes/_shared.ts` | Shared middleware, same pattern as all other admin PUT routes |
| Toast notification | Custom state | `useToast()` from `@/hooks/use-toast` | Project standard; used in EstimatesSection and all admin sections |
| Server-side length validation | Custom guard | `z.string().max(2000, "...")` + `safeParse` | Zod already in use; human-readable error message surfaced from `errors[0].message` |

---

## Common Pitfalls

### Pitfall 1: TypeScript exhaustiveness failure on AdminSection union
**What goes wrong:** Adding `'presentations'` to the union without updating the `slugMap: Record<AdminSection, string>` in `Admin.tsx` causes `npm run check` to fail immediately. The `Record<AdminSection, string>` type requires every union member to appear as a key.
**Why it happens:** TypeScript's exhaustiveness check on `Record<K, V>` — missing keys are type errors.
**How to avoid:** Update `types.ts`, `constants.ts`, and both slug maps in `Admin.tsx` in the same task. STATE.md documents this exact pattern: "Both slug maps in Admin.tsx must be updated simultaneously."
**Warning signs:** `npm run check` error like "Property 'presentations' is missing in type...".

### Pitfall 2: GET returns 404 when table is empty
**What goes wrong:** `storage.getBrandGuidelines()` returns `undefined` (no rows yet). A naive `if (!row) return res.status(404)` breaks the success criterion.
**Why it happens:** Singleton tables start empty; first meaningful PUT creates the row.
**How to avoid:** Always return 200 with `{ content: row?.content ?? null }`.

### Pitfall 3: Duplicate SectionHeader inside the component
**What goes wrong:** Adding an `<h1>` or `<SectionHeader>` inside `PresentationsSection.tsx` duplicates the header rendered by `Admin.tsx` shell.
**Why it happens:** Per feedback_design_system.md, sections NOT in `sectionsWithOwnHeader` get their header rendered by the shell. Phase 17 does not add `'presentations'` to that list, so the shell renders it.
**How to avoid:** Component starts directly with `<AdminCard>` or layout content — no heading elements.

### Pitfall 4: Character count allows server rejection
**What goes wrong:** UI disables Save when `count > MAX` but a bad actor can bypass; the server 400 must still fire for content > 2,000 chars.
**Why it happens:** Client-side guards are UX only.
**How to avoid:** Zod `.max(2000)` on the server route is the authoritative guard. Both client (`isOverLimit` disable) and server (Zod) must enforce the limit.

### Pitfall 5: Missing PT translations
**What goes wrong:** New `t()` calls without matching entries in `translations.ts` fall back to AI translation API. If no AI provider is configured, strings display raw English in PT mode.
**How to avoid:** After writing all JSX strings, grep the new file for `t(` and add every string to `translations.ts` in the same task.

---

## Code Examples

### Verified: existing upsertBrandGuidelines implementation
```typescript
// Source: server/storage.ts:1928-1939 (read directly)
async upsertBrandGuidelines(content: string): Promise<BrandGuidelines> {
  const existing = await this.getBrandGuidelines();
  if (existing) {
    const [row] = await db
      .update(brandGuidelines)
      .set({ content, updatedAt: new Date() })
      .where(eq(brandGuidelines.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(brandGuidelines).values({ content }).returning();
  return row;
}
```

### Verified: requireAdmin middleware import
```typescript
// Source: server/routes/presentations.ts:4 (read directly)
import { requireAdmin } from "./_shared.js";
```

### Verified: BrandGuidelines Drizzle type
```typescript
// Source: shared/schema/presentations.ts:63-67 (read directly)
export const brandGuidelines = pgTable("brand_guidelines", {
  id:        serial("id").primaryKey(),
  content:   text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
export type BrandGuidelines = typeof brandGuidelines.$inferSelect;
```

### Verified: AdminSection union extension (STATE.md precedent)
```
STATE.md decision: "Both slug maps in Admin.tsx must be updated simultaneously —
partial update causes TypeScript errors from Record<AdminSection,string>
exhaustiveness check."
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no pytest.ini, jest.config, vitest.config found) |
| Config file | none |
| Quick run command | `npm run check` (TypeScript compilation) |
| Full suite command | `npm run check && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-09 | GET returns 200 with null content before any PUT | manual-only | curl test below | N/A |
| PRES-09 | PUT saves content; subsequent GET returns saved content | manual-only | curl test below | N/A |
| PRES-09 | PUT with content > 2000 chars returns 400 + message | manual-only | curl test below | N/A |
| PRES-10 | Admin sees editor; typing changes character count | manual-only | browser test | N/A |
| PRES-10 | Save button triggers PUT; toast "Saved" appears | manual-only | browser test | N/A |

**No automated test files exist** — project has no test framework. Verification is via `npm run check` (TypeScript) and manual curl/browser smoke tests.

**Recommended manual smoke tests for verify-work:**
```bash
# PRES-09 — GET before PUT (should return 200 with null content)
curl -s http://localhost:5000/api/brand-guidelines

# PRES-09 — PUT (admin session required; use browser dev tools or cookie)
curl -s -X PUT http://localhost:5000/api/brand-guidelines \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=<session>" \
  -d '{"content":"Test brand guidelines"}'

# PRES-09 — GET after PUT (should return saved content)
curl -s http://localhost:5000/api/brand-guidelines

# PRES-09 — PUT with > 2000 chars (should return 400)
curl -s -X PUT http://localhost:5000/api/brand-guidelines \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=<session>" \
  -d "{\"content\":\"$(python3 -c 'print("x"*2001)')\"}"
```

### Sampling Rate
- **Per task commit:** `npm run check`
- **Phase gate:** `npm run check && npm run build` before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework to install; existing infrastructure (`npm run check`) covers all automated validation.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase adds routes to an existing Express server and a React component; no new services, CLIs, or runtimes required).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Inline textarea with no character count | Controlled input with `value.length` counter | Simple, no library needed |
| Storing guidelines as a side-effect field | Dedicated `brand_guidelines` singleton table | Clean separation, allows Phase 18 to load it as system prompt |

---

## Open Questions

1. **Should `PresentationsSection` have its own `SectionHeader` (added to `sectionsWithOwnHeader`)?**
   - What we know: Phase 17 only shows the brand guidelines editor. Phase 19 will add a full presentations list + editor panel.
   - What's unclear: Whether Phase 19 will need `PresentationsSection` to manage its own complex header (with action buttons like "New Presentation").
   - Recommendation: For Phase 17, do NOT add to `sectionsWithOwnHeader` — the shell's auto-rendered header is sufficient. Phase 19 plan should revisit and add to `sectionsWithOwnHeader` when the list + action button are added.

2. **Markdown editor vs. plain textarea?**
   - The requirements say "textarea or markdown editor" (PRES-10). The success criteria mention "typing and saving."
   - Recommendation: Use a plain `<textarea>` for Phase 17. The content will be consumed as a system prompt string (Phase 18), not rendered as markdown in the UI. A markdown editor adds a dependency and complexity not justified by the requirement. This is `Claude's Discretion` territory.

---

## Sources

### Primary (HIGH confidence)
- `server/storage.ts` lines 1923–1939 — `getBrandGuidelines` and `upsertBrandGuidelines` implementations read directly
- `server/routes/presentations.ts` — full file read; route registration pattern verified
- `server/routes/_shared.ts` — `requireAdmin` middleware implementation verified
- `client/src/components/admin/shared/types.ts` — `AdminSection` union read directly (no `'presentations'` yet)
- `client/src/components/admin/shared/constants.ts` — `SIDEBAR_MENU_ITEMS` array read directly
- `client/src/pages/Admin.tsx` — section render switch and `sectionsWithOwnHeader` list read directly
- `shared/schema/presentations.ts` — `brandGuidelines` table and `BrandGuidelines` type verified
- `client/src/lib/translations.ts` — end of file read to confirm no existing brand/presentations entries

### Secondary (MEDIUM confidence)
- `STATE.md` decisions — "Both slug maps in Admin.tsx must be updated simultaneously" (project-specific pattern, verified in current code)
- `feedback_design_system.md` — admin design system rules verified against current component implementations

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified in existing codebase
- Architecture: HIGH — storage stubs fully implemented; route and UI patterns established
- Pitfalls: HIGH — TS exhaustiveness and duplicate header pitfalls are documented in STATE.md decisions; verified in Admin.tsx source

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable — no external dependency changes expected)
