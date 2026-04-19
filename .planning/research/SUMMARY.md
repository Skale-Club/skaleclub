# Project Research Summary

**Project:** Skale Club v1.2 Estimates/Proposals System
**Domain:** Client-facing personalized proposal viewer + admin CRUD + optional automation
**Researched:** 2026-04-19
**Confidence:** HIGH (stack/architecture verified against codebase; features/pitfalls from established domain patterns)

---

## Executive Summary

The v1.2 Estimates System is a personalized service presentation layer, not a full proposal platform. The admin creates an estimate for a specific prospect, selects services from the existing portfolio_services catalog with optional price overrides, and the prospect receives a public link (/e/:slug) that renders as a polished fullscreen scroll-snap viewer. The architecture maps cleanly onto existing codebase patterns: a new Drizzle schema file, a new Express route file, a new admin section component, and a new public page following the conventions established in v1.1 (Forms system).

The recommended implementation requires zero new npm dependencies for the core manual flow. The existing stack (Drizzle ORM, Tailwind CSS scroll-snap utilities, shadcn/ui, React Hook Form, TanStack Query, Wouter) covers every capability needed. The sole dependency decision pending is email dispatch: if automated email of the estimate link is required, add resend; if only SMS plus WhatsApp link dispatch is needed, zero new packages are required. The dependency graph is clear and the build order is defined: schema first, then API routes, then admin UI, then public viewer, then automation.

The two highest-risk decisions must be made during the DB schema phase and cannot be changed cheaply afterward: (1) service data must be denormalized into a JSONB snapshot column and never referenced via FK, so that editing a portfolio service does not silently change a sent proposal; and (2) estimate slugs must be UUID-based, not name-based, because estimate content (client-specific pricing) is commercially sensitive and a predictable slug makes it enumerable. Both are correctness and security decisions, not performance optimizations. Get them right in Phase 1 or pay a high recovery cost later.

---

## Key Findings

### Recommended Stack

The entire feature can be built without adding any new npm packages to the core flow. Tailwind CSS 3.4.17 ships snap-y, snap-mandatory, and snap-start utilities natively. Drizzle ORM 0.39.3 with jsonb columns handles the denormalized service snapshot pattern. The admin UI follows the FormsSection.tsx and PortfolioSection.tsx patterns using existing shadcn/ui, React Hook Form, and TanStack Query.

The only open dependency decision is transactional email. No email-sending capability currently exists in the codebase (Twilio SMS and GHL contact sync are present, but no SMTP/Resend/SendGrid). If automated email dispatch of the estimate link is confirmed in scope for v1.2, add resend (official Node.js SDK, 3,000 emails/month free tier). If only SMS and WhatsApp link sharing are needed, no new package is required.

**Core technologies:**
- Drizzle ORM 0.39.3: New estimates table plus db:push migration, follows shared/schema/forms.ts pattern exactly
- Tailwind CSS 3.4.17: Native snap-* utilities for scroll-snap viewer, no fullpage.js or library needed
- shadcn/ui plus React Hook Form plus Zod: Admin CRUD UI, mirrors existing FormsSection.tsx pattern
- TanStack Query: Data fetching and mutation, same patterns as all other admin sections
- Wouter: /e/:slug route added to App.tsx with isEstimateRoute prefix guard
- crypto.randomUUID(): UUID slug generation, already available in Node 14.17+, no nanoid needed
- Twilio (existing): SMS dispatch of estimate link in automation phase
- resend (if scoped): Email dispatch, only add if email automation is confirmed in v1.2 requirements

**Do not add:** fullpage.js (GPL license, overkill), react-scroll-snap (abandoned 2020), nanoid (redundant), puppeteer or @react-pdf/renderer (PDF explicitly out of scope)

### Expected Features

**Must have (table stakes, v1.2 launch):**
- estimates DB table with slug, clientName, clientCompany, status (draft/sent), timestamps
- estimate services as JSONB array on estimates row, denormalized snapshot of service data at creation time, with optional price override per item
- Admin list view, all estimates with slug, client name, status, created date, copy-link button
- Admin create/edit form, client fields, auto-suggested slug, service picker from portfolio_services, custom line items, per-service price override, total preview
- Public viewer /e/:slug, fullscreen scroll-snap: Cover -> Skale Club intro -> one section per service -> Acceptance CTA
- Graceful 404 for unknown slugs (mirrors PublicForm.tsx pattern)
- Manual flow only: admin creates, copies link, sends via WhatsApp

