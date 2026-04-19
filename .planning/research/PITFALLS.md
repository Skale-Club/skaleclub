# Pitfalls Research

**Domain:** Client-facing Proposals/Estimates System added to existing TypeScript/React + Express + Drizzle CRM
**Researched:** 2026-04-19
**Confidence:** HIGH (derived from direct codebase inspection + integration-specific analysis)

---

## Critical Pitfalls

### Pitfall 1: Estimate slug collides with existing public routes

**What goes wrong:**
The app already has a `pageSlugs` system where admins can rename routes like `/portfolio`, `/blog`, `/contact`. The `getPageSlugsValidationError` function guards against `admin` and `api` prefixes but has no awareness of `/e/`. If an admin renames a page slug to `e`, the Wouter router will match the page slug route before `/e/:slug`, silently hiding all estimate links.

**Why it happens:**
`/e/:slug` is a static prefix added as a new route. The existing `pageSlugs` validation only blocks `admin` and `api`. Nothing prevents `pageSlugs.portfolio = "e"` or similar short conflicts.

**How to avoid:**
In `getPageSlugsValidationError` (shared/pageSlugs.ts), add `"e"` and `"f"` to the reserved prefix list:
```typescript
if (value === "e" || value.startsWith("e/") || value === "f" || value.startsWith("f/")) {
  return `The slug "${value}" is reserved for estimate/form routes.`;
}
```
Also ensure the Wouter `<Route path="/e/:slug">` is registered *before* the dynamic page-slug catch-all routes in App.tsx.

**Warning signs:**
- `/e/client-name` returns a 404 or renders the wrong page while the DB row exists
- Admin page-slug editor silently accepts `e` as a valid slug

**Phase to address:**
DB schema + public route phase (the phase that adds the `estimates` table and `/e/:slug` route)

---

### Pitfall 2: JSONB snapshot diverges silently — no record of what price the client was actually quoted

**What goes wrong:**
Storing a reference FK to `portfolio_services` in the estimate line items means the rendered price/title/description on `/e/:slug` changes whenever the admin edits the service. A client who received a link at R$2,000 sees R$3,500 a week later after the admin updated the service card. This is a correctness bug: proposals are legal/commercial documents.

**Why it happens:**
FK references are simpler to model ("just reference the service"), but they conflate "catalog record" with "agreed price at time of proposal". Developers coming from a CRUD mindset default to FKs.

**How to avoid:**
Snapshot the service data into a JSONB column at estimate creation time:
```typescript
// estimate_items table
serviceSnapshot: jsonb("service_snapshot").$type<{
  title: string;
  description: string;
  price: string;       // snapshot of the original price text
  features: string[];
}>()
priceOverride: text("price_override") // nullable — populated only when admin overrides
```
The rendered price is `priceOverride ?? serviceSnapshot.price`. Store `sourceServiceId` (nullable FK) only for informational tracing, not for rendering.

**Warning signs:**
- Estimate items table has a non-nullable FK to `portfolio_services` with no snapshot column
- Price displayed on `/e/:slug` changes after saving the service in the admin

**Phase to address:**
DB schema phase — must be designed correctly before any data is inserted

---

### Pitfall 3: Price stored as text causes comparison, arithmetic, and formatting bugs

**What goes wrong:**
`portfolio_services.price` is already a `text` column (e.g. `"R$ 1.497"`, `"Sob consulta"`, `"A partir de R$2k"`). When the price override field is also free text, arithmetic (total, discount, tax) becomes impossible, sorting breaks, and currency formatting is inconsistent across locales. The proposal page may display `"R$ 1.497"` next to `"R$1497"` for the same service.

**Why it happens:**
The existing schema uses text prices because marketing copy like "From R$X/mo" cannot fit in a numeric column. Developers copy the same pattern for overrides without thinking through display normalization.

