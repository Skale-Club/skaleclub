# Architecture: Admin Presentations Page (v1.4)

**Researched:** 2026-04-20
**Milestone:** v1.4 — AI-authored slide decks with bilingual public viewer

---

## Executive Summary

The presentations feature is a clean extension of the estimates pattern (v1.2). Every architectural decision made in v1.2 (JSONB snapshot, UUID slug, event-log view table, isEstimateRoute guard) applies directly here. The one meaningful new surface is the AI authoring loop — a server-sent streaming endpoint that calls the Anthropic SDK and pushes structured JSON slide blocks back to the admin chat UI. Brand guidelines live in a dedicated `presentation_brand_guidelines` singleton table (not bolted onto `company_settings`, which is already overloaded), so the AI system prompt is a first-class DB row the admin can edit independently. The `@anthropic-ai/sdk` package is not yet in `package.json`; it must be added in Phase 1.

---

## 1. Database Schema

### 1.1 Tables Required

Three new tables mirror the estimates family exactly.

#### `presentations`

```ts
// shared/schema/presentations.ts

import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

// ── Slide block types ────────────────────────────────────────────────────────

export const slideBlockSchema = z.object({
  type: z.enum(["title", "content", "bullets", "image", "split"]),
  // EN content
  heading: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().optional(),
  // PT-BR content (inline bilingual — no separate rows)
  headingPt: z.string().optional(),
  bodyPt: z.string().optional(),
  bulletsPt: z.array(z.string()).optional(),
  imageAltPt: z.string().optional(),
  // Layout hints
  layout: z.enum(["center", "left", "right"]).optional(),
  backgroundImageUrl: z.string().optional(),
  order: z.number().int().min(0),
});

export type SlideBlock = z.infer<typeof slideBlockSchema>;

// ── Table ────────────────────────────────────────────────────────────────────

export const presentations = pgTable("presentations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  slides: jsonb("slides").$type<SlideBlock[]>().notNull().default([]),
  accessCode: text("access_code"),
  version: integer("version").notNull().default(1),
  // Snapshot of brand guidelines active at last save — keeps old presentations
  // rendering correctly after brand refreshes (same immutability as estimate services)
  guidelinesSnapshot: jsonb("guidelines_snapshot").$type<BrandGuidelines>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export type Presentation = typeof presentations.$inferSelect;
export type InsertPresentation = typeof presentations.$inferInsert;

export const insertPresentationSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  slides: z.array(slideBlockSchema).default([]),
  accessCode: z.string().nullable().optional(),
  guidelinesSnapshot: z.custom<BrandGuidelines>().nullable().optional(),
});

export type PresentationWithStats = Presentation & {
  viewCount: number;
  lastViewedAt: Date | null;
};
```

#### `presentation_views`

```ts
export const presentationViews = pgTable("presentation_views", {
  id: serial("id").primaryKey(),
  presentationId: integer("presentation_id")
    .references(() => presentations.id, { onDelete: "cascade" })
    .notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
});

export type PresentationView = typeof presentationViews.$inferSelect;
```

#### `presentation_brand_guidelines`

```ts
// Singleton table — one row. Admin edits it via a dedicated sub-section.
// Claude consumes the latest row as its system prompt prefix on every authoring call.

export const brandGuidelinesSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),       // e.g. "#1C53A3"
  accentColor: z.string().optional(),        // e.g. "#FFFF01"
  fontHeading: z.string().optional(),        // e.g. "Outfit"
  fontBody: z.string().optional(),           // e.g. "Inter"
  tone: z.string().optional(),               // free text: "professional but approachable"
  alwaysInclude: z.array(z.string()).default([]),
  neverInclude: z.array(z.string()).default([]),
  extraContext: z.string().optional(),       // Any other system-prompt text admin wants Claude to know
});

export type BrandGuidelines = z.infer<typeof brandGuidelinesSchema>;

export const presentationBrandGuidelines = pgTable("presentation_brand_guidelines", {
  id: serial("id").primaryKey(),
  guidelines: jsonb("guidelines").$type<BrandGuidelines>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
```

