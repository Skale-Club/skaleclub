# Architecture Research — Estimates/Proposals System

**Domain:** Estimates/Proposals system added to existing TypeScript/React + Express + Drizzle ORM app
**Researched:** 2026-04-19
**Confidence:** HIGH (all conclusions drawn from direct codebase inspection)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT (React SPA, Wouter routing, TanStack Query)                   │
│                                                                        │
│  Admin (/admin/estimates)         Public (/e/:slug)                   │
│  ┌────────────────────────┐       ┌────────────────────────────────┐  │
│  │ EstimatesSection.tsx   │       │ PublicEstimate.tsx              │  │
│  │  - List estimates      │       │  - Cover section               │  │
│  │  - Create/Edit modal   │       │  - Skale Club intro section     │  │
│  │  - Service selector    │       │  - 1 fullscreen section/service │  │
│  │  - Copy link button    │       │  - Acceptance section           │  │
│  └────────────────────────┘       │  (CSS scroll-snap, no Navbar)   │  │
│                                   └────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  SERVER (Express routes)                                              │
│                                                                        │
│  server/routes/estimates.ts  ←→  server/storage.ts                   │
│  - GET    /api/estimates            (admin list)                      │
│  - POST   /api/estimates            (admin create)                    │
│  - GET    /api/estimates/:id        (admin fetch one)                 │
│  - PUT    /api/estimates/:id        (admin update)                    │
│  - DELETE /api/estimates/:id        (admin delete)                    │
│  - GET    /api/estimates/slug/:slug (public fetch — no auth)          │
├──────────────────────────────────────────────────────────────────────┤
│  SHARED (types + validation)                                          │
│                                                                        │
│  shared/schema/estimates.ts  →  re-exported via shared/schema.ts     │
├──────────────────────────────────────────────────────────────────────┤
│  DATABASE (PostgreSQL via Drizzle ORM)                                │
│                                                                        │
│  estimates table                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ id  slug  client_name  client_email  client_phone                │ │
│  │ services (jsonb)  note  status  created_at  updated_at           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| `shared/schema/estimates.ts` | Drizzle table definition + Zod schemas + TypeScript types | New file |
| `server/routes/estimates.ts` | Admin-protected CRUD + public slug lookup | New file |
| `server/storage.ts` | Storage methods: list, get, getBySlug, create, update, delete | Extend existing class |
| `client/src/pages/Admin.tsx` | Register `estimates` section in slug map + render switch | Modify |
| `client/src/components/admin/shared/types.ts` | Add `'estimates'` to `AdminSection` union | Modify |
| `client/src/components/admin/shared/constants.ts` | Add estimates entry to `SIDEBAR_MENU_ITEMS` | Modify |
| `client/src/components/admin/EstimatesSection.tsx` | Admin UI: list, create, edit estimates | New file |
| `client/src/pages/PublicEstimate.tsx` | Public `/e/:slug` page with scroll-snap sections | New file |
| `client/src/App.tsx` | Register lazy-loaded `PublicEstimate` + `/e/:slug` route | Modify |
| `server/routes.ts` | Import + call `registerEstimateRoutes(app)` | Modify |
| `server/lib/lead-processing.ts` | Optionally trigger auto-estimate creation on form completion | Modify |

---

## Recommended Project Structure

New files only — all additions follow existing conventions:

```
shared/schema/
└── estimates.ts          # New — Drizzle table + Zod schemas + types

server/routes/
└── estimates.ts          # New — Express route handlers

client/src/pages/
└── PublicEstimate.tsx    # New — public /e/:slug scroll-snap page

client/src/components/admin/
└── EstimatesSection.tsx  # New — admin estimates management UI
    estimates/            # Optional subfolder if component grows large
    ├── EstimateForm.tsx
    ├── EstimateCard.tsx
    └── ServiceSelector.tsx
```

Modified files:
```
shared/schema.ts                                 # Add: export * from "./schema/estimates.js"
server/routes.ts                                 # Add: registerEstimateRoutes import + call
server/storage.ts                                # Add: estimate CRUD methods to DatabaseStorage class
client/src/App.tsx                               # Add: lazy import + /e/:slug Route
client/src/components/admin/shared/types.ts      # Add: 'estimates' to AdminSection union
client/src/components/admin/shared/constants.ts  # Add: estimates entry to SIDEBAR_MENU_ITEMS
client/src/pages/Admin.tsx                       # Add: estimates to slugMap + render switch
```

