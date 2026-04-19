# Feature Research

**Domain:** Client-facing proposal/estimate viewer system (B2B services)
**Researched:** 2026-04-19
**Confidence:** MEDIUM — Based on training knowledge of Proposify, PandaDoc, HoneyBook, Qwilr, Better Proposals (cutoff Aug 2025). WebSearch unavailable. Patterns are well-established and stable.

---

## Context: What This System Is

This is not a full proposal platform (no e-sign, no contract management, no negotiation). It is a **personalized service presentation layer** — admin creates an estimate for a specific prospect, picks services from the `portfolio_services` catalog with optional price overrides, and the prospect receives a public link (`/e/:slug`) with a polished immersive viewer.

The viewer uses a fullscreen scroll-snap layout: cover section → Skale Club brand presentation → one section per service → final acceptance CTA.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a prospect or admin would expect to be present. Missing any of these makes the product feel broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Personalized recipient name/company on cover | Every decent proposal is addressed to someone — "Proposta para Acme Corp" | LOW | Store `clientName` + `clientCompany` on estimate record |
| Service line items with title, description, price | Core content — what am I buying and what does it cost? | LOW | Pull from `portfolio_services`, allow price override per estimate |
| Custom slug (`/e/acme-corp-2026`) | Clean shareable URL the admin can send via WhatsApp | LOW | Already in scope — `slug` column on estimates table |
| Total price summary | Prospect must see what they're agreeing to spend | LOW | Computed from line items; visible on acceptance section |
| Mobile-responsive viewer | Prospects open links on phone — if it breaks on mobile, the proposal fails | MEDIUM | Scroll-snap fullscreen works well on mobile if implemented carefully |
| Cover section with Skale Club branding | Sets professional tone before content begins | LOW | Static brand assets, already owned |
| Acceptance CTA section | Clear next step — "I'm interested, contact me" button | LOW | No signature needed in v1; just a prominent CTA |
| Admin list view of estimates | Admin needs to see all estimates, statuses, links | LOW | Standard CRUD list with slug + client name + date |
| Create/edit estimate in admin | Admin must be able to build and update proposals | MEDIUM | Form picking services from `portfolio_services` + custom line items |
| Estimate not found / expired state | Bad or unknown slug must show a graceful page, not a blank error | LOW | Match pattern from `/f/:slug` in `PublicForm.tsx` |

### Differentiators (Competitive Advantage)

Features that elevate this above a PDF or a simple pricing table sent via email.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Immersive scroll-snap viewer (`/e/:slug`) | Feels like a premium web experience — each service gets its own fullscreen moment | MEDIUM | Core differentiator. Use CSS `scroll-snap-type: y mandatory` with `scroll-snap-align: start` on each section. framer-motion already in stack for entrance animations |
| Skale Club brand presentation section | Builds credibility before pricing — "who we are" before "what it costs" | LOW | Static section between cover and services; reuses brand copy already written |
| Per-service visuals (icon, image, feature list) | Rich service cards in viewer, not plain text | LOW | All fields exist on `portfolio_services` (iconName, imageUrl, features[]) |
| Custom price override per client | Negotiated pricing without editing the catalog | LOW | `estimateServices` join table with `overridePrice` nullable column |
| Custom service line item (not from catalog) | One-off items for bespoke client needs | MEDIUM | `estimateServices` row with `isCustom: true`, no FK to `portfolio_services` |
| Auto-creation from form submission | Lead fills form → estimate auto-generated → link sent via WhatsApp/SMS | HIGH | Requires form webhook, estimate creation logic, Twilio dispatch. High complexity but high value for automation |
| Branded cover image or video background | Visual impact on first impression | MEDIUM | Optional — can add `coverImageUrl` to estimate; reuse existing Uppy upload stack |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem logical but are overkill for v1 and should be explicitly out of scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Digital signature / e-sign | "I want the client to sign in the platform" — sounds complete | Requires identity verification, audit trail, legal compliance in Brazil (ICP-Brasil, DocuSign-style). Massive scope. PandaDoc charges enterprise pricing for this. | Acceptance CTA redirects to WhatsApp/phone call. Signature happens in a separate contract tool if ever needed |
| Estimate viewed/opened tracking (read receipts) | "I want to know if the client opened the link" | Requires email pixel tracking or unique token per viewer — adds session/analytics complexity for marginal gain in v1 | Admin can ask the prospect directly; add view tracking in v2 if needed |
| PDF export | "I want to download a proposal PDF to send via email" | Headless browser (Puppeteer) or PDF lib required. Serverless Vercel constraints make this fragile. Heavy dependency for rarely-used feature. | The `/e/:slug` URL is the shareable artifact. Client can print-to-PDF from browser if desperate |
| Estimate expiry / expiration date | "Pricing valid until X" | Requires cron job or expiry check on every viewer load; complicates state machine | Put expiry language in the cover text (`validUntil` text field at most) |
| Client commenting / negotiation thread | "Client can request changes inline" | Full collaboration UI — diffing, threading, notifications. That's Proposify-tier complexity | WhatsApp link on the CTA is the negotiation channel |
| Multi-currency / tax calculation | "Show taxes automatically" | Tax rules vary per client/region. Requires tax config, currency formatting complexity | Display prices as text fields (already how `portfolio_services.price` works — text type). Admin enters `R$ 3.500` manually |
| Version history / estimate revisions | "Show v1, v2, v3 of the proposal" | Requires audit table, version diffing, UI to compare. Premature complexity. | Admin duplicates estimate and adjusts; sends new link |
| Estimate templates | "Save a proposal layout to reuse" | Template engine adds a layer of indirection before the core flow is validated | Admin duplicates an existing estimate (simpler) |
| Real-time collaboration on estimate (two admins editing) | "Two people editing at once" | WebSocket conflict resolution — not needed for a team of one or two | Sequential editing with last-write-wins is fine |
| Automated follow-up sequences | "Remind client after 3 days" | Requires scheduler/queue, not available in current stack | Admin sends manual follow-up via WhatsApp |