### 1.2 Design Decisions

**Inline bilingual JSONB (not separate EN/PT rows).** Each `SlideBlock` carries both language payloads in the same JSON object (`heading` + `headingPt`, `body` + `bodyPt`, etc.). Rationale: atomic saves, no join cost, and Claude can output both languages in a single response. The alternative — two separate presentations rows keyed by locale — would complicate the authoring loop and duplicate access-code/slug management.

**Separate `presentation_brand_guidelines` table (not a column on `company_settings`).** `company_settings` already has 40+ columns and serves multiple unrelated concerns. Brand guidelines for presentations are authored and versioned independently. A dedicated singleton table keeps the concern isolated and avoids inflating the already large `insertCompanySettingsSchema`.

**`guidelinesSnapshot` JSONB on `presentations` (snapshot immutability).** When admin saves a presentation, the current `presentation_brand_guidelines.guidelines` row is deep-copied into `presentations.guidelinesSnapshot`. The public viewer reads the snapshot, not the live guidelines. This mirrors the `services` JSONB snapshot pattern from v1.2 — past presentations render consistently after brand changes.

**JSONB slides, not a separate `slides` table.** A normalized `slides` table adds a join on every read, complicates ordering, and provides no query benefit — no use case ever queries individual slides independently. Inline JSONB keeps the fetch to one row and matches how estimates stores services.

---

## 2. API Routes

### 2.1 New file: `server/routes/presentations.ts`

Follows the same structure as `server/routes/estimates.ts`. Exports `registerPresentationsRoutes(app)`.

```
// Public (no auth)
GET  /api/presentations/slug/:slug       -> lookup by slug, strip accessCode, add hasAccessCode
POST /api/presentations/:id/view         -> record view, IP from x-forwarded-for
POST /api/presentations/:id/verify-code  -> plain-text code comparison

// Admin (requireAdmin)
GET    /api/presentations                -> list with viewCount + lastViewedAt
POST   /api/presentations                -> create (auto-generate UUID slug)
PUT    /api/presentations/:id            -> update (title, accessCode, slides)
DELETE /api/presentations/:id            -> delete (cascades presentation_views)

// Brand guidelines (admin)
GET  /api/presentations/guidelines       -> fetch singleton row
PUT  /api/presentations/guidelines       -> upsert singleton row

// AI authoring (admin, streaming)
POST /api/presentations/ai/generate      -> SSE stream: Claude generates slide JSON
POST /api/presentations/ai/edit          -> SSE stream: Claude edits existing slides
```

### 2.2 AI authoring endpoint design

The authoring endpoint uses Server-Sent Events (SSE). The existing codebase does not yet have direct Anthropic streaming; the Anthropic SDK's `messages.stream()` method is the correct integration point.

**Request body:**
```ts
{
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  currentSlides?: SlideBlock[];   // present on edit calls, absent on generate
  presentationId?: number;        // absent when generating a new presentation
}
```

**Server response — SSE stream:**
```
event: slide_delta
data: { type: "slide_delta", slideIndex: number, partial: string }

event: slides_complete
data: { type: "slides_complete", slides: SlideBlock[] }

event: error
data: { type: "error", message: string }
```

**Implementation pattern:**
```ts
app.post("/api/presentations/ai/generate", requireAdmin, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const guidelines = await storage.getBrandGuidelines();
  const systemPrompt = buildSystemPrompt(guidelines);

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: req.body.conversationHistory,
  });

  for await (const chunk of stream) {
    res.write(`event: slide_delta\ndata: ${JSON.stringify(chunk)}\n\n`);
  }

  const finalMessage = await stream.finalMessage();
  const slides = parseSlideBlocks(finalMessage.content);
  res.write(`event: slides_complete\ndata: ${JSON.stringify({ slides })}\n\n`);
  res.end();
});
```