---

## Architectural Patterns

### Pattern 1: Follow the forms.ts route file pattern exactly

**What:** Each domain gets its own `server/routes/{domain}.ts` with a single exported `register{Domain}Routes(app: Express)` function. Route file imports from `#shared/schema.js` and `../storage.js`. Auth handled via `requireAdmin` from `./_shared.ts`.

**When to use:** Always — this is the established convention after v1.0 route splitting.

**Trade-offs:** Slight boilerplate per domain, but keeps `server/routes.ts` as a thin orchestrator and each file focused and testable.

**Example:**
```typescript
// server/routes/estimates.ts
import type { Express } from "express";
import { storage } from "../storage.js";
import { insertEstimateSchema, updateEstimateSchema } from "#shared/schema.js";
import { requireAdmin, setPublicCache } from "./_shared.js";

export function registerEstimateRoutes(app: Express) {
  // Admin: list
  app.get("/api/estimates", requireAdmin, async (req, res) => { ... });
  // Admin: create
  app.post("/api/estimates", requireAdmin, async (req, res) => { ... });
  // Admin: get one
  app.get("/api/estimates/:id", requireAdmin, async (req, res) => { ... });
  // Admin: update
  app.put("/api/estimates/:id", requireAdmin, async (req, res) => { ... });
  // Admin: delete
  app.delete("/api/estimates/:id", requireAdmin, async (req, res) => { ... });
  // Public: fetch by slug (no auth — used by /e/:slug page)
  app.get("/api/estimates/slug/:slug", setPublicCache(0), async (req, res) => { ... });
}
```

### Pattern 2: Follow the schema/forms.ts domain file pattern

**What:** One file per domain in `shared/schema/`. Defines Drizzle pgTable, createInsertSchema (or manual Zod), types via `$inferSelect` / `$inferInsert`, then re-exported from barrel `shared/schema.ts`.

**When to use:** Always for new DB tables.

**Trade-offs:** Requires updating the barrel export. Zero impact on existing consumers.

**Example:**
```typescript
// shared/schema/estimates.ts
import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const estimates = pgTable("estimates", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  // jsonb array — one item per service line
  services: jsonb("services").$type<EstimateService[]>().notNull().default([]),
  note: text("note"),
  status: text("status").notNull().default("draft"),  // draft | sent | accepted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export const estimateServiceSchema = z.object({
  serviceId: z.number().int().nullable().optional(),  // null = custom service
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.string().min(1),                           // text, e.g. "R$ 1.997"
  originalPrice: z.string().optional(),               // before override
  features: z.array(z.string()).default([]),
  isCustom: z.boolean().default(false),
});
export type EstimateService = z.infer<typeof estimateServiceSchema>;

export const insertEstimateSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  clientName: z.string().min(1),
  clientEmail: z.string().email().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  services: z.array(estimateServiceSchema).min(1),
  note: z.string().nullable().optional(),
  status: z.enum(["draft", "sent", "accepted"]).default("draft"),
});
export const updateEstimateSchema = insertEstimateSchema.partial();

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;
export type InsertEstimateInput = z.infer<typeof insertEstimateSchema>;
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;
```

### Pattern 3: AdminSection union + slug map + sidebar entry

**What:** Adding a new admin section requires four coordinated changes: (1) add the literal to `AdminSection` in `types.ts`, (2) add an entry to `SIDEBAR_MENU_ITEMS` in `constants.ts`, (3) update both slug maps in `Admin.tsx`, (4) render the section component in the switch block.

**When to use:** Every new admin section. This pattern is well established.

**Trade-offs:** Four-file touch for each new section, but each change is a one-liner. Low risk.

```typescript
// types.ts — add to union
export type AdminSection = ... | 'estimates';

// constants.ts — add menu entry
{ id: 'estimates', title: 'Estimates', description: 'Proposals sent to clients', icon: FileSignature },

// Admin.tsx — add to both slug maps
// incoming: { estimates: 'estimates' }
// outgoing: { estimates: 'estimates' }
// render switch:
{activeSection === 'estimates' && <EstimatesSection />}
```