**Should have (after v1.2 is validated):**
- Auto-creation from form submission, estimate draft triggered on formCompleto = true, link dispatched via Twilio SMS
- viewedAt passive tracking, set on first /e/:slug load
- Cover image upload per estimate, visual differentiation per client

**Defer (v2+):**
- PDF export, explicitly out of scope; browser Print-to-PDF covers any client need
- Digital signature / e-sign, legal compliance complexity (ICP-Brasil), separate milestone
- Estimate templates, premature before 10+ estimates exist
- Automated follow-up sequences, requires scheduler/queue not in current stack
- Estimate expiry with enforcement, requires cron or per-load check, marginal v1 value

### Architecture Approach

The system follows the layered architecture already established in the codebase: a shared/schema/estimates.ts file defines the Drizzle table and Zod schemas, a server/routes/estimates.ts file registers 6 Express endpoints (5 admin-protected plus 1 public slug lookup), server/storage.ts gains estimate CRUD methods, a new EstimatesSection.tsx component handles the admin UI, and a new PublicEstimate.tsx page renders the public viewer. Service data is denormalized into a jsonb column on the estimates row at creation time, no join table, no FK to portfolio_services, making each estimate an immutable point-in-time document. The public page must be isolated from the site shell (Navbar, Footer, ChatWidget) using the isEstimateRoute prefix guard pattern already used for /links/ and /vcard/ routes in App.tsx.

**Major components:**
1. shared/schema/estimates.ts: Drizzle table definition, Zod schemas, TypeScript types; re-exported from shared/schema.ts barrel
2. server/routes/estimates.ts: 6 Express endpoints, admin CRUD (5, requireAdmin) plus public slug lookup (1, no auth, setPublicCache(0))
3. server/storage.ts: 6 new methods on DatabaseStorage (createEstimate, getEstimate, getEstimateBySlug, listEstimates, updateEstimate, deleteEstimate)
4. client/src/components/admin/EstimatesSection.tsx: list view plus create/edit modal with service picker, drag-reorder via @dnd-kit (existing), price override, custom line items
5. client/src/pages/PublicEstimate.tsx: public scroll-snap page; fetches by slug; renders Cover -> Intro -> N service sections -> CTA; no shell components
6. server/lib/estimate-builder.ts (recommended): buildEstimateDraft() utility shared between route handler and auto-creation hook, preventing business logic duplication

### Critical Pitfalls

1. **JSONB snapshot vs FK, commercial correctness:** Never store a FK reference to portfolio_services as the source of truth for rendered pricing. Denormalize all service data (title, description, price, features) into the services jsonb array at creation time. Store serviceId only as a nullable reference for pre-filling the edit form. This cannot be retrofitted cheaply; design the schema correctly in Phase 1.

2. **UUID slug is mandatory, not client name:** Estimate content contains client-specific pricing. A slug like acme-corp-2026 is guessable and enumerable. Use crypto.randomUUID() for slug generation. Also add e and f to the reserved prefix list in getPageSlugsValidationError() to prevent page slug conflicts.

3. **Mobile viewport height, use dvh not vh:** scroll-snap-type: y mandatory with height: 100vh breaks on iOS Safari because the URL bar dynamically changes the visual viewport. Use min-h-[100dvh] for all snap sections. Fix during initial implementation; most recipients open WhatsApp links on mobile.

4. **Auto-creation idempotency:** The form lead endpoint uses upsert; re-submitting the same session re-runs runLeadPostProcessing. Add an estimateCreated boolean flag to form_leads (mirroring the existing notificacaoEnviada Twilio guard) and check it before auto-creating an estimate.

5. **Item type discriminator for edit round-trip:** Each estimate item must carry a type field (catalog or custom) so the admin editor restores the correct input mode when reopening a saved estimate. Without it, all items render as custom text inputs on re-edit.

---

## Implications for Roadmap

The dependency graph is unambiguous. The estimates schema is the root dependency for all other work. Research explicitly defines a 5-phase build order with zero broken builds at each phase boundary.

### Phase 1: DB Schema + Storage Layer