**How to avoid:**
- Keep `priceOverride` as nullable `text` — consistent with the existing pattern and v1.2 scope
- Define a single `formatEstimatePrice(raw: string): string` helper that normalizes display (strip extra spaces, enforce `R$\u00a0X.XXX` format, handle non-numeric values gracefully)
- Apply that helper everywhere the price is rendered — do NOT format inline in JSX
- Explicitly document that totals/arithmetic are out of scope for v1.2

**Warning signs:**
- Price rendered differently in the admin list vs. the public proposal page
- Attempting to do `Number(priceOverride)` anywhere in the codebase
- `parseFloat` or `parseInt` applied to price fields

**Phase to address:**
Admin UI phase (estimate editor) and public page phase — add the helper in shared utilities before rendering

---

### Pitfall 4: Scroll-snap fullscreen sections break on mobile viewport height changes

**What goes wrong:**
`scroll-snap-type: y mandatory` with `height: 100vh` sections works on desktop. On mobile, the browser chrome (URL bar) collapses and expands as the user scrolls, changing `100vh` dynamically. Sections shift, the snap point no longer aligns with the visible viewport, and users see partial content from two sections simultaneously.

**Why it happens:**
`100vh` on mobile = full viewport including browser UI, not the visual viewport. The visual viewport shrinks when the browser bar appears. CSS `dvh` (dynamic viewport height) is the correct unit but requires explicit adoption.

**How to avoid:**
Use `min-h-[100dvh]` (Tailwind) or `min-height: 100dvh` instead of `100vh` for snap sections. This resolves to the dynamic viewport height on supporting browsers (Chrome 108+, Safari 15.4+, Firefox 101+). For the proposal target audience (clients receiving a WhatsApp link on mobile), browser support is adequate.

Also add `overscroll-behavior: none` on the scroll container to prevent the page behind the snap container from scrolling on iOS.

**Warning signs:**
- Sections appear to have a gap or overlap on iPhone Safari during testing
- The final "acceptance" section is partially hidden behind the browser bar
- Testing done only on desktop

**Phase to address:**
Public proposal page phase — during initial scroll-snap implementation, not as a fix-up

---

### Pitfall 5: Scroll-snap navigation feels broken without explicit section tracking

**What goes wrong:**
With `scroll-snap-type: y mandatory`, programmatic scroll (e.g. "Next" button calls `element.scrollIntoView()`) works fine in Chrome but snaps to unexpected positions in Safari because `scrollIntoView` and scroll-snap interact differently across engines. Additionally, without tracking which section is active, there is no way to show a progress indicator or re-enable programmatic navigation.

**Why it happens:**
Developers rely on `scrollIntoView` as a cross-browser solution, but CSS scroll-snap overrides the final resting position. Safari's snap enforcement is stricter than Chrome's during programmatic scroll.

**How to avoid:**
Use `scrollTo` with `behavior: 'smooth'` on the snap container itself (not on individual sections) using calculated `top` offsets. Track the active section with an `IntersectionObserver` (threshold 0.6) — this is the canonical approach for scroll-snap progress. Do not rely on scroll event position for section detection.

```typescript
// Correct pattern
const goToSection = (index: number) => {
  containerRef.current?.scrollTo({ top: index * window.innerHeight, behavior: 'smooth' });
};
```

**Warning signs:**
- "Next" button jumps to wrong section on Safari/Firefox
- Progress dots don't update correctly as the user scrolls
- Section detection uses `scrollTop / window.innerHeight` without rounding

**Phase to address:**
Public proposal page phase — during scroll-snap implementation

---

### Pitfall 6: Auto-created estimate on form completion fires multiple times due to upsert pattern

**What goes wrong:**
The form lead endpoint uses a session-based upsert: submitting the same `sessionId` updates the existing lead rather than creating a new one. If the estimate auto-creation is triggered inside the same code path that runs on every progress update (`formCompleto = true`), the trigger fires every time the user re-submits the final question (browser back, retry, double-tap). The result is duplicate estimates for the same lead.

**Why it happens:**
`runLeadPostProcessing` already has a `notificacaoEnviada` guard for Twilio notifications. Estimate creation added to the same function without an equivalent idempotency guard will fire on every call where `formCompleto === true`.

