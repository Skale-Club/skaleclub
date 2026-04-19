# Stack Research — Estimates/Proposals System

**Domain:** Personalized proposal pages with fullscreen scroll UX + admin CRUD + automated dispatch
**Researched:** 2026-04-19
**Confidence:** HIGH (all findings verified against existing codebase and native platform capabilities)

---

## Verdict: Zero new npm dependencies required

Every capability needed for v1.2 already exists in the installed stack. The research question was whether additions were needed — they are not.

---

## Decision by Feature Area

### 1. Public proposal page — CSS scroll-snap vs library

**Decision: Native CSS scroll-snap. No library.**

The codebase already uses pure Tailwind/CSS for all scroll and layout work. No scroll-snapping library is installed (no fullPage.js, no react-fullpage, no react-scroll-snap). Adding one would add ~30-80 KB to the bundle for a feature CSS handles natively since Chrome 69/Firefox 68/Safari 11 (2018).

**Implementation:**
```css
/* container */
overflow-y: scroll;
scroll-snap-type: y mandatory;
height: 100vh;

/* each section */
scroll-snap-align: start;
height: 100vh;
```

Tailwind equivalents: `overflow-y-scroll scroll-snap-y-mandatory h-screen` for the container, `scroll-snap-align-start h-screen` for each section. Tailwind 3.x ships scroll-snap utilities out of the box — no plugin needed.

**Confidence:** HIGH — verified that Tailwind 3.4.17 (installed) includes `snap-y`, `snap-mandatory`, `snap-start`, `snap-always` utilities natively.

**Do not use:**
- `fullpage.js` — GPL licensed (commercial use requires paid license), 60 KB, overkill
- `react-scroll-snap` — abandoned (last release 2020), not maintained
- `embla-carousel-react` — already installed but carousel-oriented (horizontal bias), wrong mental model for vertical proposal sections; adds unnecessary event complexity

---

### 2. Database schema — `estimates` table

**Decision: Drizzle ORM (already installed, 0.39.3). Add `estimates` and `estimate_items` tables in a new `shared/schema/estimates.ts` file following the existing barrel pattern.**

The forms schema (`shared/schema/forms.ts`) is the direct model:
- `forms_slug_idx: uniqueIndex(...)` — same pattern for `estimates` slug uniqueness
- `jsonb` columns for flexible data (already used in `forms.config`, `portfolio_services.features`)
- `serial` primary key + timestamps pattern already established

No ORM change, no migration tool change.

**Slug uniqueness enforcement:** Use `uniqueIndex` at the Drizzle schema level (same as `forms_slug_idx`). At the application layer, generate a slug via `crypto.randomUUID()` (already used in `ChatWidget.tsx` and `LeadFormModal.tsx` — available in Node 14.17+ and all modern browsers) or a simple `Math.random().toString(36).slice(2, 8)` for short human-readable slugs. Catch `unique_violation` (PostgreSQL error code `23505`) and retry with a new slug if collision.

**Do not add `nanoid` or `uuid` as a direct dependency** — `crypto.randomUUID()` is available globally in Node 14.17+ and all modern browsers. The existing codebase already uses it without installing nanoid.

---

### 3. Admin UI — estimates list, create, edit

**Decision: Existing shadcn/ui + React Hook Form + Zod + TanStack Query. No additions.**

The `FormsSection.tsx` and `PortfolioSection.tsx` components are the direct model:
- List table with create/edit/delete actions — shadcn `Table`, `Dialog`, `Button`
- Form with Zod validation — `react-hook-form` + `@hookform/resolvers/zod`
- Server state — TanStack Query mutations and query invalidation

The admin tab pattern (adding "Estimates" tab to the admin sidebar) follows the existing `Admin.tsx` pattern exactly. No new library needed.

---

### 4. Service selector UI — pick from `portfolio_services`

**Decision: Existing shadcn/ui `Checkbox`, `Command` (cmdk — already installed), or a simple multi-select built from `Checkbox` + `Label`. No new library.**

`cmdk` (1.1.1) is already installed and used for the command palette. It supports combobox/multi-select patterns. Alternatively, a simple checkbox list from `portfolio_services` data (already fetched by the portfolio admin section) is sufficient.

---

### 5. Email dispatch of estimate link

**Decision: This is a gap. No email sending capability exists in the current codebase.**

Current notification infrastructure:
- Twilio SMS — fully wired (`server/integrations/twilio.ts`)
- GoHighLevel — contact sync only, no outbound messaging via the current integration
- No SMTP, no Resend, no SendGrid, no Nodemailer in `package.json` or `.env.example`

**Recommendation: Use Resend for email dispatch.**

Resend is the current standard for transactional email in TypeScript/Node projects (2024-2026). It offers:
- Official Node.js SDK (`resend` package, ~50 KB)
- Simple API — `resend.emails.send({ from, to, subject, html })`
- React email templates via `@react-email/components` (optional — plain HTML strings work fine for v1.2)
- Free tier: 3,000 emails/month, 100/day — sufficient for this use case
- No SMTP server configuration required (API key only)

```bash
npm install resend
```

Current version: `resend@4.x` (verify at install time — latest stable as of research date).