### Pattern 4: Public page with scroll-snap, no Navbar/Footer

**What:** `/e/:slug` renders a fullscreen scroll-snap page — similar to how `/f/:slug` (PublicForm.tsx) is a self-contained page. It must be registered in the router block that renders WITHOUT Navbar/Footer. Currently the only way to achieve this cleanly is to detect the `/e/` prefix and return an isolated `<Suspense>` branch — the same technique as `isLinksRoute` and `isVCardRoute` guards in App.tsx.

**When to use:** Any public page that must suppress the site shell (Navbar, Footer, ChatWidget).

**Trade-offs:** Adds another prefix guard in `Router()`. The alternative — using a `data-no-shell` prop — would require refactoring the render flow. The prefix guard is the established pattern.

**Example:**
```typescript
// App.tsx — add before the main return block
const isEstimateRoute = location.startsWith('/e/');

if (isEstimateRoute) {
  return (
    <Suspense fallback={fallback}>
      <Switch>
        <Route path="/e/:slug" component={PublicEstimate} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

### Pattern 5: Auto-estimate creation hook in lead-processing.ts

**What:** When `lead.formCompleto === true`, `runLeadPostProcessing()` in `server/lib/lead-processing.ts` already fires Twilio SMS and GHL sync. Auto-estimate creation should be a third best-effort step in the same function — create a draft estimate from the lead's data if the form config specifies `autoEstimate: true` (or always create one based on product decision).

**When to use:** Phase 4 only — after the estimates CRUD and public page exist. Don't add this in Phase 1–3.

**Trade-offs:** Coupling lead processing to estimates creation. Acceptable because it mirrors the existing GHL + Twilio coupling. Errors must be swallowed (best-effort), same pattern as the other side-effects.

---

## Data Flow

### Admin Creates Estimate Manually

```
Admin fills EstimatesSection form
    ↓
POST /api/estimates  (requireAdmin)
    ↓
insertEstimateSchema.parse(req.body)  →  400 if invalid
    ↓
storage.createEstimate(input)
    ↓
INSERT INTO estimates (slug, client_name, ...)
    ↓
201 { id, slug, ... }
    ↓
Admin copies /e/{slug} link  →  sends to client via WhatsApp
```

### Client Views Public Estimate

```
Client opens /e/{slug} in browser
    ↓
PublicEstimate.tsx mounts
    ↓
GET /api/estimates/slug/{slug}  (no auth, setPublicCache(0))
    ↓
storage.getEstimateBySlug(slug)  →  404 if not found
    ↓
{ id, slug, clientName, services[], note, ... }
    ↓
Render fullscreen scroll-snap sections:
  Section 0: Cover (client name, Skale Club logo, date)
  Section 1: Skale Club intro / pitch
  Section N: One section per service in services[]
  Section N+1: Acceptance / CTA / contact
```

### Auto-Estimate on Form Submission

```
POST /api/forms/slug/:slug/leads/progress  (last question, formCompleto=true)
    ↓
storage.upsertFormLeadProgress(...)
    ↓
runLeadPostProcessing(lead, formConfig, companyName)
    ↓ (parallel, best-effort)
  ├── Twilio SMS notification  (existing)
  ├── GHL contact sync  (existing)
  └── createEstimateDraft(lead)  (NEW — Phase 4)
        ↓
        storage.createEstimate({ slug: generateSlug(lead.nome), clientName: lead.nome, ... })
        errors swallowed, estimate creation failure does NOT fail the lead upsert