**Claude model choice:** Use `claude-opus-4-5` (or the latest Opus available at implementation time). This is a flagship admin authoring surface — quality over cost, and admin is the only caller. Confirm exact model ID at Phase 4 via the Anthropic models list endpoint.

**Note on Anthropic SDK:** `@anthropic-ai/sdk` is not yet in `package.json`. It must be installed before Phase 4. The existing OpenRouter config already references `anthropic/claude-3.5-sonnet` as a fallback, but for direct Anthropic streaming the native SDK is required.

### 2.3 System prompt construction

`buildSystemPrompt(guidelines: BrandGuidelines): string` lives in `server/lib/presentation-prompt.ts`. It converts the brand guidelines row into the Claude system prompt prefix. Example structure:

```
You are a professional presentation designer for Skale Club, a marketing agency.
Your job is to write bilingual slide content (English + Portuguese/Brazil) in valid JSON.

Brand guidelines:
- Primary color: {guidelines.primaryColor}
- Accent color: {guidelines.accentColor}
- Fonts: {guidelines.fontHeading} (headings), {guidelines.fontBody} (body)
- Tone: {guidelines.tone}
- Always include: {guidelines.alwaysInclude.join(", ")}
- Never include: {guidelines.neverInclude.join(", ")}

Output ONLY a JSON array of slide objects conforming to the SlideBlock schema.
Each slide must have both English (heading, body, bullets) and Portuguese
equivalents (headingPt, bodyPt, bulletsPt).
{guidelines.extraContext}
```

### 2.4 Registration in `server/routes.ts`

Add one import and one call alongside `registerEstimatesRoutes`:

```ts
import { registerPresentationsRoutes } from "./routes/presentations.js";
// inside registerRoutes():
registerPresentationsRoutes(app);
```

---

## 3. Storage Layer

### 3.1 New methods on `IStorage` / `DatabaseStorage`

Add to `server/storage.ts` following the existing estimate methods pattern:

```ts
// Presentations CRUD
listPresentations(): Promise<PresentationWithStats[]>
getPresentation(id: number): Promise<Presentation | null>
getPresentationBySlug(slug: string): Promise<Presentation | null>
createPresentation(data: InsertPresentation): Promise<Presentation>
updatePresentation(id: number, data: Partial<InsertPresentation>): Promise<Presentation>
deletePresentation(id: number): Promise<void>

// Views (mirrors estimate_views pattern exactly)
recordPresentationView(presentationId: number, ipAddress?: string): Promise<void>

// Brand guidelines (singleton — upsert on id=1)
getBrandGuidelines(): Promise<BrandGuidelines | null>
upsertBrandGuidelines(data: BrandGuidelines): Promise<void>
```

`listPresentations` uses a LEFT JOIN on `presentation_views` aggregated by `presentation_id`, identical to the `listEstimates` implementation.

---

## 4. Public Viewer Routing (`/p/:slug`)

### 4.1 App.tsx changes

Add a `isPresentationRoute` guard alongside the existing `isEstimateRoute` guard. The pattern is character-for-character identical — copy, rename, swap the component.

```ts
// Inside Router(), near line 120
const isEstimateRoute = location.startsWith('/e/');
const isPresentationRoute = location.startsWith('/p/');   // ADD
```

Add isolated branch before the main layout return (after the isEstimateRoute block):