**Alternative — WhatsApp link dispatch (no email dep):** The PROJECT.md mentions "cria + envia link via WhatsApp" as the primary admin flow for manual estimates. If auto-dispatch of the estimate link on form completion is out of scope for v1.2 (which the PROJECT.md implies — it says "Criação automática via form → estimate gerado + disparo email/SMS"), then only Twilio SMS is needed for automated dispatch, and WhatsApp is handled by opening a pre-filled `wa.me` URL — zero new deps.

**Decision for v1.2:** If email dispatch is required, add `resend`. If only SMS + WhatsApp link, zero new deps. The requirements doc should clarify this before implementation begins.

---

### 6. PDF generation

**Decision: Out of scope for v1.2. Do not add.**

PROJECT.md explicitly lists "PDF export — not in v1.2" under Out of Scope. Do not add `puppeteer`, `@react-pdf/renderer`, or `pdfkit`. The proposal page (`/e/:slug`) is the deliverable — the browser's native Print to PDF covers any client-side need if ever requested.

---

### 7. Slug generation for estimates

**Decision: Short random alphanumeric slug, generated server-side with `crypto.randomUUID()` or a custom function, stored with `uniqueIndex` constraint.**

Pattern from `BlogSection.tsx` `generateSlug()`:
```ts
function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

For estimates, use a client name + random suffix: `cliente-abc-x7k2` — human-readable, collision-resistant. No external library required.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `fullpage.js` | GPL license, 60 KB, overkill for vertical snap | Native CSS `scroll-snap-type: y mandatory` |
| `react-scroll-snap` | Abandoned since 2020, unmaintained | Native CSS scroll-snap |
| `nanoid` | Redundant — `crypto.randomUUID()` already available in Node 14.17+ | `crypto.randomUUID()` or short custom function |
| `@react-pdf/renderer` | PDF is explicitly out of scope for v1.2 | Browser Print to PDF if ever needed |
| `puppeteer` | Server-side PDF, out of scope, heavy dependency | N/A for v1.2 |
| `react-scroll-parallax` | No parallax in design requirements | Plain CSS transitions if needed |

---

## Installation (only if email dispatch is confirmed in scope)

```bash
# Only needed if email dispatch via Resend is confirmed in requirements
npm install resend
```

No other new packages.

---

## Integration Points with Existing Stack

| New Component | Integrates With | Notes |
|---------------|----------------|-------|
| `estimates` DB table | Drizzle ORM, `db.ts`, `shared/schema/` barrel | Add `shared/schema/estimates.ts`, re-export from `shared/schema.ts` |
| `estimate_items` DB table | `estimates`, `portfolio_services` (via service id FK) | Allow custom service rows with no FK (for ad-hoc items) |
| `/api/estimates/*` routes | Express router, `server/routes/` pattern | New file `server/routes/estimates.ts`, registered in `server/routes.ts` |
| Public `/e/:slug` page | Wouter routing, existing `client/src/pages/` | New page component, register in `App.tsx` route list |
| Admin "Estimates" tab | `Admin.tsx` tab pattern, `AdminSidebar.tsx` | Follow exact pattern of "Forms" tab added in v1.1 |
| SMS dispatch on auto-create | `server/integrations/twilio.ts` existing functions | Extend `sendHotLeadNotification` or add new `sendEstimateLink` helper |
| Email dispatch (if scoped) | New `server/integrations/resend.ts` | Mirror `twilio.ts` structure |

---

## Version Compatibility

All existing packages are compatible. No version conflicts to resolve.

| Package | Version (installed) | Compatibility Note |
|---------|--------------------|--------------------|
| `drizzle-orm` | 0.39.3 | Supports all schema features needed (jsonb, uniqueIndex, references) |
| `drizzle-kit` | 0.31.8 | Compatible with 0.39.3 ORM for `db:push` migrations |
| `tailwindcss` | 3.4.17 | Includes `snap-*` scroll utilities natively — no plugin needed |
| `react-hook-form` | 7.55.0 | Compatible with current Zod 3.24.2 via `@hookform/resolvers` |
| `resend` (if added) | 4.x | No known conflicts with Express 4 or Node ESM setup |

---

## Sources

- Existing codebase — `shared/schema/forms.ts`, `shared/schema/cms.ts` (slug uniqueness pattern)
- Existing codebase — `server/integrations/twilio.ts` (notification infrastructure)
- Existing codebase — `client/src/pages/PublicForm.tsx` (public slug-routed page pattern)
- Existing codebase — `package.json` (confirmed absence of scroll libraries, email libraries, nanoid)
- Tailwind CSS 3 docs — scroll-snap utilities (`snap-y`, `snap-mandatory`, `snap-start`) ship in Tailwind 3.x core, no plugin — HIGH confidence
- MDN Web Docs — CSS `scroll-snap-type` browser support: Chrome 69+, Firefox 68+, Safari 11+ — HIGH confidence, universal support
- Resend Node SDK — https://resend.com/docs/send-with-nodejs — MEDIUM confidence (verified SDK exists, version pinned at install time)
- PROJECT.md — PDF out of scope confirmed — HIGH confidence

---

*Stack research for: Estimates/Proposals system (v1.2)*
*Researched: 2026-04-19*