**How to avoid:**
Add an `estimateCreated` boolean flag to `form_leads` (or add an `autoEstimateId` FK to an estimates table). Check this flag before creating the auto-estimate:

```typescript
if (lead.formCompleto && !lead.estimateCreated) {
  await createAutoEstimate(lead);
  await storage.updateFormLead(lead.id, { estimateCreated: true });
}
```

Alternatively, query for an existing estimate by `leadId` before inserting. The DB unique constraint on `leadId` provides the final safety net.

**Warning signs:**
- Multiple estimates in admin list with the same client name/phone
- Estimate auto-creation not gated by an idempotency flag
- GHL sync uses the same pattern and it already has the `ghlSyncStatus` guard — replicate this

**Phase to address:**
Automation phase (auto-estimate from form submission)

---

### Pitfall 7: Custom service rows in estimate_items break the service selector state on re-edit

**What goes wrong:**
The estimate editor mixes two item types: items sourced from `portfolio_services` (with a `sourceServiceId`) and fully custom items typed by the admin (no `sourceServiceId`, all fields manual). When loading an existing estimate for editing, the UI must reconstruct which items are "from catalog" vs "custom" to render the correct input mode. Without a discriminator field, the editor shows all items as custom text inputs, losing the service-selector UX on re-open.

**Why it happens:**
Developers think of it as "one items array" and forget that the admin UI has two distinct modes of item creation. The save payload looks the same (both write into `estimate_items` JSONB or table rows), so the difference is lost on round-trip.

**How to avoid:**
Store a `type` field in each item: `"catalog"` or `"custom"`. On load, restore the selector state based on this field. The discriminator also makes future reporting simpler (which services are most quoted).

```typescript
type EstimateItem = {
  type: "catalog" | "custom";
  sourceServiceId?: number;   // present when type === "catalog"
  serviceSnapshot: { title: string; description: string; price: string; features: string[] };
  priceOverride?: string;
  order: number;
};
```

**Warning signs:**
- Editing a saved estimate shows all items in free-text mode
- `sourceServiceId` is nullable with no discriminator field
- Item type cannot be inferred on round-trip

**Phase to address:**
Admin estimate editor phase

---

### Pitfall 8: `/e/:slug` is publicly accessible — estimate contents are not guarded

**What goes wrong:**
A proposal contains pricing information the client hasn't negotiated and competitor intelligence about service structure. With a predictable slug (e.g. `empresa-nome-2026`), anyone who knows the pattern can enumerate proposals and read confidential pricing.

**Why it happens:**
The `/f/:slug` form routes are intentionally public (anyone can fill a form). Developers copy the same "public read" pattern for `/e/:slug` without considering that estimate content is sensitive.

**How to avoid:**
- Use high-entropy slugs (UUIDs or UUID-prefixed) for estimates — not human-readable client names alone
- Or add a secondary `accessToken` query param (`/e/:slug?t=TOKEN`) that must match a stored value
- For v1.2, UUID-based slugs are the simpler choice: `uuidv4()` on creation, store in `slug` column, share full URL via WhatsApp

Do not use client name + date as slug. It is guessable and the data is commercially sensitive.

**Warning signs:**
- Slug is generated as `clientName-YYYY` or similar predictable pattern
- No access control of any kind on the `GET /api/estimates/:slug` endpoint
- Slug column is short text without entropy

