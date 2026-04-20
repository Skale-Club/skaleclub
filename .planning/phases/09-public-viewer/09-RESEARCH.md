# Phase 9: Public Viewer - Research

**Researched:** 2026-04-19
**Domain:** React fullscreen scroll-snap viewer, view tracking, access code gate, Drizzle schema additions
**Confidence:** HIGH

## Summary

Phase 9 delivers the client-facing end of the Estimates System: a route at `/e/:slug` that renders a fullscreen, scroll-snapped, dark immersive proposal page. The route must be isolated from Navbar/Footer/ChatWidget, the same way `/admin`, `/xpot`, `/links`, and `/vcard` routes are already isolated in `App.tsx`. All patterns needed — route isolation, view tracking, slug-based fetch, 404 handling — already exist in the codebase and can be directly replicated with minor adaptation.

The phase also adds two DB concerns: (1) an `access_code text` column on the `estimates` table (plain text, nullable, used as a gate on the viewer), and (2) a new `estimate_views` event-log table for view tracking. Both additions require `npm run db:push` to migrate. The `listEstimates` storage method must be upgraded to aggregate view counts via SQL and return them inline so the admin list can display badges without a second request.

Admin UI changes are strictly additive to the already-shipped `EstimatesSection.tsx`: an `access_code` text field in the create/edit dialog, and view count + last-seen badges in each list row.

**Primary recommendation:** Replicate the existing VCard + PublicForm patterns exactly. Do not invent new patterns — every moving part already has a canonical implementation in this codebase.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dark immersive theme — `bg-zinc-950` (or `#0a0a0a`) as base background. Each section fills 100vh with scroll-snap alignment.
- **D-02:** Subtle gradient overlay per section — keeps sections visually distinct without per-service color variations.
- **D-03:** No per-service color schemes — consistent dark treatment across all service sections.
- **D-04:** Service content is centered vertically in each section with a clean card-style layout (title, description, price, features list).
- **D-05:** Fixed navigation dots on the right side — one dot per section, active dot highlighted. No arrow buttons.
- **D-06:** Primary navigation is native scroll/touch (scroll-snap). Dots are visual indicators and click targets for direct section jump.
- **D-07:** `access_code` stored as **plain text** in a new `access_code text` column on `estimates`. NOT bcrypt hashed. Codes are simple (e.g., "20260419", "9134") — must be readable for GHL automation.
- **D-08:** Minimal centered gate screen — logo + "Enter access code" heading + input + submit button. Dark viewer theme.
- **D-09:** Wrong code shows an **inline error** directly under the input ("Incorrect code") — no toast, no redirect.
- **D-10:** Admin create/edit dialog gets a new optional "Access code" text field — plain text input, clearable. No toggle needed (empty = no gate).
- **D-11:** New `estimate_views` table: `id` (serial PK), `estimate_id` (integer FK → estimates.id), `viewed_at` (timestamp, defaultNow), `ip_address` (text, nullable). Event log approach — no counter column on estimates.
- **D-12:** View event fired once per page load via `useMutation` with `useRef(false)` guard (same pattern as `VCard.tsx` — `POST /api/estimates/:id/view`).
- **D-13:** Admin list shows two inline badges per row: view count ("👁 N") and last seen relative date ("last seen 2 days ago"). Computed from `estimate_views` via new storage method.
- **D-14:** `GET /api/estimates` response must include `viewCount` and `lastViewedAt` fields (aggregated from `estimate_views`).
- **D-15:** Add `access_code text` column to `estimates` table (nullable, no default). Migration via `npm run db:push`.
- **D-16:** New `estimate_views` table in `shared/schema/estimates.ts`.
- **D-17:** New storage method `recordEstimateView(estimateId, ipAddress?)` on `DatabaseStorage`.
- **D-18:** `listEstimates` updated to JOIN/aggregate view counts — returns `viewCount: number` and `lastViewedAt: Date | null` per estimate.
- **D-19:** New Wouter route `<Route path="/e/:slug" component={EstimateViewer} />` in `App.tsx` — same pattern as `/f/:slug`.
- **D-20:** Viewer route bypasses Navbar/Footer/ChatWidget using same isolation approach as admin/xpot/links routes (branch on `location.startsWith('/e/')`).
- **D-21:** Unknown slug renders a graceful centered 404 message within the dark viewer theme (EST-18).