```ts
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

Add lazy import at the top of the file:

```ts
const PresentationViewer = lazy(() =>
  import("@/pages/PresentationViewer").then(m => ({
    default: () => <PageWrapper><m.default /></PageWrapper>
  }))
);
```

No AuthProvider wrapper — public viewer is unauthenticated, same as EstimateViewer.

### 4.2 Language switching via query param

`/p/:slug?lang=pt-BR` (default: `en`). The viewer reads `new URLSearchParams(window.location.search).get("lang")` and renders `slide.headingPt` / `slide.bodyPt` when `lang === "pt-BR"`. A language toggle button in the viewer updates the URL param — no page reload since slide data is already loaded. This avoids subpath duplication and keeps all server-side logic language-agnostic.

---

## 5. Admin UI

### 5.1 New files

```
client/src/components/admin/PresentationsSection.tsx
client/src/components/admin/presentations/PresentationChatEditor.tsx
client/src/components/admin/presentations/PresentationListItem.tsx
client/src/components/admin/presentations/BrandGuidelinesEditor.tsx
client/src/components/admin/presentations/SlidePreview.tsx
client/src/pages/PresentationViewer.tsx
```

### 5.2 Admin.tsx wiring — four touch points

All four follow the same pattern as the `estimates` addition:

1. `shared/types.ts` — add `'presentations'` to `AdminSection` union
2. `shared/constants.ts` — add menu item to `SIDEBAR_MENU_ITEMS` (use `Presentation` or `Layout` icon from lucide-react)
3. `Admin.tsx` — import `PresentationsSection`, render `{activeSection === 'presentations' && <PresentationsSection />}`, add to `slugMap`
4. `Admin.tsx` — add `'presentations'` to `sectionsWithOwnHeader` array

**Layout note:** The presentations editor needs the same flex-fill treatment as `chat` (the chat list must fill remaining viewport height). In `Admin.tsx`, add a dedicated branch for `activeSection === 'presentations'` that wraps PresentationsSection in `flex-1 min-h-0 flex flex-col p-6 pb-6`, parallel to the existing `chat` branch.

### 5.3 Chat editor data flow

```
Admin types message
  -> append to local conversationHistory state
  -> POST /api/presentations/ai/generate  { conversationHistory, currentSlides }
  -> server opens Anthropic SSE stream
  -> SSE events arrive at client
      slide_delta events   -> accumulate partial JSON in buffer string
      slides_complete      -> parse SlideBlock[], update previewSlides state
  -> SlidePreview re-renders with new slides (scroll-snap, read-only)
  -> Admin reviews, iterates ("change slide 3", "add a closing slide")
  -> Admin clicks "Save" -> PUT /api/presentations/:id  { slides: previewSlides }