---

## Feature Dependencies

```
[Estimate record (DB + CRUD API)]
    └──required by──> [Admin list view]
    └──required by──> [Admin create/edit form]
    └──required by──> [Public viewer /e/:slug]
                          └──required by──> [Acceptance CTA section]

[portfolio_services catalog (existing)]
    └──feeds──> [Admin service picker]
                    └──produces──> [estimateServices join table]
                                       └──required by──> [Viewer service sections]

[Custom line item support]
    └──extends──> [estimateServices join table]

[Price override per service]
    └──extends──> [estimateServices join table]

[Total price summary]
    └──depends on──> [estimateServices join table with prices]

[Auto-creation from form]
    └──requires──> [Estimate record + API]
    └──requires──> [Twilio SMS dispatch (existing)]
    └──requires──> [Form submission webhook / post-submit hook (existing)]
```

### Dependency Notes

- **Estimate record is the root dependency:** Everything — admin UI, public viewer, auto-creation — depends on the DB schema and CRUD API existing first. Build this before anything else.
- **estimateServices join table is the pivot:** It holds the selected services + overrides. Get this schema right before building the picker UI or the viewer, because both read from it.
- **portfolio_services feeds but does not block:** The catalog already exists. The estimate system reads from it. No changes to `portfolio_services` are needed.
- **Auto-creation from form is isolated:** Can be added after the manual flow works. It only requires the estimate creation API to exist (which is built in manual flow).
- **Total price summary depends on resolved prices:** Viewer must compute total from `overridePrice ?? catalog.price`. Since `portfolio_services.price` is a text field, a numeric `priceValue` (integer cents or decimal) on the `estimateServices` row is the cleanest approach — parse at creation time, display formatted.

---

## MVP Definition

### Launch With (v1.2 — this milestone)

- [ ] `estimates` DB table — `id`, `slug`, `clientName`, `clientCompany`, `status` (draft/sent), `createdAt`, `updatedAt`
- [ ] `estimate_services` join table — `estimateId`, `portfolioServiceId` (nullable for custom), `customTitle`, `customDescription`, `overridePrice` (numeric), `order`, `isCustom`
- [ ] Admin "Estimates" list — shows all estimates with slug, client name, status, created date, copy-link button
- [ ] Admin create/edit estimate — client name/company, slug (auto-suggested), service picker from `portfolio_services`, drag-reorder, custom line item, per-service price override, total preview
- [ ] Public viewer `/e/:slug` — fullscreen scroll-snap: cover → Skale Club intro → N service sections → acceptance CTA
- [ ] Viewer cover section — client name, personalized headline, Skale Club logo
- [ ] Viewer service section — title, description, features list, price (from override or catalog), icon/image
- [ ] Viewer acceptance section — total price, CTA button (WhatsApp link or mailto), "Interested? Let's talk" framing
- [ ] Graceful 404 state for unknown slugs (mirrors PublicForm.tsx pattern)
- [ ] Manual flow only: admin creates → copies `/e/:slug` link → sends via WhatsApp