### Claude's Discretion

- Exact gradient CSS values per section (any subtle dark gradient works)
- Dot size, spacing, and active state styling
- Loading spinner while estimate data fetches
- Framer-motion entrance animations per section (available in stack)
- Whether to show a "Powered by Skale Club" footer inside the viewer

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EST-11 | View tracking — record view event per page load; admin list shows view_count and last_viewed_at | estimate_views table + recordEstimateView storage method + POST /api/estimates/:id/view + listEstimates aggregation |
| EST-12 | Access code protection — optional plain-text code on estimate; viewer shows gate if set; admin dialog has text field | access_code column on estimates + server-side comparison + access code gate component |
| EST-13 | /e/:slug renders fullscreen scroll-snap sections with no Navbar/Footer/ChatWidget | isEstimateRoute guard in App.tsx + isolated router branch |
| EST-14 | First section: cover with client name and Skale Club branding | EstimateViewer cover section component |
| EST-15 | Second section: fixed Skale Club introduction | EstimateViewer intro section component |
| EST-16 | Each service renders as its own fullscreen section (title, description, price, features) | EstimateViewer service section component — iterate estimate.services |
| EST-17 | Final visual closing section after all service sections — no acceptance CTA | EstimateViewer closing section component |
| EST-18 | /e/unknown-slug renders graceful 404 — no crash, no blank | data === null guard in EstimateViewer — same as PublicForm.tsx pattern |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Wouter | 3.3.5 | Client routing — `useParams`, `useLocation` | Project-standard router |
| TanStack React Query | 5.60.5 | `useQuery` for slug fetch, `useMutation` for view tracking | Project-standard data fetching |
| framer-motion | 11.18.2 | Section entrance animations | Installed, used in project |
| date-fns | 3.6.0 | `formatDistanceToNow` for "last seen X days ago" badges | Installed; `format` already used in EstimatesSection |
| Drizzle ORM | 0.39.3 | New table, FK reference, SQL aggregation | Project ORM |
| lucide-react | 0.453.0 | `Loader2` spinner, `Eye` icon for view badge | Project icon library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Badge | — | View count and last-seen badges in admin list | Matches existing EstimatesSection badge usage |
| shadcn/ui Input | — | Access code text field in dialog + gate input | Matches existing dialog inputs |
| Tailwind CSS | 3.4.17 | `snap-y snap-mandatory h-screen overflow-y-scroll` | Scroll-snap via Tailwind utilities |

### No New Packages Required

All functionality is achievable with the installed stack. Do not add new dependencies.

---

## Architecture Patterns

### Recommended File Structure for This Phase

```
client/src/pages/
└── EstimateViewer.tsx       # New: public viewer page (all viewer logic here)

shared/schema/
└── estimates.ts             # Modified: add access_code column, estimate_views table, new types

server/routes/
└── estimates.ts             # Modified: add POST /api/estimates/:id/view, update GET /api/estimates

server/storage.ts            # Modified: recordEstimateView(), updated listEstimates()

client/src/App.tsx           # Modified: isEstimateRoute guard + lazy import + Route
client/src/components/admin/
└── EstimatesSection.tsx     # Modified: access_code field in dialog + view badges in list
```

### Pattern 1: Route Isolation in App.tsx

The `/e/` route must branch before the main public router (which renders Navbar/Footer/ChatWidget). The exact pattern is already established for four other route prefixes.

**How to add (App.tsx):**