```

---

## DB Schema — Exact Recommendation

```sql
CREATE TABLE estimates (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  services    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- each item: { serviceId?: number|null, title, description?, price, originalPrice?, features[], isCustom }
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | accepted
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX estimates_slug_idx ON estimates (slug);
CREATE INDEX estimates_status_idx ON estimates (status);
CREATE INDEX estimates_created_at_idx ON estimates (created_at);
```

No foreign key to `portfolio_services`. Services are denormalized into the JSONB array at creation time. This means editing a service in the portfolio does not retroactively change sent estimates — intentional, estimates represent what was offered at a point in time. `serviceId` is stored for reference only (to pre-fill forms when editing).

---

## Integration Points

### Existing Infrastructure — What Gets Reused

| Infrastructure | How Estimates Uses It |
|----------------|-----------------------|
| `requireAdmin` from `./_shared.ts` | All admin CRUD routes protected identically to forms/blog |
| `setPublicCache` from `./_shared.ts` | Public slug endpoint: `setPublicCache(0)` (no cache — estimate content is confidential) |
| `storage` class in `server/storage.ts` | Adds estimate methods to existing DatabaseStorage class |
| `shared/schema.ts` barrel | Adds `export * from "./schema/estimates.js"` |
| `server/routes.ts` orchestrator | Adds one import + one `registerEstimateRoutes(app)` call |
| `AdminSection` type system | Adds `'estimates'` literal, one sidebar entry, two slug map entries, one render line |
| `portfolioServices` table | Admin UI reads `GET /api/portfolio` (already exists) to populate service selector |
| `lead-processing.ts` | Phase 4: adds estimate draft creation as third best-effort side-effect |
| Twilio (existing) | Phase 4: optionally send SMS with estimate link after auto-creation |

### New vs Modified — Explicit List

**New files (pure additions, zero existing file impact):**
- `shared/schema/estimates.ts`
- `server/routes/estimates.ts`
- `client/src/pages/PublicEstimate.tsx`
- `client/src/components/admin/EstimatesSection.tsx`
- (optional) `client/src/components/admin/estimates/EstimateForm.tsx`
- (optional) `client/src/components/admin/estimates/ServiceSelector.tsx`
- (optional) `client/src/components/admin/estimates/EstimateCard.tsx`

**Modified files (surgical additions):**
- `shared/schema.ts` — add one barrel export line
- `server/routes.ts` — add one import + one call
- `server/storage.ts` — add estimate CRUD methods to DatabaseStorage class
- `client/src/App.tsx` — add `isEstimateRoute` guard + lazy import + route
- `client/src/components/admin/shared/types.ts` — add `'estimates'` to AdminSection union
- `client/src/components/admin/shared/constants.ts` — add sidebar menu item
- `client/src/pages/Admin.tsx` — add to both slug maps + render switch
- `server/lib/lead-processing.ts` — Phase 4 only: add auto-estimate creation

---

## Recommended Build Order (Phase Sequencing)

The dependency graph drives the order. Each phase has zero broken builds at its end.

**Phase 1 — DB Schema + Storage Layer (foundation)**
- Create `shared/schema/estimates.ts` (Drizzle table + Zod schemas + types)
- Extend `shared/schema.ts` barrel
- Add estimate CRUD methods to `server/storage.ts` (`createEstimate`, `getEstimate`, `getEstimateBySlug`, `listEstimates`, `updateEstimate`, `deleteEstimate`)
- Run `npm run db:push` to create the table
- Rationale: everything else depends on this. No UI touches in this phase.

**Phase 2 — Admin API Routes**
- Create `server/routes/estimates.ts` with all 6 endpoints
- Register in `server/routes.ts`
- Rationale: unblocks both the admin UI (Phase 3) and auto-creation hook (Phase 4). Can be smoke-tested with `curl` before any UI exists.

**Phase 3 — Admin UI (EstimatesSection)**
- Add `'estimates'` to `AdminSection` type, sidebar constants, slug maps, Admin.tsx render switch
- Create `client/src/components/admin/EstimatesSection.tsx`
  - List view: table of estimates with slug, client name, status, created date, copy-link button
  - Create/Edit modal: client fields + service selector (fetches `GET /api/portfolio`) + note field
  - Service selector: pick from `portfolioServices`, override price, add custom service rows
- Rationale: manual creation path (the primary workflow) is complete after this phase.

**Phase 4 — Public `/e/:slug` Page**
- Add `isEstimateRoute` guard to App.tsx router
- Create `client/src/pages/PublicEstimate.tsx` with CSS scroll-snap sections
- Rationale: the client-facing deliverable. Depends on Phase 2 (public API endpoint). Can be built and tested by hitting real estimate slugs created in Phase 3.

**Phase 5 — Auto-Creation on Form Completion**
- Modify `server/lib/lead-processing.ts`: add estimate draft creation as third best-effort step
- Optionally: SMS link dispatch via Twilio after draft creation
- Rationale: automation enhancement. Phases 1–4 deliver full manual workflow. This phase adds the auto trigger without touching any of the UI.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding a foreign key from estimates to portfolio_services

**What people do:** Add `service_id INTEGER REFERENCES portfolio_services(id)` in the estimates table to normalize service data.

**Why it's wrong:** Estimates are point-in-time documents. If a portfolio service is deleted or its price changed, all existing estimates referencing it break. This is a proposal sent to a client — it must be immutable after creation.

**Do this instead:** Denormalize service data into the `services` jsonb array at creation time. Store `serviceId` as a nullable reference only, used to pre-populate the edit form. Never join through it at read time.

### Anti-Pattern 2: Rendering /e/:slug inside the site shell (with Navbar/Footer)

**What people do:** Add `/e/:slug` to the main Switch block that already has Navbar and Footer wrapping it.

**Why it's wrong:** The scroll-snap fullscreen sections require `height: 100vh` per section and the browser viewport. The Navbar (~56px) and Footer offset the sections and break the snap behavior. ChatWidget appearing over a proposal page is also inappropriate.

**Do this instead:** Add an `isEstimateRoute` guard before the main return block in `Router()` — identical to `isLinksRoute` and `isVCardRoute` guards already in the codebase. Return a bare `<Suspense>` with only the `PublicEstimate` route, no shell components.

### Anti-Pattern 3: Blocking the lead upsert on estimate creation failure

**What people do:** `await createEstimate(lead)` inside the lead progress handler without a try/catch, so a storage error rolls back the lead save.

**Why it's wrong:** The lead capture is the primary business event. Estimate creation is a secondary side-effect. If the estimates table is down or the slug generation fails, the lead must still be saved.

**Do this instead:** Wrap estimate creation in try/catch inside `runLeadPostProcessing`, identical to how Twilio and GHL errors are swallowed. Log the error, continue.

### Anti-Pattern 4: Putting estimate business logic in the route handler

**What people do:** Inline slug generation, default service selection, and GHL sync directly inside `POST /api/estimates`.

**Why it's wrong:** The auto-creation path in `lead-processing.ts` would need to duplicate the same logic.

**Do this instead:** Extract a `buildEstimateDraft(lead: FormLead): InsertEstimateInput` utility function in `server/lib/estimate-builder.ts`. Both the route handler and the lead-processing hook call it.

---

## Scroll-Snap Public Page — Implementation Notes

The scroll-snap layout requires specific CSS. The pattern is well-supported in all modern browsers (HIGH confidence — no polyfills needed).

```css
/* Container */
.estimate-scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}