### Add After Validation (v1.x)

- [ ] Auto-creation from form submission — trigger estimate creation post-form-submit, dispatch link via Twilio SMS/WhatsApp. Add when manual flow is proven and form-to-estimate pipeline is needed.
- [ ] `viewedAt` timestamp on estimate — passive tracking (set on first `/e/:slug` load). Low cost once estimates exist, useful for admin context. Add when admins start asking "has the client seen this?"
- [ ] Cover image upload per estimate — visual differentiation per client. Add when branding/personalization becomes a priority.

### Future Consideration (v2+)

- [ ] PDF export — only if prospects specifically request it (not assumed)
- [ ] Estimate expiry — only if sales cycle data shows proposals going stale
- [ ] Digital signature — only if legal/contract workflow is needed (separate milestone, major scope)
- [ ] Estimate templates — only after 10+ estimates are created and patterns emerge
- [ ] Automated follow-up sequences — only if a scheduler/queue is added to the stack

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Estimate DB schema + CRUD API | HIGH | LOW | P1 |
| Admin create/edit form (service picker + overrides) | HIGH | MEDIUM | P1 |
| Admin estimates list | HIGH | LOW | P1 |
| Public viewer `/e/:slug` scroll-snap | HIGH | MEDIUM | P1 |
| Viewer: cover + brand + service + CTA sections | HIGH | MEDIUM | P1 |
| Custom line item (non-catalog service) | MEDIUM | LOW | P1 |
| Price override per service | HIGH | LOW | P1 |
| Total price summary on acceptance section | HIGH | LOW | P1 |
| Graceful 404 for unknown slug | MEDIUM | LOW | P1 |
| Auto-creation from form submission | HIGH | HIGH | P2 |
| Cover image upload | MEDIUM | MEDIUM | P2 |
| viewedAt passive tracking | LOW | LOW | P2 |
| PDF export | LOW | HIGH | P3 |
| Digital signature | MEDIUM | HIGH | P3 |
| Estimate templates | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.2 launch
- P2: Add after v1.2 is validated
- P3: Future consideration, not before v2

---

## Competitor Feature Analysis

*Confidence: MEDIUM — based on training knowledge of tools as of Aug 2025. No live verification possible.*

| Feature | Proposify | PandaDoc | Qwilr | HoneyBook | Our Approach |
|---------|-----------|----------|-------|-----------|--------------|
| Rich web viewer (not PDF) | Yes (their differentiator) | Yes | Yes (strongest) | Yes | Yes — scroll-snap fullscreen is our variant |
| Scroll/section-based layout | Section blocks | Section blocks | Page-scroll with sections | Linear scroll | Full scroll-snap (each service = one viewport) |
| Service catalog / fee library | Yes — fee library | Yes — product catalog | No (free-form) | Yes — service packages | Yes — `portfolio_services` |
| Per-client price override | Yes | Yes | Yes | Yes | Yes — `overridePrice` on join table |
| Custom line items | Yes | Yes | Yes | Yes | Yes — `isCustom` on join table |
| Digital signature | Yes (core feature) | Yes (core feature) | Yes | Yes | Explicitly OUT of v1 |
| View tracking / analytics | Yes | Yes | Yes | Yes | Deferred to v1.x (passive `viewedAt`) |
| Mobile-responsive viewer | Yes | Yes | Yes (best-in-class) | Yes | Yes — scroll-snap with mobile-first CSS |
| PDF export | Yes | Yes | Yes (from web view) | Yes | Explicitly deferred |
| Automated proposal sending | Yes (workflows) | Yes (workflows) | Partial | Yes | v1.x — auto-create from form |
| Acceptance CTA (no signature) | No (always forces signature) | No | Partial | No | YES — our explicit v1 design choice |
| Embedded in own platform | No (standalone) | No (standalone) | No (standalone) | Semi (HoneyBook is all-in-one) | YES — embedded in Skale Club admin |

