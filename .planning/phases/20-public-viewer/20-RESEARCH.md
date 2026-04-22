# Phase 20: Public Viewer — Research

**Researched:** 2026-04-21
**Domain:** React fullscreen scroll-snap viewer, Wouter URL param routing, server-side view tracking, access code gating
**Confidence:** HIGH — all findings sourced directly from the existing codebase; no external library speculation needed

---

## Summary

Phase 20 is the final phase of v1.4. Every dependency it needs already exists in the codebase. The `presentations` table, `presentation_views` table, all storage methods, and the public slug endpoint stub are already in place from Phases 15 and 16. The EstimateViewer component (Phase 9) is the direct template for the scroll-snap layout, access code gate, view tracking pattern, and navigation dots. The only new work is: augmenting the existing `GET /api/presentations/slug/:slug` route to (a) record a view row and (b) strip `accessCode` from the response, adding a `POST /api/presentations/:id/verify-code` endpoint, building `PresentationViewer.tsx` with 8 layout-specific renderers, adding the `isPresentationRoute` guard in App.tsx, and adding translation keys.

The UI design contract (20-UI-SPEC.md) is fully resolved — no visual decision is left open for the planner. Every component, color, spacing token, and copy string is specified.

**Primary recommendation:** Build as a single plan. The component is entirely self-contained. Server changes are two targeted edits to `server/routes/presentations.ts` plus one storage call. Client is one new file plus two small edits (App.tsx, translations.ts).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-17 | `GET /api/presentations/slug/:slug` — public; validates access code if set; records view on success | Storage method `recordPresentationView` already implemented. Route stub exists but does not yet call `recordPresentationView` or strip `accessCode`. Needs: SHA-256 IP hashing before view insert, `accessCode` stripping, `hasAccessCode` boolean in response. |
| PRES-18 | `/p/:slug` route isolated from Navbar/Footer/ChatWidget via `isPresentationRoute` | `isEstimateRoute` pattern in App.tsx (line 120, 229–238) is the exact template. One new boolean + one new `if` branch needed. |
| PRES-19 | `PresentationViewer` — fullscreen scroll-snap, framer-motion per section, all 8 layout variants | EstimateViewer.tsx is the structural template. 8-layout renderer is the new work. `motion`, `IntersectionObserver`, `sectionRefs`, navigation dots patterns are all copy-adapt from EstimateViewer. |
| PRES-20 | Language switcher — `?lang=en` / `?lang=pt-BR`; field switching without page reload | Wouter `useLocation` + `navigate({ replace: true })` pattern. UI-SPEC fully specifies the component. NOT the global `LanguageToggle`; reads URL param only. |
| PRES-21 | Access code gate — code-entry form before slides reveal | `AccessCodeGate` in EstimateViewer is the template. Presentations needs its own `POST /api/presentations/:id/verify-code` endpoint (does not exist yet). |
| PRES-22 | Admin Presentations list shows view count badge per presentation | `listPresentations()` already returns `viewCount` from a `LEFT JOIN` + `count()` query. The admin `PresentationsSection.tsx` (Phase 19) already renders this. Verify the badge renders correctly after Phase 20 wires up view recording. |
</phase_requirements>

---

## Standard Stack

### Core (already installed — zero new dependencies)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| React | 18.3.1 | Component rendering | package.json |
| framer-motion | 11.18.2 | Slide entrance animations | package.json |
| wouter | 3.3.5 | URL param + location hook for `?lang=` param | package.json |
| @tanstack/react-query | 5.60.5 | `useQuery` for slug fetch, `useMutation` for view/verify | package.json |
| shadcn/ui Button + Input | installed | AccessCodeGate form | components.json (new-york) |
| lucide-react | installed | `Loader2` via `@/components/ui/loader` wrapper | existing codebase |
| Node.js `crypto` | built-in | SHA-256 IP hashing on server | Node.js standard library |

**No new npm installs required.** All dependencies are pre-existing.

### Alternatives Considered

| Standard choice | Alternative | Why standard wins |
|-----------------|-------------|-------------------|
| Wouter `useLocation` for `?lang=` state | `useState` + prop drilling | URL param persists on share/refresh; no re-mount on language switch |
| `useRef(false)` guard for view tracking | `useEffect` dependency flag | Ref avoids triggering re-renders; exact EstimateViewer pattern |
| `isPresentationRoute` as boolean in Router | Nested Wouter `<Router>` | Boolean guard matches all existing isolation patterns (isEstimateRoute, isLinksRoute, etc.) |