```typescript
// After existing isVCardRoute block (~line 228), before the main return:
const isEstimateRoute = location.startsWith('/e/');
// ...
if (isEstimateRoute) {
  return (
    <Suspense fallback={fallback}>
      <Switch>
        <Route path="/e/:slug" component={EstimateViewer} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

Add the lazy import with the other lazy imports (~line 56):
```typescript
const EstimateViewer = lazy(() => import("@/pages/EstimateViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
```

**Source:** `client/src/App.tsx` lines 115–228 (isAdminRoute, isXpotRoute, isLinksRoute, isVCardRoute pattern)

### Pattern 2: View Tracking — useMutation + useRef Guard

Canonical source: `client/src/pages/VCard.tsx` lines 32–76.

```typescript
// In EstimateViewer.tsx
const hasTrackedView = useRef(false);

const { mutate: trackView } = useMutation({
  mutationFn: async () => {
    const res = await fetch(`/api/estimates/${estimateData.id}/view`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to track view');
    return res.json();
  },
});

useEffect(() => {
  if (estimateData && !hasTrackedView.current) {
    hasTrackedView.current = true;
    trackView();
  }
}, [estimateData]);
```

The guard fires once per mount after data is available. No re-fire on React StrictMode double-render because `useRef` persists across renders.

### Pattern 3: Slug Fetch + Loading + 404 State

Canonical source: `client/src/pages/PublicForm.tsx`.

```typescript
// In EstimateViewer.tsx
const { slug } = useParams<{ slug: string }>();

const { data, isLoading } = useQuery({
  queryKey: [`/api/estimates/slug/${slug}`],
  enabled: Boolean(slug),
  queryFn: async () => {
    const res = await fetch(`/api/estimates/slug/${encodeURIComponent(slug!)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to load estimate');
    return res.json();
  },
  retry: false,
});

if (isLoading) return <LoadingScreen />;
if (!data) return <NotFoundScreen />;
if (data.accessCode && !isUnlocked) return <AccessGate />;
```

### Pattern 4: Scroll-Snap Fullscreen Sections

Tailwind v3 includes native scroll-snap utilities. No custom CSS required.

```typescript
// Outer container
<div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-zinc-950">
  {/* Each section */}
  <section className="h-screen w-full snap-start flex items-center justify-center relative">
    {/* Subtle gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/30 to-transparent pointer-events-none" />
    {/* Content */}
    <div className="relative z-10 ...">...</div>
  </section>
</div>
```

**Key Tailwind classes:**
- `snap-y snap-mandatory` — enables vertical scroll-snap on the container
- `snap-start` — each child section snaps to the top
- `h-screen overflow-y-scroll` — container fills viewport, scrollable
- `overflow-hidden` on `<body>` is NOT needed — the container itself scrolls

### Pattern 5: Navigation Dots

Fixed-position sidebar dots. Active dot determined by tracking which section is in view via `IntersectionObserver` or manual scroll position calculation.

```typescript
// Simple approach — track active index via scroll
const [activeIndex, setActiveIndex] = useState(0);
const sectionRefs = useRef<(HTMLElement | null)[]>([]);

// Fixed dot nav on the right
<div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
  {sections.map((_, i) => (
    <button
      key={i}
      onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
      className={cn(
        "w-2 h-2 rounded-full transition-all duration-200",
        activeIndex === i ? "bg-white scale-125" : "bg-white/30 hover:bg-white/60"
      )}
    />
  ))}
</div>
```

**Recommended approach:** Use `IntersectionObserver` on each section ref — fire callback when threshold=0.5. This is reliable across touch and mouse scroll.

### Pattern 6: Access Code Gate — Client-Side Verification

The gate is shown before the viewer renders. Verification happens server-side: POST the code to a new endpoint, server compares plain text against stored `access_code`, returns 200 or 401.

```typescript
// Gate component within EstimateViewer.tsx
function AccessCodeGate({ estimateId, onUnlock }: { estimateId: number; onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { mutate: verify, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/estimates/${estimateId}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) throw new Error('Incorrect code');
      if (!res.ok) throw new Error('Verification failed');
    },
    onSuccess: () => onUnlock(),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
        {/* Logo */}
        <h1 className="text-white text-xl font-semibold">Enter access code</h1>
        <Input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          className="bg-zinc-900 border-zinc-700 text-white text-center"
          onKeyDown={(e) => e.key === 'Enter' && verify()}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button onClick={() => verify()} disabled={isPending || !code}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submit
        </Button>
      </div>
    </div>
  );
}
```

**Important:** The `access_code` field must NOT be returned by `GET /api/estimates/slug/:slug` (public endpoint). The server must redact it or return only `hasAccessCode: boolean`. This prevents clients from reading the code from the network response.

### Pattern 7: DB Schema Additions (estimates.ts)

```typescript
// In shared/schema/estimates.ts — additions

import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

// Add to estimates table definition:
// access_code: text("access_code"),   ← nullable, no default

// New table:
export const estimateViews = pgTable("estimate_views", {
  id: serial("id").primaryKey(),
  estimateId: integer("estimate_id").references(() => estimates.id).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
});

export type EstimateView = typeof estimateViews.$inferSelect;
```

### Pattern 8: listEstimates with Aggregation

```typescript
// In server/storage.ts — updated listEstimates
async listEstimates(): Promise<(Estimate & { viewCount: number; lastViewedAt: Date | null })[]> {
  const rows = await db
    .select({
      ...estimates,        // all estimate columns
      viewCount: sql<number>`count(${estimateViews.id})::int`,
      lastViewedAt: sql<Date | null>`max(${estimateViews.viewedAt})`,
    })
    .from(estimates)
    .leftJoin(estimateViews, eq(estimateViews.estimateId, estimates.id))
    .groupBy(estimates.id)
    .orderBy(desc(estimates.createdAt));
  return rows;
}
```

**Existing precedents:** `sql<number>` used at storage.ts line 997; `groupBy` used at line 1492–1495; `leftJoin` is available from drizzle-orm (same import).

### Pattern 9: POST /api/estimates/:id/view (server)

```typescript
// In server/routes/estimates.ts — addition
app.post("/api/estimates/:id/view", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ipAddress = (req.ip || req.headers['x-forwarded-for'] as string || '').toString() || null;
    await storage.recordEstimateView(id, ipAddress ?? undefined);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

No auth required — public endpoint (same as VCard view tracking).

### Pattern 10: POST /api/estimates/:id/verify-code (server)

```typescript
app.post("/api/estimates/:id/verify-code", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code } = req.body;
    const estimate = await storage.getEstimate(id);
    if (!estimate) return res.status(404).json({ message: 'Estimate not found' });
    if (!estimate.accessCode) return res.json({ success: true }); // no gate
    if (estimate.accessCode !== code) return res.status(401).json({ message: 'Incorrect code' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

### Pattern 11: Redact access_code from Public Slug Endpoint

The existing `GET /api/estimates/slug/:slug` returns the full `Estimate` row. It must be updated to strip `accessCode` from the response and instead include `hasAccessCode: boolean`.

```typescript
app.get("/api/estimates/slug/:slug", async (req, res) => {
  try {
    const estimate = await storage.getEstimateBySlug(req.params.slug);
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    // Redact access_code — never send plain text to client
    const { accessCode, ...publicEstimate } = estimate as any;
    res.json({ ...publicEstimate, hasAccessCode: Boolean(accessCode) });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

### Anti-Patterns to Avoid

- **Do NOT return `access_code` from the public slug endpoint.** The gate is only effective if the client cannot read the stored code from the network response.
- **Do NOT use bcrypt** for access codes — D-07 explicitly locks this as plain text for GHL automation readability.
- **Do NOT add CSS `scroll-behavior: smooth` globally** — only apply it per `scrollIntoView` call (dot click), not on the snap container (interferes with snap mechanics on some browsers).
- **Do NOT wrap EstimateViewer in Navbar/Footer** — the route isolation branch in App.tsx must come before the main `return` that renders the layout shell.
- **Do NOT use a counter column** on `estimates` for view tracking — D-11 mandates an event log table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-snap sections | Custom JS scroll hijacking | Tailwind `snap-y snap-mandatory` + `snap-start` | Browser-native, touch-friendly, no JS needed |
| Relative dates ("last seen 2 days ago") | Custom date formatting | `date-fns/formatDistanceToNow` | date-fns 3.6.0 already installed |
| Section intersection detection | Manual scroll event listener with position math | `IntersectionObserver` API | Built into all modern browsers |
| View count aggregation | Separate COUNT query per estimate | Drizzle `leftJoin` + `count()` in `listEstimates` | Single query, already pattern-matched in storage.ts |

---

## Common Pitfalls

### Pitfall 1: access_code Leaked to Client

**What goes wrong:** The `GET /api/estimates/slug/:slug` endpoint returns the full DB row including `access_code`. The client can read it from the network tab and bypass the gate.

**Why it happens:** Forgetting to strip the field before sending the response.

**How to avoid:** Destructure and exclude `accessCode` from the response object. Return `hasAccessCode: boolean` instead.

**Warning signs:** Network tab shows `accessCode: "20260419"` in the JSON response.

### Pitfall 2: Scroll-Snap Broken by Fixed Navbar

**What goes wrong:** If the Navbar is rendered (because the route isolation branch is missing or incorrect), it shifts the viewport and `h-screen` sections are no longer full height.

**Why it happens:** Missing `isEstimateRoute` guard in `App.tsx`, or the guard is placed after the main layout return.

**How to avoid:** The `isEstimateRoute` branch must appear before the `return` block that renders Navbar. Verify visually at `/e/any-slug` — no Navbar or Footer should appear.

### Pitfall 3: View Fired Multiple Times

**What goes wrong:** In React StrictMode (dev), effects run twice. The `hasTrackedView.current` guard prevents double-firing, but only if the guard is initialized as `false` in `useRef`.

**Why it happens:** Missing the `useRef(false)` guard, or resetting it on re-render.

**How to avoid:** Exactly replicate the VCard.tsx pattern (`useRef(false)` declared outside the effect, set to `true` before firing the mutation).

### Pitfall 4: TypeScript Error — listEstimates Return Type Mismatch

**What goes wrong:** `EstimatesSection.tsx` is typed as `useQuery<Estimate[]>` but `listEstimates` now returns `(Estimate & { viewCount: number; lastViewedAt: Date | null })[]`.

**Why it happens:** The admin component type annotation is too narrow after the storage method update.

**How to avoid:** Export a new `EstimateWithStats` type from `shared/schema/estimates.ts` and use it in `EstimatesSection.tsx`'s `useQuery<EstimateWithStats[]>`.

### Pitfall 5: estimate_views FK Cascade Not Set

**What goes wrong:** Deleting an estimate leaves orphan rows in `estimate_views`.

**Why it happens:** Drizzle FK references without `.onDelete("cascade")`.

**How to avoid:** Add `.onDelete("cascade")` to the `estimateId` FK:

```typescript
estimateId: integer("estimate_id").references(() => estimates.id, { onDelete: "cascade" }).notNull(),
```

### Pitfall 6: Scroll-Snap Container Must Be the Scrolling Element

**What goes wrong:** Applying `snap-y snap-mandatory` to a child instead of the actual scroll container causes snap to have no effect.

**Why it happens:** `snap-y` only works on the element that has `overflow-y-scroll` or `overflow-y-auto`.

**How to avoid:** The outermost viewer div must have both `snap-y snap-mandatory` and `h-screen overflow-y-scroll` on the same element.

---

## Code Examples

### Section layout skeleton

```typescript
// Source: Tailwind CSS scroll-snap utilities (verified — Tailwind v3 built-in)
<div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-zinc-950 text-white">
  {/* Cover Section */}
  <section className="h-screen w-full snap-start relative flex items-center justify-center">
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent" />
    <div className="relative z-10 text-center px-8">
      <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Proposal for</p>
      <h1 className="text-5xl font-bold">{estimate.clientName}</h1>
    </div>
  </section>

  {/* Intro Section */}
  <section className="h-screen w-full snap-start relative flex items-center justify-center">
    ...
  </section>

  {/* Service Sections */}
  {estimate.services.map((svc, i) => (
    <section key={i} className="h-screen w-full snap-start relative flex items-center justify-center">
      ...
    </section>
  ))}

  {/* Closing Section */}
  <section className="h-screen w-full snap-start relative flex items-center justify-center">
    ...
  </section>
</div>
```

### formatDistanceToNow for "last seen" badge

```typescript
// Source: date-fns 3.6.0 docs — confirmed available in project
import { formatDistanceToNow } from 'date-fns';

// In EstimatesSection.tsx list row:
{est.lastViewedAt && (
  <span className="text-xs text-muted-foreground">
    last seen {formatDistanceToNow(new Date(est.lastViewedAt), { addSuffix: true })}
  </span>
)}
```

### View count badge

```typescript
// In EstimatesSection.tsx list row (additive to existing row JSX):
<Badge variant="secondary" className="text-xs gap-1">
  <Eye className="w-3 h-3" />
  {est.viewCount ?? 0}
</Badge>
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Counter column on parent row | Event log table (`estimate_views`) | Event log chosen per D-11; allows richer future analytics without schema changes |
| bcrypt for access codes | Plain text comparison | D-07 explicitly chose plain text for GHL automation readability |
| Separate COUNT query per row in admin list | Single LEFT JOIN + GROUP BY in `listEstimates` | Matches existing sql aggregation patterns in storage.ts |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes. No external CLI tools, databases beyond the existing PostgreSQL connection, or services are required. `npm run db:push` uses the existing `DATABASE_URL` environment variable.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual QA only (CLAUDE.md: "No test framework available") |
| Config file | None |
| Quick run command | Manual browser verification |
| Full suite command | `npm run check` (TypeScript only) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EST-11 | View event recorded per page load; admin shows count + last seen | Manual | — (check DB + admin UI) | N/A |
| EST-12 | Access code gate shown when code set; correct code grants access; wrong code shows inline error | Manual | — | N/A |
| EST-13 | /e/:slug has no Navbar/Footer/ChatWidget | Manual | — (visual check) | N/A |
| EST-14 | Cover section shows client name + branding | Manual | — | N/A |
| EST-15 | Intro section present as second section | Manual | — | N/A |
| EST-16 | Each service renders as its own fullscreen section | Manual | — | N/A |
| EST-17 | Closing section appears after service sections, no CTA | Manual | — | N/A |
| EST-18 | /e/bad-slug shows graceful 404 | Manual | — | N/A |
| TypeScript | No type errors across all modified files | `npm run check` | `npm run check` | Existing |

### Sampling Rate

- **Per task commit:** `npm run check` (TypeScript compilation clean)
- **Per wave merge:** `npm run check` + manual browser smoke test of `/e/:slug`
- **Phase gate:** All 8 requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps

None — no test framework exists in this project (CLAUDE.md: "Manual QA only"). TypeScript check (`npm run check`) is the sole automated gate.

---

## Integration Points Summary

| File | Change Type | What Changes |
|------|-------------|--------------|
| `shared/schema/estimates.ts` | Modified | Add `access_code` column to `estimates` table; add `estimateViews` table; export `EstimateWithStats` type |
| `server/storage.ts` | Modified | Add `recordEstimateView()` method; update `listEstimates()` to LEFT JOIN aggregate |
| `server/routes/estimates.ts` | Modified | Add `POST /api/estimates/:id/view`; add `POST /api/estimates/:id/verify-code`; update `GET /api/estimates/slug/:slug` to redact `accessCode` |
| `client/src/App.tsx` | Modified | Add `isEstimateRoute` guard; add lazy `EstimateViewer` import; add `<Route path="/e/:slug">` in isolated branch |
| `client/src/pages/EstimateViewer.tsx` | Created | Full viewer: slug fetch, loading/404 states, access code gate, scroll-snap sections, nav dots, view tracking |
| `client/src/components/admin/EstimatesSection.tsx` | Modified | Add `access_code` field in dialog; add view count + last-seen badges in list rows; update `useQuery` type to `EstimateWithStats[]` |

---

## Sources

### Primary (HIGH confidence)

- `client/src/App.tsx` lines 115–228 — confirmed isAdminRoute/isXpotRoute/isLinksRoute/isVCardRoute isolation patterns
- `client/src/pages/VCard.tsx` lines 32–76 — confirmed useMutation + useRef(false) view tracking pattern
- `client/src/pages/PublicForm.tsx` — confirmed slug fetch + loading + 404 pattern
- `shared/schema/estimates.ts` — confirmed current estimates table; access_code and estimateViews additions documented
- `server/storage.ts` lines 80, 997, 1492–1495 — confirmed drizzle-orm imports (sql, count, groupBy) available
- `server/routes/estimates.ts` — confirmed existing endpoint structure; additions documented
- `client/src/components/admin/EstimatesSection.tsx` — confirmed existing list/dialog structure for additive changes
- Tailwind CSS v3 docs — `snap-y`, `snap-mandatory`, `snap-start` are built-in utilities (verified against Tailwind v3.4)
- date-fns 3.6.0 — `formatDistanceToNow` confirmed available (package installed)

### Secondary (MEDIUM confidence)

- `09-CONTEXT.md` D-07/D-11/D-12 decisions — plain text access code and event log table approach confirmed by project owner
- `09-DISCUSSION-LOG.md` — confirms all decisions were explicit choices, not defaults

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and in active use
- Architecture patterns: HIGH — every pattern is a direct replication of existing project code
- Pitfalls: HIGH — identified from code inspection of existing patterns and canonical anti-patterns
- DB schema additions: HIGH — FK + leftJoin patterns confirmed in existing storage.ts

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack, no fast-moving dependencies)