```

Conversation history is client-side only (not persisted to DB between sessions). Past presentations are re-opened for editing by loading their stored slides into the editor, not by replaying a chat history. If chat history persistence is needed later, a `presentation_messages` table can be added without affecting the existing schema.

---

## 6. Phase Build Order

| Phase | Name | What gets built | Key dependency |
|-------|------|----------------|----------------|
| 1 | Schema + Migration | `shared/schema/presentations.ts`, barrel re-export, SQL migration file, `scripts/create-presentations-tables.ts`, `@anthropic-ai/sdk` added to `package.json` | None — foundation |
| 2 | Storage + CRUD API | All storage methods in `storage.ts`, `server/routes/presentations.ts` (all non-AI endpoints), registration in `routes.ts` | Phase 1 (tables must exist) |
| 3 | Brand Guidelines | Guidelines endpoints in `presentations.ts`, `getBrandGuidelines` / `upsertBrandGuidelines` storage methods, `BrandGuidelinesEditor.tsx`, Admin wiring for guidelines sub-section | Phase 2 (storage layer exists) |
| 4 | AI Authoring Endpoint | `server/lib/presentation-prompt.ts`, SSE streaming endpoint (`/ai/generate`, `/ai/edit`), Anthropic SDK integration | Phase 3 (guidelines needed for system prompt) |
| 5 | Admin Chat UI | `PresentationsSection.tsx`, `PresentationChatEditor.tsx`, `PresentationListItem.tsx`, `SlidePreview.tsx`, all Admin.tsx wiring | Phase 4 (streaming endpoint must exist) |
| 6 | Public Viewer | `PresentationViewer.tsx`, App.tsx `isPresentationRoute` guard + lazy import, access-code gate, language switcher, view tracking | Phase 2 (public API routes exist); independent of Phase 5 |

Phases 5 and 6 can be built in parallel once Phase 4 is done. The admin UI and public viewer share no client-side code.

---

## 7. New Files vs Modified Files

### New files

```
shared/schema/presentations.ts
server/routes/presentations.ts
server/lib/presentation-prompt.ts
scripts/create-presentations-tables.ts
migrations/XXXX_create_presentations.sql
client/src/pages/PresentationViewer.tsx
client/src/components/admin/PresentationsSection.tsx
client/src/components/admin/presentations/PresentationChatEditor.tsx
client/src/components/admin/presentations/PresentationListItem.tsx
client/src/components/admin/presentations/BrandGuidelinesEditor.tsx
client/src/components/admin/presentations/SlidePreview.tsx
```

### Modified files

```
shared/schema.ts                                    — add export * from "./schema/presentations.js"
server/storage.ts                                   — import new types, add 8 new methods
server/routes.ts                                    — add registerPresentationsRoutes(app)
client/src/App.tsx                                  — isPresentationRoute guard + PresentationViewer lazy import
client/src/pages/Admin.tsx                          — PresentationsSection import + render + slugMap + sectionsWithOwnHeader + layout branch
client/src/components/admin/shared/types.ts         — AdminSection union gets 'presentations'
client/src/components/admin/shared/constants.ts     — SIDEBAR_MENU_ITEMS gets presentations entry
client/src/lib/translations.ts                      — PT strings for any new t() calls
package.json                                        — @anthropic-ai/sdk dependency
```

---

## 8. Migration Strategy

Follow the established v1.2 raw-SQL tsx pattern exactly:

1. Write `migrations/XXXX_create_presentations.sql` with `CREATE TABLE IF NOT EXISTS` for all three tables.
2. Write `scripts/create-presentations-tables.ts` that reads the SQL file and runs it via `pool.connect()` — same shape as `scripts/create-estimates-table.ts`.
3. Run `tsx scripts/create-presentations-tables.ts` at the end of Phase 1.

Do not use `drizzle-kit push` for this migration. The project has a documented constraint (PROJECT.md Key Decisions): drizzle-kit CJS cannot resolve .js ESM imports. The raw SQL tsx script is the validated pattern.

---

## 9. Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Schema design | HIGH | Directly mirrors estimates.ts — verified line-by-line |
| Route / storage pattern | HIGH | Exact structural copy of estimates.ts, verified in source |
| App.tsx routing | HIGH | isEstimateRoute guard read line-by-line; isPresentationRoute is symmetric |
| Admin wiring | HIGH | All four touch points verified by reading types.ts, constants.ts, Admin.tsx |
| Anthropic SDK streaming | MEDIUM | SDK not yet installed; streaming API shape is documented but exact model ID string requires verification at install time |
| Inline bilingual JSONB | MEDIUM | Design decision based on analysis; no prior art in this codebase, technically straightforward |
| Brand guidelines singleton | HIGH | Pattern matches existing singleton tables (company_settings, twilio_settings) |

---

## 10. Open Questions / Phase Research Flags

- **Anthropic SDK version**: Install `@anthropic-ai/sdk` and verify `messages.stream()` API shape before Phase 4. The SDK had breaking changes between 0.x and 1.x.
- **Model ID confirmation**: Confirm the exact Claude Opus model ID at Phase 4 time via the Anthropic models list — IDs change between versions.
- **SSE client library**: The existing admin chat uses React Query mutations, not SSE. For streaming, PresentationChatEditor needs either `EventSource` or `fetch` with `ReadableStream`. Decide and implement in Phase 5.
- **Slide image source**: `SlideBlock.imageUrl` — does admin upload images via the existing Supabase upload endpoint, or does Claude suggest URLs? Clarify before Phase 5 to determine whether `DragDropUploader` reuse is needed.
- **Guidelines snapshot visibility**: The `guidelinesSnapshot` field on `presentations` is server-side only and must not be sent to the public viewer client. Strip it in the public slug endpoint, same as `accessCode` is stripped in estimates.