**Rationale:** Everything else depends on the Drizzle table existing. Schema decisions here are expensive to reverse. Slug generation strategy, JSONB snapshot vs FK, and item type discriminator must all be locked in before any data is inserted.
**Delivers:** shared/schema/estimates.ts, barrel export update, 6 storage methods on DatabaseStorage, db:push migration applied.
**Addresses:** Table stakes, estimate record foundation, price override and custom line items schema.
**Avoids:** JSONB snapshot pitfall, UUID slug pitfall, price text pitfall, item type discriminator pitfall, pageSlugs collision.
**Research flag:** Standard patterns, follows shared/schema/forms.ts directly. No research phase needed.

### Phase 2: Admin API Routes

**Rationale:** Unblocks both the admin UI (Phase 3) and the public viewer (Phase 4). Can be smoke-tested with curl before any UI exists. Pure server work, zero client-side risk.
**Delivers:** server/routes/estimates.ts with 6 endpoints, registered in server/routes.ts. Admin CRUD protected by requireAdmin. Public slug lookup at GET /api/estimates/slug/:slug.
**Uses:** requireAdmin, setPublicCache from server/routes/_shared.ts (existing).
**Avoids:** PII exposure, public response strips email/phone from the payload.
**Research flag:** Standard patterns, follows server/routes/forms.ts directly. No research phase needed.

### Phase 3: Admin UI (EstimatesSection)

**Rationale:** Delivers the primary admin workflow, manual estimate creation and WhatsApp link dispatch. First phase where a real end-to-end flow (create, copy link) is possible.
**Delivers:** EstimatesSection.tsx with list view and create/edit modal. Service picker reads GET /api/portfolio (existing). Drag-reorder via @dnd-kit (existing). Price override. Custom line items. Copy-link button. Preview link.
**Avoids:** Item type discriminator pitfall, price formatting pitfall (add formatEstimatePrice() helper before rendering).
**Research flag:** Standard patterns, mirrors FormsSection.tsx and PortfolioSection.tsx. No research phase needed.

### Phase 4: Public Viewer (/e/:slug)

**Rationale:** The client-facing deliverable. Depends on Phase 2 and is fully testable using real estimates created in Phase 3. Scroll-snap implementation is the highest UX complexity of the project.
**Delivers:** PublicEstimate.tsx, fullscreen scroll-snap page, isEstimateRoute guard in App.tsx, Cover -> Skale Club intro -> service sections -> Acceptance CTA, graceful 404.
**Uses:** Native CSS scroll-snap via Tailwind snap-y snap-mandatory snap-start. framer-motion (existing) for section entrance animations.
**Avoids:** Mobile viewport pitfall (use dvh), Safari programmatic scroll pitfall (use scrollTo on container), site-shell contamination (render outside Navbar/Footer via isEstimateRoute guard).
**Research flag:** CSS scroll-snap is well-documented. Pitfalls are known and documented in PITFALLS.md. No research phase needed. QA checkpoint on a real iPhone during this phase.

### Phase 5: Automation (Auto-estimate from Form Submission)

**Rationale:** Automation enhancement that adds value only after the manual flow is proven. Isolated to server/lib/lead-processing.ts, no UI changes. Can be deferred to v1.x if the manual flow delivers sufficient value.
**Delivers:** createAutoEstimate() hook in runLeadPostProcessing(), estimateCreated flag on form_leads, optional Twilio SMS with estimate link. Introduces server/lib/estimate-builder.ts as a shared utility.
**Avoids:** Duplicate auto-estimate pitfall (estimateCreated flag), blocking lead upsert on estimate failure (best-effort pattern, errors swallowed).
**Research flag:** Email dispatch decision (Resend vs SMS-only) must be resolved before this phase begins. If email is required, add resend package here and verify Vercel serverless compatibility.

### Phase Ordering Rationale

- Schema-first order is mandatory: the public viewer, admin UI, and automation hook all depend on the DB table and storage methods existing. Any other order creates broken builds.
- Phase 2 (API) before Phase 3 (Admin UI) and Phase 4 (Public Viewer) decouples server from client development and enables smoke-testing before any UI exists.
- Phase 4 (Public Viewer) can technically be built in parallel with Phase 3 (Admin UI) once Phase 2 is done; sequential order is lower risk for a solo/small team.
- Phase 5 (Automation) is explicitly additive and does not touch any UI. It is safely deferrable to v1.x without affecting the v1.2 manual workflow.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Automation):** The email dispatch decision (Resend vs SMS-only) is unresolved and affects the dependency list. Clarify in requirements before planning this phase. If resend is added, verify compatibility with the Vercel serverless environment.