**Phase to address:**
DB schema phase — slug generation strategy must be decided before the first row is inserted

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store estimate items in JSONB on the estimates row (not a separate table) | No migration for items, simpler query | Cannot query/filter by service, no per-item reporting, hard to reorder | Only if estimates are < 10 items and no reporting is ever planned |
| FK to portfolio_services instead of JSONB snapshot | Simpler schema | Proposal content changes when service is edited — correctness bug for commercial docs | Never for commercial proposals |
| Use `100vh` for scroll-snap sections | Works in Chrome dev tools | Broken on mobile Safari (most WhatsApp recipients) | Never for a mobile-first proposal page |
| Auto-create estimate slug from client name | Human-readable URL | Guessable, enumerable, sensitive data exposed | Never — use UUID |
| Price override as numeric (integer cents) | Enables arithmetic | Breaks free-text prices like "Sob consulta", requires formatting logic | Only if arithmetic (totals) is in scope |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Existing `runLeadPostProcessing` | Add estimate creation inside the function without idempotency guard | Add `estimateCreated` flag to `form_leads` and check before calling creation |
| `portfolio_services.price` (text) | Assuming price is always numeric — calling `parseFloat` on it | Treat as opaque display string; snapshot as-is; apply format normalization helper |
| Twilio SMS (existing) | Sending the estimate link in the same notification as the lead alert | Keep lead notification separate; send estimate link in a separate, dedicated message with the full `/e/:slug` URL |
| GHL sync (`ghlSyncStatus`) | Not linking estimate back to GHL contact | After auto-estimate creation, optionally attach the estimate URL as a GHL custom field — but make it best-effort, not blocking |
| Wouter routing | Registering `/e/:slug` after catch-all dynamic routes | Register static prefix routes (`/e/`, `/f/`, `/admin`) before any wildcard routes in App.tsx |
| Drizzle `db:push` on Vercel | Running migration during serverless cold start | Use Supabase session pooler (port 5432) explicitly for `db:push` — same pattern as v1.1 |
| `formLeads.sessionId` unique index | Relying on session for de-duplication across multiple visits | Session is per-browser-tab; a second device creates a second lead row — auto-estimate must de-duplicate by phone or email, not session |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all `portfolio_services` for every estimate page render | Slow public page on proposals with many services | Snapshot service data at creation — render from snapshot, no live query needed | Any number of services > 0 |
| N+1 in admin estimate list (fetching items per estimate) | Slow admin list page | Join estimate items in single query or store count in estimates row | > 20 estimates |
| `IntersectionObserver` without cleanup in React | Memory leak on route navigate away | Return cleanup function from `useEffect` that calls `observer.disconnect()` | After navigating away from proposal page |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Short human-readable estimate slug | Competitor or ex-lead enumerates proposals, reads pricing | UUID slug on creation |
| No validation that `sourceServiceId` exists before snapshotting | Ghost item with null snapshot crashes the public page | Validate FK exists at create time, reject unknown IDs |
| Admin estimate CRUD without `requireAdmin` middleware | Any user with the API URL can read/modify all estimates | Apply `requireAdmin` to all `/api/estimates` routes except `GET /api/estimates/slug/:slug` (public read with UUID guard) |
| Exposing lead `telefone`/`email` in the estimate response served to the public `/e/:slug` route | Personal data leaked to the client in the JSON response | Strip PII fields from the public estimate API response — return only display-safe fields |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scroll-snap with no visual cue of how many sections exist | Client doesn't know there is more content below the fold | Add a dot-pagination or section counter (e.g. "2 / 5") fixed to the viewport |
| "Accept" button on the final section with no confirmation state | Client taps, nothing visible happens, taps again | Show a loading spinner, then a success state ("Proposta aceita! Entraremos em contato.") — even if acceptance is not persisted in v1.2 |
| Service ordering in the estimate editor uses only drag-and-drop | Keyboard-only admins / mobile admin cannot reorder | Provide up/down arrow buttons alongside `@dnd-kit` drag handles — `@dnd-kit` already exists in this codebase |
| Admin creates estimate without previewing the public page | Ships an estimate with wrong price visible, finds out when client complains | Add a "Preview" button/link in the editor that opens `/e/:slug` in a new tab |
| Auto-estimate slug sent via WhatsApp before the estimate is fully written | Client receives an incomplete proposal | Only auto-send the WhatsApp link after the estimate has at minimum one service item and a non-null `clientName` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Estimate public page:** Scroll-snap works in desktop Chrome — verify on iOS Safari (mobile viewport height + rubber-band scroll behavior)
- [ ] **Estimate public page:** All service sections render from snapshot data — verify by editing the service in admin and reloading the proposal URL
- [ ] **Auto-estimate creation:** Fires exactly once per lead — verify by submitting the same form session twice and checking the estimates table row count
- [ ] **Slug uniqueness:** The DB has a unique index on `estimates.slug` and the API returns 409 on collision — verify by inserting the same slug twice via the API
- [ ] **Price override:** A blank `priceOverride` field falls back to `serviceSnapshot.price` — verify by saving an estimate item with override cleared
- [ ] **Admin estimate editor:** Re-opening a saved estimate restores catalog items as catalog (service selector), not as free-text custom items
- [ ] **Security:** The public `GET /api/estimates/slug/:slug` response contains no PII (no email, no telefone from the associated lead)
- [ ] **`pageSlugs` validation:** Setting a page slug to `"e"` is rejected with a validation error

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| FK reference instead of snapshot (wrong design shipped) | HIGH | Write a migration that reads current service data and backfills a `service_snapshot` column; add snapshot writes going forward; leave FK for tracing |
| Duplicate auto-estimates created | MEDIUM | Add `estimateCreated` flag via `db:push`; write a one-time dedup script (keep first, delete duplicates by `leadId`); add idempotency guard to code |
| `100vh` mobile layout broken | LOW | Replace all `h-screen`/`100vh` with `min-h-[100dvh]` in the proposal page component |
| Guessable slugs already in production | MEDIUM | Generate new UUID slugs for existing estimates; old URLs break (redirect if possible) or just notify clients of new link |
| Estimate creation not idempotent (duplicate on retry) | MEDIUM | Add unique constraint on `(leadId, createdAt::date)` or on `leadId` if one-estimate-per-lead policy; run dedup; add guard in code |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Slug collision with `pageSlugs` | Phase: DB schema + routing setup | `getPageSlugsValidationError` rejects `"e"` and `"f"` as values |
| JSONB snapshot vs FK — commercial correctness | Phase: DB schema design | Editing a portfolio service does NOT change any existing rendered estimate |
| Price text — formatting inconsistency | Phase: Admin estimate editor | Same price string renders identically in admin list and public page |
| Scroll-snap `100vh` mobile break | Phase: Public proposal page | Manual test on real iPhone Safari with URL bar visible |
| Scroll-snap programmatic navigation (Safari) | Phase: Public proposal page | "Next" button advances correctly on Safari iOS |
| Duplicate auto-estimate on form re-submit | Phase: Automation (auto-estimate from form) | Submitting form session twice creates exactly one estimate |
| Custom vs catalog item type lost on re-edit | Phase: Admin estimate editor | Reopen saved estimate: catalog items show service selector, custom items show text inputs |
| Public page exposes PII | Phase: DB schema + API design | API response for `/api/estimates/slug/:slug` contains no `telefone` or `email` |
| Guessable slug / no access control | Phase: DB schema design | Slug is UUID-based; no sequential or name-based pattern |

---

## Sources

- Direct codebase inspection: `shared/schema/forms.ts`, `shared/schema/cms.ts`, `shared/pageSlugs.ts`, `server/lib/lead-processing.ts`, `client/src/App.tsx`
- Existing `portfolio_services.price` is `text` (confirmed line 89 `shared/schema/cms.ts`)
- Existing upsert idempotency pattern (Twilio `notificacaoEnviada`, GHL `ghlSyncStatus`) — replicate for estimates
- CSS scroll-snap + `dvh` unit: MDN Web Docs (https://developer.mozilla.org/en-US/docs/Web/CSS/length/dvh), supported Chrome 108+, Safari 15.4+, Firefox 101+
- `@dnd-kit` already in package.json — no new dependency needed for drag-to-reorder
- Wouter route ordering behavior: routes match first-declared-wins

---
*Pitfalls research for: Estimates/Proposals system added to Skale Club CRM*
*Researched: 2026-04-19*