---

## Architecture Patterns

### Recommended File Structure

```
client/src/pages/
└── PresentationViewer.tsx   # New — full viewer (create)

client/src/
└── App.tsx                  # Modify — add isPresentationRoute guard + /p/:slug route

server/routes/
└── presentations.ts         # Modify — update slug endpoint + add verify-code endpoint

client/src/lib/
└── translations.ts          # Modify — add Phase 20 PT translation keys
```

### Pattern 1: isPresentationRoute Guard in App.tsx

**What:** Boolean derived from `location.startsWith('/p/')` used as a routing branch that skips Navbar/Footer/ChatWidget.
**When to use:** Matches the `isEstimateRoute` pattern already in place at line 120 and used at line 229.

```typescript
// In Router() function — add after existing isEstimateRoute declaration (line 120):
const isPresentationRoute = location.startsWith('/p/');

// Add new branch — parallel to isEstimateRoute branch (after line 238):
if (isPresentationRoute) {
  return (
    <Suspense fallback={fallback}>
      <Switch>
        <Route path="/p/:slug" component={PresentationViewer} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

Lazy import added alongside other page lazy imports:
```typescript
const PresentationViewer = lazy(() =>
  import("@/pages/PresentationViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> }))
);
```

### Pattern 2: Server Slug Endpoint — View Recording + Access Code Stripping

**What:** The existing stub at `GET /api/presentations/slug/:slug` in `server/routes/presentations.ts` does not yet record views or strip `accessCode`. It needs to be extended.

**Current state (line 9–17 of presentations.ts):**
```typescript
app.get("/api/presentations/slug/:slug", async (req, res) => {
  const presentation = await storage.getPresentationBySlug(req.params.slug);
  if (!presentation) return res.status(404).json({ message: "Presentation not found" });
  res.json(presentation);  // BUG: exposes accessCode, does not record view
});
```

**Required final state:**
```typescript
app.get("/api/presentations/slug/:slug", async (req, res) => {
  try {
    const presentation = await storage.getPresentationBySlug(req.params.slug);
    if (!presentation) return res.status(404).json({ message: "Presentation not found" });

    // Access code gating — validate if provided, reject if wrong, allow if gate is not set
    if (presentation.accessCode) {
      const { code } = req.query as { code?: string };
      if (!code) {
        // No code supplied — return hasAccessCode flag without slides
        const { accessCode, ...safe } = presentation as any;
        return res.json({ ...safe, slides: [], hasAccessCode: true });
      }
      if (code !== presentation.accessCode) {
        return res.status(401).json({ message: "Incorrect code" });
      }
    }

    // Record view — SHA-256 hash IP per PRES-02 ip_hash column intent
    const rawIp = ((req.headers['x-forwarded-for'] as string) || req.ip || '').toString();
    const ipHash = rawIp
      ? crypto.createHash('sha256').update(rawIp).digest('hex')
      : undefined;
    await storage.recordPresentationView(presentation.id, ipHash);

    // Strip accessCode before returning — never expose to public client
    const { accessCode, ...publicPresentation } = presentation as any;
    res.json({ ...publicPresentation, hasAccessCode: Boolean(accessCode) });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

**IMPORTANT design decision the planner must choose:** The UI-SPEC specifies an `AccessCodeGate` that verifies via a separate `POST /api/presentations/:id/verify-code` endpoint (mirroring EstimateViewer). This means the slug endpoint should return `hasAccessCode: true` with empty slides when a gate is set and no code is supplied — then after gate verification, the client re-fetches with the code, or the gate calls a separate verify endpoint.

The EstimateViewer pattern uses a completely separate verify endpoint (`POST /api/estimates/:id/verify-code`) and re-fetches the public endpoint after unlock. The view is tracked via a separate `POST /api/estimates/:id/view` call from the client.

**Two viable approaches — planner must pick one:**

| Approach | Server | Client | Notes |
|----------|--------|--------|-------|
| A: Separate verify + view endpoints (mirrors EstimateViewer exactly) | Add `POST /api/presentations/:id/verify-code` and keep view tracking as client-side `POST` after unlock | Gate calls verify, then parent state sets `isUnlocked`, `useEffect` fires view POST | Cleanest symmetry with EstimateViewer |
| B: Inline access code in slug GET (query param `?code=`) | Slug endpoint validates code, records view, returns full slides | Gate submits code, refetches slug with `?code=xxx` query param | Fewer endpoints, but non-standard REST pattern for verification |

**Recommendation:** Approach A. Symmetry with EstimateViewer is the project pattern. `POST /api/presentations/:id/verify-code` is a 10-line addition.

### Pattern 3: PresentationViewer Component Structure

Mirrors EstimateViewer with these additions:
- Language switcher state from `?lang=` URL param
- 8 layout-variant renderer (new — no equivalent in EstimateViewer)
- `IntersectionObserver` for active slide tracking (already in EstimateViewer)
- `sectionRefs` array (already in EstimateViewer)

```typescript
// Language param derivation (no global context — URL only)
const [location, navigate] = useLocation();
const searchParams = new URLSearchParams(location.split('?')[1] || '');
const lang = searchParams.get('lang') === 'pt-BR' ? 'pt-BR' : 'en';

// Language switch handler — replace: true prevents back-button spam
function switchLang(newLang: 'en' | 'pt-BR') {
  const params = new URLSearchParams(location.split('?')[1] || '');
  if (newLang === 'en') params.delete('lang');
  else params.set('lang', 'pt-BR');
  const newSearch = params.toString();
  navigate(location.split('?')[0] + (newSearch ? `?${newSearch}` : ''), { replace: true });
}
```

**Bilingual field resolution (from UI-SPEC):**
```typescript
function resolveField(en?: string, pt?: string, lang: string): string {
  if (lang === 'pt-BR') return pt || en || '';
  return en || '';
}
```

### Pattern 4: 8 Layout Variant Renderer

Each layout shares the same `<section>` wrapper and framer-motion animation. Only the inner JSX differs.

```typescript
function SlideContent({ slide, lang }: { slide: SlideBlock; lang: string }) {
  const heading = resolveField(slide.heading, slide.headingPt, lang);
  const body = resolveField(slide.body, slide.bodyPt, lang);
  const bullets = lang === 'pt-BR'
    ? (slide.bulletsPt?.length ? slide.bulletsPt : slide.bullets)
    : slide.bullets;

  switch (slide.layout) {
    case 'cover': return <CoverSlide heading={heading} body={body} />;
    case 'section-break': return <SectionBreakSlide heading={heading} body={body} />;
    case 'title-body': return <TitleBodySlide heading={heading} body={body} />;
    case 'bullets': return <BulletsSlide heading={heading} bullets={bullets} />;
    case 'stats': return <StatsSlide heading={heading} stats={slide.stats} lang={lang} />;
    case 'two-column': return <TwoColumnSlide heading={heading} body={body} />;
    case 'image-focus': return <ImageFocusSlide heading={heading} body={body} />;
    case 'closing': return <ClosingSlide heading={heading} body={body} />;
  }
}
```

Inner components co-located in `PresentationViewer.tsx` (file should stay under 600 lines per CLAUDE.md — estimated ~450 lines with all 8 layouts).

### Anti-Patterns to Avoid

- **Exposing `accessCode` in public response:** The raw `accessCode` field from the DB must never reach the client. Strip it and replace with `hasAccessCode: boolean`. (Same as estimate pattern.)
- **Storing raw IP in `ip_hash` column:** The `presentation_views.ip_hash` column is named for SHA-256 output. Use `crypto.createHash('sha256').update(rawIp).digest('hex')`. The estimates table uses `ip_address` (raw) — presentations schema is intentionally different per STATE.md decision.
- **Using global `LanguageToggle` component:** That component is wired to `useTranslation()` context (site-wide language state). PresentationViewer must NOT use it — language state is URL-param only, isolated to the viewer.
- **Calling `Number(req.params.id)` for presentation IDs:** Presentation IDs are UUIDs (strings). Calling `Number()` will return `NaN`. Use `req.params.id` directly as a string.
- **Placing `/p/:slug` inside the default Router branch:** The default branch renders Navbar + Footer + ChatWidget. The `isPresentationRoute` guard branch must come BEFORE the default `return` in the Router function.
- **framer-motion `viewport={{ once: false }}`:** Use `once: true` to prevent re-animation on scroll-back (per UI-SPEC and existing EstimateViewer pattern).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-snap fullscreen sections | CSS `overflow: hidden` + JS scroll hijack | Tailwind `snap-y snap-mandatory` + `snap-start` on sections | Native CSS scroll-snap is already proven in EstimateViewer; no JS scroll management needed |
| Animated slide entrance | CSS transitions + keyframes | framer-motion `whileInView` | Already a project dependency; `viewport={{ once: true }}` handles intersection detection internally |
| Language param state | `useState` in parent + Context Provider | `useLocation` URL param read | URL param survives page share, browser refresh, and direct link; no Context setup needed |
| Active nav dot tracking | `scroll` event listener + position math | `IntersectionObserver` with `threshold: 0.5` | Exact EstimateViewer pattern; handles snap correctly; self-cleans via `observer.disconnect()` |
| IP anonymization | Partial IP masking (first 3 octets) | `crypto.createHash('sha256')` | One-way SHA-256 is standard for GDPR-safe analytics; matches column name intent |

---

## Common Pitfalls

### Pitfall 1: `accessCode` Leaked to Client
**What goes wrong:** The `getPresentationBySlug` storage method returns the full `Presentation` object including `accessCode`. If the route handler simply calls `res.json(presentation)`, the raw access code is sent to every visitor — bypassing the gate entirely.
**Why it happens:** The storage method returns the DB row verbatim. The stripping is the route's responsibility.
**How to avoid:** Destructure `{ accessCode, ...rest }` before sending, add `hasAccessCode: Boolean(accessCode)`.
**Warning signs:** Browser DevTools Network tab shows `"accessCode": "somestring"` in response body.

### Pitfall 2: View Recorded Before Gate Is Passed
**What goes wrong:** If `recordPresentationView` is called in the slug endpoint before access code validation, every visitor (including failed gate attempts) increments the view count.
**Why it happens:** Naive "always record on fetch" logic.
**How to avoid:** Only call `recordPresentationView` after the access code has been validated (or if there is no gate). In Approach A (separate verify endpoint), the client calls a `POST /api/presentations/:id/view` after the gate is passed and `isUnlocked` becomes true.
**Warning signs:** View count increments when entering wrong access codes.

### Pitfall 3: Presentation Route Falls Through to Default Layout Branch
**What goes wrong:** If `isPresentationRoute` check is added after the default `return` statement, `/p/:slug` will render with Navbar, Footer, and ChatWidget visible.
**Why it happens:** JavaScript short-circuit evaluation — the default branch returns before `isPresentationRoute` is checked.
**How to avoid:** Insert the `if (isPresentationRoute)` block immediately after `if (isEstimateRoute)` — both must be BEFORE the final default `return`.
**Warning signs:** Navbar appears on `/p/some-slug`.

### Pitfall 4: Language Switch Resets Scroll Position
**What goes wrong:** If `navigate` is called without `{ replace: true }`, Wouter adds a new history entry; the browser may scroll back to top on history push.
**Why it happens:** Default `navigate` pushes to history stack, which some browsers treat as a new page load.
**How to avoid:** Always use `navigate(path, { replace: true })` for language switcher. Also avoid triggering a full component re-mount — the component reads `lang` from `useLocation` so it re-renders reactively without unmounting.
**Warning signs:** Scroll jumps to top when switching language mid-deck.

### Pitfall 5: `stats` Layout — Missing `labelPt` Fallback
**What goes wrong:** The `stats` array items have `label`, `value`, and optional `labelPt`. If `labelPt` is undefined and lang is `pt-BR`, rendering `stat.labelPt` will render `undefined` as empty string — which is fine — but if code does `stat.labelPt!` with a non-null assertion, it throws.
**Why it happens:** TypeScript optional field accessed without null guard.
**How to avoid:** Always use `stat.labelPt || stat.label` when lang is `pt-BR`.

### Pitfall 6: `image-focus` Layout — Missing `imageUrl` Field in SlideBlock Schema
**What goes wrong:** The `image-focus` layout needs an image URL to fill the upper half of the section. The current `slideBlockSchema` in `shared/schema/presentations.ts` does not include an `imageUrl` field.
**Why it happens:** Schema was designed for text-first layouts; image support was not added in Phase 15-18.
**How to avoid:** Either add `imageUrl: z.string().url().optional()` to `slideBlockSchema`, or render `image-focus` with a solid zinc-800 placeholder when no `imageUrl` is present. The planner must decide — **adding to the schema requires a `PUT /api/presentations/:id` save to take effect on existing slides**.
**Recommendation:** Render graceful fallback (zinc-800 background) when `imageUrl` is absent. Defer schema extension to a follow-up. This keeps Phase 20 scoped to the 6 PRES requirements without a schema migration.

---

## Code Examples

### View Tracking Pattern (from EstimateViewer.tsx — exact template)

```typescript
// Source: client/src/pages/EstimateViewer.tsx lines 88–111
const hasTrackedView = useRef(false);

const { mutate: trackView } = useMutation({
  mutationFn: async () => {
    await fetch(`/api/presentations/${data!.id}/view`, { method: 'POST' });
  },
});

useEffect(() => {
  if (data && (!data.hasAccessCode || isUnlocked) && !hasTrackedView.current) {
    hasTrackedView.current = true;
    trackView();
  }
}, [data, isUnlocked]);
```

### IntersectionObserver for Active Slide (from EstimateViewer.tsx)

```typescript
// Source: client/src/pages/EstimateViewer.tsx lines 113–132
useEffect(() => {
  const refs = sectionRefs.current.slice(0, data.slides.length);
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = refs.indexOf(entry.target as HTMLElement);
          if (idx !== -1) setActiveIndex(idx);
        }
      });
    },
    { threshold: 0.5 }
  );
  refs.forEach((ref) => { if (ref) observer.observe(ref); });
  return () => observer.disconnect();
}, [data, isUnlocked]);
```

### Scroll-snap Container (from EstimateViewer.tsx)

```typescript
// Source: client/src/pages/EstimateViewer.tsx line 159
<div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-zinc-950 text-white">
  {/* each section: className="h-screen w-full snap-start relative flex items-center justify-center" */}
```

### framer-motion Slide Animation (from EstimateViewer.tsx)

```typescript
// Source: client/src/pages/EstimateViewer.tsx lines 147–152
const contentAnimation = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
  viewport: { once: true },
};
// Usage: <motion.div {...contentAnimation} className="relative z-10 px-8 max-w-xl mx-auto w-full">
```

### Wouter Location for URL Param Reading

```typescript
// Source: wouter docs + App.tsx pattern
import { useLocation } from 'wouter';

const [location, navigate] = useLocation();
// Parse search params from location string (Wouter includes full path+search)
const searchParams = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
const lang = searchParams.get('lang') === 'pt-BR' ? 'pt-BR' : 'en';
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 20 |
|--------------|------------------|---------------------|
| Custom scroll hijacking | CSS `snap-y snap-mandatory` | Already proven in EstimateViewer — direct reuse |
| Raw IP storage in analytics | SHA-256 hash | `ip_hash` column name signals this intent; must hash before insert |
| Global language context for all pages | URL-param isolation per route | PresentationViewer must NOT use global LanguageProvider — URL-only |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 20 is entirely code changes to an existing Express + React codebase. No new external dependencies, runtimes, databases, or CLI tools are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (if configured) |
| Config file | Check for `vitest.config.*` — not found in project; no test suite exists |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run check` |

No automated test suite exists in this project. All validation is manual + TypeScript compile-time.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PRES-17 | Slug endpoint records view + strips accessCode | manual | `npm run check` | Verify via curl + DB query |
| PRES-18 | `/p/:slug` has no Navbar/Footer/ChatWidget | manual | `npm run check` | Browser DevTools inspection |
| PRES-19 | All 8 layout variants render without blank sections | manual | `npm run check` | Browser scroll through all layouts |
| PRES-20 | Language switch changes slide fields without page reload | manual | `npm run check` | Browser URL param toggle |
| PRES-21 | Access code gate shows before slides; wrong code shows error | manual | `npm run check` | Manual gate interaction |
| PRES-22 | Admin view count badge increments after viewer load | manual | `npm run check` | Admin panel reload after visiting /p/:slug |

### Wave 0 Gaps

None — no test infrastructure is expected for this project. TypeScript type checking (`npm run check`) is the automated gate.

---

## Open Questions

1. **Verify-code endpoint approach (Approach A vs B)**
   - What we know: EstimateViewer uses a separate `POST /api/estimates/:id/verify-code` endpoint + client-side view tracking POST.
   - What's unclear: Whether to exactly mirror this (A) or use inline query param on the slug GET (B).
   - Recommendation: Approach A. Add `POST /api/presentations/:id/verify-code` and a separate `POST /api/presentations/:id/view` endpoint. Exact symmetry with Phase 9 pattern.

2. **`image-focus` layout without `imageUrl` in schema**
   - What we know: `slideBlockSchema` has no `imageUrl` field. The layout renderer needs to handle missing images gracefully.
   - What's unclear: Whether to add `imageUrl` to the schema now or defer.
   - Recommendation: Render a zinc-800 solid background as fallback. Add `imageUrl` via a future PUT without breaking existing slides. Adding it to the schema in Phase 20 is safe (`.optional()`) but requires no migration since it's purely additive.

3. **View tracking: inline in slug GET or separate client-side POST?**
   - Connected to question 1 above.
   - Recommendation: Use a dedicated `POST /api/presentations/:id/view` endpoint triggered from the client (same as estimates). This separates the GET (return data) from the POST (side effect) cleanly and matches REST conventions.

---

## Sources

### Primary (HIGH confidence)
- `client/src/pages/EstimateViewer.tsx` — scroll-snap pattern, access gate, view tracking, nav dots, framer-motion usage
- `client/src/App.tsx` — `isEstimateRoute` guard pattern, lazy import pattern, Router branch structure
- `server/routes/presentations.ts` — existing slug stub, route registration pattern
- `server/routes/estimates.ts` — `verify-code` endpoint pattern, IP extraction pattern
- `server/storage.ts` — `recordPresentationView` signature (accepts `ipHash?: string`), `listPresentations` with derived `viewCount`
- `shared/schema/presentations.ts` — `SlideBlock` type, 8 layout variants, bilingual fields, `Presentation` type shape
- `.planning/phases/20-public-viewer/20-UI-SPEC.md` — complete visual contract, spacing, copy strings

### Secondary (MEDIUM confidence)
- `client/src/lib/translations.ts` — confirmed no Phase 20 keys exist yet; Phase 19 keys present as structural reference

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 20 |
|-----------|-------------------|
| **Translation rule**: Always add PT static translations to `client/src/lib/translations.ts` when introducing new `t()` strings | PresentationViewer uses hardcoded English copy (no `t()` call) per EstimateViewer precedent — EstimateViewer itself never calls `t()`. UI-SPEC specifies copy strings. If `t()` is added, translations.ts MUST be updated simultaneously. |
| **Border styling rule**: Never solid black/white borders; use `--border` token via `border` class | AccessCodeGate Input uses `border-zinc-700` (not solid black/white) — compliant per EstimateViewer precedent. |
| **Admin design system**: GlobalSectionHeader, AdminCard, etc. | Not applicable — PresentationViewer is a public page, not admin UI. |
| **Max 600 lines/file** | PresentationViewer.tsx estimated at ~400–450 lines with all 8 layout variants co-located. Within limit. If it exceeds 600 lines, extract layout renderers to a separate `PresentationLayouts.tsx`. |
| **Fonts**: `font-family: 'Outfit', sans-serif` for headings (NOT `font-display` CSS var) | Slide headings in PresentationViewer must use `style={{ fontFamily: "'Outfit', sans-serif" }}` or a Tailwind utility, not `font-display`. UI-SPEC documents this explicitly. |
| **CTA Buttons**: Brand Yellow `#FFFF01`, black bold text, pill-shaped | AccessCodeGate "Unlock Presentation" button: `bg-[#FFFF01] text-black font-bold rounded-full w-full`. |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as existing project dependencies
- Architecture: HIGH — patterns sourced directly from EstimateViewer.tsx and App.tsx (same codebase)
- Server changes: HIGH — routes/storage methods all pre-exist; the work is completing stubs
- Pitfalls: HIGH — sourced from identical Phase 9 decisions in STATE.md and direct code inspection
- `image-focus` layout: MEDIUM — schema gap is real; graceful fallback is a judgment call the planner must confirm

**Research date:** 2026-04-21
**Valid until:** Indefinite — findings are from the local codebase, not external sources