Phases with standard patterns (skip research phase):
- **Phase 1 (Schema):** Follows shared/schema/forms.ts directly, copy and adapt.
- **Phase 2 (API Routes):** Follows server/routes/forms.ts directly, copy and adapt.
- **Phase 3 (Admin UI):** Follows FormsSection.tsx and PortfolioSection.tsx, copy and adapt.
- **Phase 4 (Public Viewer):** CSS scroll-snap is well-documented. Pitfalls are known and documented in PITFALLS.md. No research phase needed; QA checkpoint on a real iPhone during this phase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against package.json and installed versions. Zero ambiguity except email dispatch library choice. |
| Features | MEDIUM | Based on Proposify/PandaDoc/Qwilr/HoneyBook patterns (training knowledge, Aug 2025). WebSearch unavailable. Patterns are stable and well-established. |
| Architecture | HIGH | All findings drawn from direct codebase inspection at commit f772f5d. Every integration point verified against actual source files. |
| Pitfalls | HIGH | Derived from direct codebase inspection plus known CSS scroll-snap behavior plus existing idempotency patterns in lead-processing.ts. High specificity. |

**Overall confidence:** HIGH

### Gaps to Address

- **Email dispatch scope:** Whether automated email of the estimate link is in scope for v1.2 is unresolved. Requirements must answer this before Phase 5 planning. If yes, add resend; if no, zero new dependencies.
- **WhatsApp auto-dispatch mechanism:** The automation phase references sending link via WhatsApp but the current Twilio integration handles SMS only. Clarify whether WhatsApp dispatch means a frontend wa.me URL (zero backend work) or sending via Twilio WhatsApp API (requires template registration and approval, significant setup).
- **Auto-estimate de-duplication:** sessionId uniqueness is per-browser-tab, so two devices create two leads for the same person. Auto-estimate de-duplication must be by phone or email, not by session. Decide the de-duplication strategy before Phase 5 implementation.
- **Acceptance CTA behavior:** Whether tapping Accept on the proposal CTA creates a DB record (status change to accepted) or simply opens a WhatsApp/phone link is not specified. The simpler approach (WhatsApp link, no DB write) is recommended for v1.2. Confirm in requirements.

---

## Sources

### Primary (HIGH confidence, direct codebase inspection at commit f772f5d)
- shared/schema/forms.ts: slug uniqueness pattern, Drizzle schema conventions
- shared/schema/cms.ts: portfolio_services table structure, price as text type confirmed
- server/routes/forms.ts: route file pattern, requireAdmin, setPublicCache
- server/lib/lead-processing.ts: best-effort side-effect pattern, notificacaoEnviada idempotency guard
- client/src/App.tsx: isLinksRoute, isVCardRoute prefix guard pattern
- client/src/pages/PublicForm.tsx: public slug-routed page pattern (404 handling)
- client/src/pages/Admin.tsx: section slug maps, render switch pattern
- client/src/components/admin/shared/types.ts and constants.ts: AdminSection union, sidebar entries
- package.json: confirmed absence of scroll libraries, email libraries, nanoid

### Secondary (MEDIUM confidence, training knowledge, stable specifications)
- Tailwind CSS 3: snap-* scroll utilities ship in Tailwind 3.x core (verified against installed version 3.4.17)
- MDN Web Docs: CSS scroll-snap-type browser support (Chrome 69+, Firefox 68+, Safari 11+)
- MDN Web Docs: dvh unit browser support (Chrome 108+, Safari 15.4+, Firefox 101+)
- Proposify, PandaDoc, Qwilr, HoneyBook feature sets: training knowledge as of Aug 2025
- Resend Node.js SDK: https://resend.com/docs/send-with-nodejs

### Tertiary (context, project definition)
- .planning/PROJECT.md: confirmed out-of-scope items (PDF, e-sign, status tracking)

---

*Research completed: 2026-04-19*
*Ready for roadmap: yes*