/* Each section */
.estimate-section {
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
```

Apply via Tailwind: `h-screen overflow-y-scroll [scroll-snap-type:y_mandatory]` on the container, `h-screen [scroll-snap-align:start]` on each section. Tailwind v3 supports arbitrary values for both properties.

The `PublicEstimate.tsx` component should:
1. Fetch `GET /api/estimates/slug/:slug` on mount
2. Show a full-screen loader while fetching
3. Show a minimal "Estimate not found" screen on 404 (no redirect — clients must not be bounced to the home page)
4. Render sections in order: Cover → Company Intro → service sections (one per `services[]` item) → Acceptance CTA
5. No Navbar, Footer, or ChatWidget (handled by the `isEstimateRoute` guard in App.tsx)

---

## Sources

All findings from direct inspection of the codebase at commit `f772f5d` (2026-04-19):

- `client/src/App.tsx` — routing patterns, lazy loading, shell guards
- `client/src/pages/Admin.tsx` — section slug maps, render switch, DnD sidebar
- `client/src/components/admin/shared/types.ts` — AdminSection union
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS
- `server/routes/forms.ts` — route file pattern (requireAdmin, error handling, Zod)
- `server/routes.ts` — route registration orchestrator
- `server/storage.ts` — DatabaseStorage class, existing method signatures
- `server/lib/lead-processing.ts` — best-effort side-effect pattern
- `shared/schema/forms.ts` — Drizzle table + Zod schema pattern
- `shared/schema/cms.ts` — portfolioServices table structure
- `shared/schema.ts` — barrel export pattern

---
*Architecture research for: Estimates/Proposals system (v1.2)*
*Researched: 2026-04-19*