**Key insight from competitor analysis:** Proposify, PandaDoc, and HoneyBook all treat digital signature as inseparable from proposal acceptance. Qwilr is the closest reference for "immersive web viewer without mandatory e-sign" — their "page" format uses full-viewport sections with smooth scroll. Our scroll-snap approach is architecturally similar to Qwilr but constrained to Skale Club's brand and service catalog.

---

## UX Patterns: Scroll-Snap Proposal Viewer

*Confidence: MEDIUM — based on Qwilr, web proposal UX writing, and CSS scroll-snap behavior knowledge.*

### Section Order (Best Practice)

Best-in-class tools use an emotional arc, not just a feature list:

1. **Cover** — Who this is for, who it's from. Builds trust before any pricing.
2. **Brand/Company intro** — "Why us" before "what we charge." Justifies the investment.
3. **Problem statement / context** *(optional — skip in v1 for simplicity)* — Acknowledges the prospect's pain.
4. **Service sections (one per service)** — Each gets its own moment. Scroll-snap makes each feel complete.
5. **Investment summary / Acceptance CTA** — Total cost + clear next step. Last section = action.

### What Each Service Section Must Contain

- Service title (large, above the fold)
- Short description (1-3 sentences — not the catalog's full description)
- Feature list (bullets — `portfolio_services.features[]`)
- Price (formatted, with label — "R$ 3.500 — investimento único")
- Visual element (icon or image — `iconName` / `imageUrl`)

### What to Avoid in the Viewer

- **Navigation UI** (back/forward buttons, progress indicator) — Scroll-snap implies full-screen; adding nav overlays clutters the experience. Let the scroll be the navigation.
- **Floating header/footer per section** — Each section should fill the viewport cleanly. Persistent chrome fights the immersive layout.
- **Auto-scroll / auto-advance** — Prospect must control pace. Auto-scroll is patronizing and breaks on slow connections.
- **Animated counters / parallax heavy effects** — Adds load time, can break on mobile, distracts from content. framer-motion entrance animations on scroll-into-view are fine; parallax is not.

### Mobile Considerations

- `scroll-snap-type: y mandatory` on container with `height: 100dvh` (not `100vh` — avoids iOS address bar issue)
- Each section: `scroll-snap-align: start`, `height: 100dvh`, `overflow: hidden`
- Service sections with long feature lists: use `overflow-y: auto` inside the section container, not on the snap container — otherwise snapping breaks
- CTA button must be reachable without scrolling inside a section on smallest phones (375px) — design service sections with content density in mind

---

## Existing System Dependencies

Features that depend on what is already built in Skale Club (not new work):

| Existing Capability | How Estimate System Uses It |
|---------------------|----------------------------|
| `portfolio_services` table (CMS) | Source catalog for service picker in admin create/edit |
| Admin sidebar + section pattern | `EstimatesSection.tsx` follows same pattern as `LeadsSection.tsx`, `BlogSection.tsx` |
| Supabase auth / admin guard | Estimate create/edit/list routes protected same as other admin APIs |
| Twilio SMS dispatch | Auto-creation flow sends link via SMS (v1.x) |
| Drizzle ORM + migrations | New `estimates` + `estimate_services` tables added via `db:push` |
| Uppy file upload | Cover image upload (v1.x, not v1.2) |
| `/f/:slug` pattern (`PublicForm.tsx`) | `/e/:slug` mirrors the same slug-resolution + 404 pattern |
| `wouter` routing | Add `/e/:slug` route to `App.tsx` without a new router |

---

## Sources

- Training knowledge: Proposify feature set (as of Aug 2025)
- Training knowledge: PandaDoc product (as of Aug 2025)
- Training knowledge: Qwilr web proposal viewer UX (as of Aug 2025)
- Training knowledge: HoneyBook service package proposals (as of Aug 2025)
- Training knowledge: CSS scroll-snap specification behavior (MDN-level, stable)
- Training knowledge: Better Proposals platform patterns (as of Aug 2025)
- Codebase analysis: `shared/schema/cms.ts` — `portfolio_services` schema confirmed
- Codebase analysis: `client/src/pages/PublicForm.tsx` — slug resolution pattern confirmed
- Codebase analysis: `client/src/components/admin/` — admin section pattern confirmed
- Project context: `.planning/PROJECT.md` — confirmed out-of-scope items (e-sign, PDF, status tracking)

---
*Feature research for: Client-facing proposal/estimate viewer — Skale Club v1.2*
*Researched: 2026-04-19*
