# Phase 18: AI Authoring Endpoint — Research

**Researched:** 2026-04-21
**Domain:** Anthropic SDK streaming + tool_use, Express SSE, SlideBlock JSON schema authoring
**Confidence:** HIGH

---

## Summary

Phase 18 adds a single POST endpoint `POST /api/presentations/:id/chat` that streams a Claude
`tool_use` response as Server-Sent Events (SSE) to the client, then persists the resulting
`SlideBlock[]` to the database. Three moving parts must be correctly wired together: (1) the
Anthropic SDK's `client.messages.stream()` helper, (2) Express SSE headers + `res.write()` flush
loop, and (3) Zod-validated `SlideBlock[]` DB write after stream end.

The SDK is `@anthropic-ai/sdk` version `0.90.0` (already installed). The correct streaming entry
point is `client.messages.stream(params)` — not `.messages.create({ stream: true })`. The stream
helper returns a `MessageStream` with named events (`inputJson`, `contentBlock`, `finalMessage`,
`end`, `error`) that map cleanly onto SSE `data:` writes. For tool_use the critical event is
`inputJson` (fires on every partial JSON delta) and `contentBlock` (fires when the tool block
finishes with fully accumulated input).

The tool must be defined with a hand-written JSON Schema object — `zod-to-json-schema` is NOT
installed and must not be added. The `input_schema` requires `type: "object"` at the top level
with a `slides` array property. Using `tool_choice: { type: "tool", name: "update_slides" }` forces
Claude to always invoke the tool and never emit a plain text response, removing ambiguity in the
handler.

`ANTHROPIC_API_KEY` is not in `.env` or `.env.example`. The plan Wave 0 must include adding this
key to the local `.env` and documenting it in `.env.example`.

**Primary recommendation:** Use `client.messages.stream()` with a single `update_slides` tool, force
invocation via `tool_choice`, collect the full tool input from `finalMessage().content[0].input`,
validate with `z.array(slideBlockSchema).parse(...)`, then persist to DB via the existing
`storage.updatePresentation()`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-11 | `POST /api/presentations/:id/chat` — SSE streaming endpoint; accepts `{ message: string }`; loads `brand_guidelines.content` as system prompt; sends current `slides` as context; calls Claude via `tool_use`; streams `data:` events; saves slides + `guidelinesSnapshot` after stream ends. Admin-auth required. | SDK stream API documented below; SSE pattern documented; storage.updatePresentation() signature confirmed |
| PRES-12 | SlideBlock JSON schema supports all 8 layout variants with bilingual fields; validated by Zod on every DB write. | `slideBlockSchema` exists in shared/schema/presentations.ts; JSON Schema equivalent documented below for tool input_schema |
| PRES-13 | Per-slide edits — Claude receives full `SlideBlock[]` context and returns an updated array with only targeted slides changed. | Full context injection pattern documented; "replace array, not delta" approach confirmed safe |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Frontend stack**: React 18, TypeScript, Vite, Wouter, React Query, shadcn/ui, Tailwind CSS (not relevant to this phase)
- **Backend stack**: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Auth**: `requireAdmin` from `server/routes/_shared.ts` — all chat routes must use this middleware
- **Storage layer**: All DB operations through `server/storage.ts` (IStorage interface). Do NOT write raw SQL in route files.
- **Type-safe API**: `shared/schema.ts` is the source of truth. `slideBlockSchema` already defined in `shared/schema/presentations.ts`.
- **No Redux**: State management is React Query + Context API (frontend concern; N/A for this phase)
- **File length limit**: max 600 lines per file (admin design system rule — N/A for server route files)
- **Translation rule**: Always add PT translations when introducing new `t()` strings. This phase is backend-only; no UI strings added.
- **Border styling rule**: N/A (backend-only phase)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.90.0 (installed) | Claude API client + streaming | Already in place (PRES-04); `getAnthropicClient()` singleton exists |
| `express` | (installed, project standard) | HTTP server + SSE transport | Project standard |
| `zod` | ^3.24.2 (installed) | SlideBlock[] validation before DB write | Project standard; `slideBlockSchema` already authored |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express-async-errors` | (installed) | Async error propagation in routes | Already in `server/app.ts`; route can throw without try-catch wrapping async segments outside SSE context |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `client.messages.stream()` | `client.messages.create({ stream: true })` | `.stream()` is the SDK-blessed helper; emits named events; accumulates partial JSON automatically; `.create({ stream: true })` returns a raw async iterable that requires manual accumulation |
| Hand-written JSON Schema for tool | `zod-to-json-schema` | Not installed; hand-written schema is 30 lines and fully static for this use case; no new dependency needed |
| Single `update_slides` tool + `tool_choice: "tool"` | Free-text response with JSON block | `tool_use` guarantees structured output; forces valid JSON; eliminates markdown fence stripping |

**Version verification:** `@anthropic-ai/sdk` — confirmed 0.90.0 from `node_modules/@anthropic-ai/sdk/package.json`. No installation needed.

---

## Architecture Patterns

### Recommended Project Structure

The chat endpoint lives alongside the existing presentations routes. A new file isolates the AI
logic from the CRUD routes:

```
server/
├── routes/
│   ├── presentations.ts          # Existing CRUD routes (PRES-05–08)
│   └── presentationsChat.ts      # NEW — POST /api/presentations/:id/chat (PRES-11–13)
├── lib/
│   └── anthropic.ts              # Existing getAnthropicClient() singleton
```

`registerPresentationsChatRoutes(app)` is called from `server/routes.ts` alongside the existing
`registerPresentationsRoutes(app)` call.

### Pattern 1: Express SSE Handshake

**What:** Set three headers before writing any data; never call `res.json()` or `res.end()` from
within the stream loop — only `res.write()`.

**When to use:** Any endpoint returning `text/event-stream`.

```typescript
// Source: Express docs + MDN SSE specification
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.flushHeaders(); // Send headers immediately before data arrives
```

SSE event format — each event is a line starting with `data:` followed by a blank line:

```
data: {"type":"progress","message":"Generating slides..."}\n\n
data: {"type":"done","slides":[...]}\n\n
```

### Pattern 2: `client.messages.stream()` + tool_use

**What:** Use the SDK's `MessageStream` helper, which accumulates `input_json_delta` events and
emits `inputJson` on each partial, plus `contentBlock` when a block finishes and `finalMessage`
when the full message is complete.

**When to use:** Any streaming call that includes tools.

```typescript
// Source: @anthropic-ai/sdk 0.90.0 — MessageStream.ts + messages.ts (inspected directly)
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: brandGuidelinesContent,          // brand guidelines as system prompt
  messages: [{ role: "user", content: userMessage }],
  tools: [UPDATE_SLIDES_TOOL],             // defined below
  tool_choice: { type: "tool", name: "update_slides" },  // force invocation
});
```

**Stream event hooks for SSE forwarding:**

```typescript
stream.on("inputJson", (_partial, _snapshot) => {
  // Fire-and-forget progress tick — client can show spinner/progress
  res.write(`data: ${JSON.stringify({ type: "progress" })}\n\n`);
});

stream.on("error", (err) => {
  res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  res.end();
});

const finalMsg = await stream.finalMessage();
```

### Pattern 3: `update_slides` Tool Definition (hand-written JSON Schema)

**What:** Define the tool with a JSON Schema that matches `slideBlockSchema`. The `input_schema`
property of an Anthropic tool requires `{ type: "object", properties: {...} }`.

**Why hand-written:** `zod-to-json-schema` is not installed and the schema is static.

```typescript
// Source: Tool interface in @anthropic-ai/sdk 0.90.0 resources/messages/messages.ts (inspected)
const UPDATE_SLIDES_TOOL = {
  name: "update_slides",
  description:
    "Replace the presentation's slide array with the updated version. " +
    "Return ALL slides — both modified and unmodified. " +
    "Preserve slides that were not requested to change byte-for-byte.",
  input_schema: {
    type: "object" as const,
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          required: ["layout"],
          properties: {
            layout: {
              type: "string",
              enum: ["cover","section-break","title-body","bullets","stats","two-column","image-focus","closing"],
            },
            heading:    { type: "string" },
            headingPt:  { type: "string" },
            body:       { type: "string" },
            bodyPt:     { type: "string" },
            bullets:    { type: "array", items: { type: "string" } },
            bulletsPt:  { type: "array", items: { type: "string" } },
            stats: {
              type: "array",
              items: {
                type: "object",
                required: ["label", "value"],
                properties: {
                  label:   { type: "string" },
                  value:   { type: "string" },
                  labelPt: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    required: ["slides"],
  },
} satisfies import("@anthropic-ai/sdk").Tool;
```

### Pattern 4: Extracting Tool Input from `finalMessage`

After the stream completes, Claude's `tool_use` block is in `finalMessage.content`:

```typescript
// Source: MessageStream finalMessage() API — MessageStream.ts (inspected)
const finalMsg = await stream.finalMessage();
const toolBlock = finalMsg.content.find(b => b.type === "tool_use");
if (!toolBlock || toolBlock.type !== "tool_use") {
  throw new Error("Claude did not invoke update_slides tool");
}
const parsed = z.array(slideBlockSchema).safeParse(toolBlock.input.slides);
if (!parsed.success) {
  res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid slide schema" })}\n\n`);
  res.end();
  return;
}
```

### Pattern 5: Context Injection for Partial Edits (PRES-13)

To support "edit slide 3 — shorten the body", the **entire current slides array** is injected into
the user message content so Claude can read it. Claude must return all slides (including untouched
ones) in the tool call response.

```typescript
// Source: PRES-13 requirement + standard Claude prompting practice
const existing = await storage.getPresentation(req.params.id);
const currentSlidesJson = JSON.stringify(existing.slides);

const userMessage =
  `Current slides:\n${currentSlidesJson}\n\nInstruction: ${req.body.message}`;
```

The system prompt instructs Claude: "When editing existing slides, preserve all non-targeted
slides exactly as provided. Return the complete updated array."

### Pattern 6: DB Persist After Stream End

```typescript
// Source: storage.updatePresentation() signature confirmed in storage.ts
await storage.updatePresentation(req.params.id, {
  slides: parsed.data,
  guidelinesSnapshot: guidelines,
  version: existing.version + 1,  // manual version increment — same pattern as PUT route
});
res.write(`data: ${JSON.stringify({ type: "done", slides: parsed.data })}\n\n`);
res.end();
```

### Anti-Patterns to Avoid

- **Do not use `client.messages.create({ stream: true })`** for this endpoint. The raw `Stream`
  iterator requires manual JSON accumulation for tool inputs; `.stream()` does this automatically
  via `partialParse` and emits `inputJson` events.
- **Do not call `res.json()` after SSE headers are set.** Once `text/event-stream` headers are
  sent, all writes must use `res.write("data: ...\n\n")` and terminate with `res.end()`.
- **Do not call `next(err)` after SSE has started.** Express error middleware calls `res.json()`
  which fails after headers are sent. Catch errors inside the stream loop and write an SSE `error`
  event, then `res.end()`.
- **Do not generate `version` in the route from scratch.** Fetch `existing.version` first and
  inject `existing.version + 1` — same pattern as the existing PUT route.
- **Do not use `tool_choice: "auto"`** when the goal is structured output. Always force
  `{ type: "tool", name: "update_slides" }` to guarantee Claude calls the tool.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Partial JSON accumulation during streaming | Custom string concatenation + try/catch parse | `client.messages.stream()` — `inputJson` event fires with `partialParse` result | SDK accumulates `input_json_delta` events internally via `partialParse()` (from `_vendor/partial-json-parser`) |
| SSE connection heartbeat | Timer-based keepalive pings | Not needed for short AI calls | Claude responses complete in <30s; no proxy timeout concern for this use case |
| JSON Schema from Zod | `zod-to-json-schema` npm package | Hand-written static JSON Schema (30 lines) | `zod-to-json-schema` not installed; schema is stable and small |

**Key insight:** The SDK's `MessageStream` class handles everything messy about streaming `tool_use`:
partial JSON accumulation, event normalization, promise-based `finalMessage()` access, and abort
handling. Using it directly means zero bespoke stream parsing code.

---

## Common Pitfalls

### Pitfall 1: SSE Headers Not Flushed Before Async Work

**What goes wrong:** `res.setHeader()` calls are made but `res.flushHeaders()` is not called.
Express buffers headers until `res.write()` or `res.end()`. The client won't see a streaming
response until all buffering is released.

**Why it happens:** SSE is a special case where headers must be sent before the body begins.
Express's default header-sending behavior is tied to `res.write()`, but in async gaps the client
socket might buffer.

**How to avoid:** Call `res.flushHeaders()` immediately after setting the three SSE headers, before
any `await` calls.

**Warning signs:** `curl --no-buffer` shows no output until the stream completes; browser
EventSource fires `open` but receives events all at once.

### Pitfall 2: `res.headersSent` Guard Omitted in Error Path

**What goes wrong:** An unhandled error occurs after SSE headers are sent. The Express error
middleware calls `res.status(500).json(...)`, which throws "Can't set headers after they are sent".

**Why it happens:** `server/app.ts` error handler has a `res.headersSent` guard (`return _next(err)`)
but calling `next(err)` after SSE start still routes to the error handler which tries to write JSON.

**How to avoid:** All error handling inside the SSE endpoint must be done inline:
```typescript
} catch (err) {
  if (!res.headersSent) {
    res.status(500).json({ message: (err as Error).message });
  } else {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
}
```

### Pitfall 3: `ANTHROPIC_API_KEY` Not Set

**What goes wrong:** `getAnthropicClient()` throws `"ANTHROPIC_API_KEY must be set"` at request
time, which after SSE headers are sent results in an unrecoverable silent error or a broken stream.

**Why it happens:** `ANTHROPIC_API_KEY` is not in `.env` or `.env.example` — it was not required
by phases 15–17. Phase 18 is the first phase that actually calls the Anthropic API.

**How to avoid:** Wave 0 must add `ANTHROPIC_API_KEY=` to `.env.example` and the developer must
set it in `.env`. The route should check for the key before setting SSE headers:
```typescript
try { getAnthropicClient(); } catch (e) {
  return res.status(503).json({ message: "Anthropic API not configured" });
}
```

**Warning signs:** Route responds with JSON error (good — caught before SSE headers sent), or
silent empty stream if not caught.

### Pitfall 4: `finalMessage()` Called Outside `try/catch`

**What goes wrong:** If the Anthropic API returns an error (rate limit, model overload), `stream.finalMessage()`
rejects. Without a catch, the promise rejection is unhandled.

**Why it happens:** `MessageStream` emits an `error` event AND rejects the `finalMessage()` promise.
The `stream.on("error")` handler may call `res.end()` but `finalMessage()` await still throws.

**How to avoid:** Wrap the entire stream block in try/catch; `stream.on("error")` is for
early notification but `finalMessage()` await must also be inside the try block.

### Pitfall 5: Injecting `version` From Request Body Instead of DB

**What goes wrong:** The `updatePresentation` call passes `version: req.body.version || 1`,
producing stale version numbers or always resetting to 1.

**Why it happens:** Same pitfall documented for the PUT route (see STATE.md Phase 16 decision).

**How to avoid:** Always fetch `storage.getPresentation(id)` first and use `existing.version + 1`.
The `getPresentation()` call is already needed to load current slides for context (PRES-13), so
this is a free fetch.

### Pitfall 6: `tool_choice: "auto"` Lets Claude Respond in Text

**What goes wrong:** Claude decides the user's message is conversational (e.g., "hello") and
returns a plain `text` content block instead of a `tool_use` block. The handler then fails to find
the tool block and throws.

**Why it happens:** `tool_choice: "auto"` (the default) allows Claude to choose. Casual messages
or greetings trigger text responses.

**How to avoid:** Always use `tool_choice: { type: "tool", name: "update_slides" }`. The tool
description should explain that Claude should populate the slides property with the full deck
(even if the instruction was conversational — produce a minimal or unchanged deck rather than
refusing to call the tool).

---

## Code Examples

### Full SSE Chat Endpoint Skeleton

```typescript
// Source: Synthesized from @anthropic-ai/sdk 0.90.0 MessageStream.ts + Express SSE conventions
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";
import { getAnthropicClient } from "../lib/anthropic.js";
import { slideBlockSchema, UPDATE_SLIDES_TOOL } from "#shared/schema.js";

export function registerPresentationsChatRoutes(app: Express) {
  app.post("/api/presentations/:id/chat", requireAdmin, async (req, res) => {
    // 1. Validate request body
    const bodyParsed = z.object({ message: z.string().min(1).max(4000) }).safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ message: "message is required" });
    }

    // 2. Pre-flight: fail fast before SSE headers if Anthropic key is missing
    try { getAnthropicClient(); } catch {
      return res.status(503).json({ message: "Anthropic API not configured" });
    }

    // 3. Load presentation + brand guidelines (MUST happen before SSE headers)
    const existing = await storage.getPresentation(req.params.id);
    if (!existing) return res.status(404).json({ message: "Presentation not found" });
    const guidelinesRow = await storage.getBrandGuidelines();
    const guidelines = guidelinesRow?.content ?? "";

    // 4. Set SSE headers + flush BEFORE any streaming begins
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const client = getAnthropicClient();
      const userMessage =
        `Current slides:\n${JSON.stringify(existing.slides)}\n\nInstruction: ${bodyParsed.data.message}`;

      const stream = client.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: guidelines || "You are a presentation author. Always call update_slides.",
        messages: [{ role: "user", content: userMessage }],
        tools: [UPDATE_SLIDES_TOOL],
        tool_choice: { type: "tool", name: "update_slides" },
      });

      // Stream progress ticks to client
      stream.on("inputJson", () => {
        res.write(`data: ${JSON.stringify({ type: "progress" })}\n\n`);
      });

      const finalMsg = await stream.finalMessage();
      const toolBlock = finalMsg.content.find(b => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        throw new Error("Claude did not invoke update_slides");
      }

      const validation = z.array(slideBlockSchema).safeParse(
        (toolBlock.input as any).slides
      );
      if (!validation.success) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid slide schema from Claude" })}\n\n`);
        res.end();
        return;
      }

      // Persist to DB
      await storage.updatePresentation(req.params.id, {
        slides: validation.data,
        guidelinesSnapshot: guidelines,
        version: existing.version + 1,
      });

      res.write(`data: ${JSON.stringify({ type: "done", slides: validation.data })}\n\n`);
      res.end();

    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
      res.end();
    }
  });
}
```

### `UPDATE_SLIDES_TOOL` Constant (export from shared or server/lib)

```typescript
// Source: Tool interface spec from @anthropic-ai/sdk 0.90.0 (inspected directly)
import type { Tool } from "@anthropic-ai/sdk";

export const UPDATE_SLIDES_TOOL: Tool = {
  name: "update_slides",
  description:
    "Replace the entire slides array for this presentation. " +
    "Always return ALL slides — preserve unmodified slides verbatim. " +
    "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with Portuguese translations.",
  input_schema: {
    type: "object",
    required: ["slides"],
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          required: ["layout"],
          properties: {
            layout: { type: "string", enum: ["cover","section-break","title-body","bullets","stats","two-column","image-focus","closing"] },
            heading:   { type: "string" },
            headingPt: { type: "string" },
            body:      { type: "string" },
            bodyPt:    { type: "string" },
            bullets:   { type: "array", items: { type: "string" } },
            bulletsPt: { type: "array", items: { type: "string" } },
            stats: {
              type: "array",
              items: {
                type: "object",
                required: ["label","value"],
                properties: {
                  label:   { type: "string" },
                  value:   { type: "string" },
                  labelPt: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.messages.create({ stream: true })` raw async iterator | `client.messages.stream()` MessageStream helper | SDK ~0.20+ | `stream()` accumulates `input_json_delta` automatically; named events replace manual for-await loop |
| Manual JSON schema for tools | `zodOutputFormat()` structured outputs (beta) | SDK ~0.85+ | `zodOutputFormat` + `messages.parse()` is an alternative path but requires beta header and does not work with `stream()` in the same way; tool_use is more stable for production |

**Deprecated/outdated:**
- `AnthropicBedrock` / `AnthropicVertex` wrappers: different clients for AWS/GCP — not applicable here
- `client.messages.stream()` with `output_config.format` + `zodOutputFormat`: This is a newer
  structured outputs path but uses a different code path than tool_use. Avoid for this phase —
  the `tool_use` approach is more predictable for large JSON arrays.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | PRES-11 AI calls | Yes | 0.90.0 | — |
| `ANTHROPIC_API_KEY` env var | `getAnthropicClient()` | NOT SET | — | None — blocking |
| PostgreSQL | storage.updatePresentation() | Yes (project-wide) | — | — |
| Node.js 18+ | SDK requirement | Yes (project-wide) | — | — |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — must be added to `.env` before the endpoint can be exercised. Wave 0 task:
  add `ANTHROPIC_API_KEY=` to `.env.example`; developer adds real value to `.env`.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. No existing test framework is
installed (no `jest.config.*`, `vitest.config.*`, or `test` npm script detected in `package.json`).
All four test strategies below are manual/curl-based — they require the dev server to be running.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — manual curl + server log verification |
| Config file | None |
| Quick run command | `npm run dev` then use curl commands below |
| Full suite command | Same — all tests are curl-based for this phase |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-11 | SSE stream emits `data:` events progressively | smoke (curl) | See SSE stream test below | N/A |
| PRES-11 | DB `slides` and `guidelinesSnapshot` updated after stream ends | integration (curl + DB query) | See DB write test below | N/A |
| PRES-12 | SlideBlock Zod validation passes for all 8 variants | unit (inline script) | See Zod unit test below | Wave 0 |
| PRES-13 | Partial edit preserves untouched slides byte-for-byte | integration (curl + DB query) | See partial edit test below | N/A |

### Test 1: SSE Stream Emits `data:` Events Before Stream Closes

```bash
# Verify progressive streaming — events arrive before connection closes
# Requires: dev server running, valid admin session cookie, ANTHROPIC_API_KEY set
curl -N --no-buffer -b "session=<admin-cookie>" \
  -X POST http://localhost:1000/api/presentations/<id>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a 3-slide deck about digital marketing"}' \
  2>&1 | head -20
# Expected: multiple "data: {\"type\":\"progress\"}" lines appear BEFORE the final
# "data: {\"type\":\"done\",...}" line — not all at once
```

### Test 2: DB Slides Updated After Stream Completes

```bash
# After Test 1 completes, verify DB was written
curl -s -b "session=<admin-cookie>" \
  http://localhost:1000/api/presentations/<id> | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const p=JSON.parse(d);
console.log('slideCount:', p.slides?.length);
console.log('guidelinesSnapshot set:', !!p.guidelinesSnapshot);
console.log('version incremented:', p.version);
"
# Expected: slides.length > 0, guidelinesSnapshot truthy, version = previous + 1
```

### Test 3: SlideBlock Zod Validation for All 8 Variants (Unit — Wave 0 gap)

```typescript
// File: server/lib/__tests__/slideBlockSchema.test.ts
// Run: npx tsx server/lib/__tests__/slideBlockSchema.test.ts
import { z } from "zod";
import { slideBlockSchema } from "#shared/schema.js";

const fixtures = [
  { layout: "cover", heading: "H", headingPt: "H-PT" },
  { layout: "section-break", heading: "Section" },
  { layout: "title-body", heading: "Title", body: "Body", headingPt: "Título", bodyPt: "Corpo" },
  { layout: "bullets", heading: "Points", bullets: ["A","B"], bulletsPt: ["A-PT","B-PT"] },
  { layout: "stats", stats: [{ label: "Clients", value: "120", labelPt: "Clientes" }] },
  { layout: "two-column", heading: "Col A", body: "Col B" },
  { layout: "image-focus", heading: "Image Title" },
  { layout: "closing", heading: "Thank You", headingPt: "Obrigado" },
];

const schema = z.array(slideBlockSchema);
const result = schema.safeParse(fixtures);
if (!result.success) {
  console.error("FAIL:", JSON.stringify(result.error.errors, null, 2));
  process.exit(1);
}
console.log("PASS: All 8 SlideBlock variants validate correctly");
```

### Test 4: Partial Edit Preserves Untouched Slides Byte-for-Byte

```bash
# Setup: Create a presentation with 5 known slides via PUT
# Then call chat endpoint asking to edit only slide 3
curl -s -b "session=<admin-cookie>" \
  -X PUT http://localhost:1000/api/presentations/<id> \
  -H "Content-Type: application/json" \
  -d '{"slides":[
    {"layout":"cover","heading":"Slide 1"},
    {"layout":"title-body","heading":"Slide 2","body":"Body 2"},
    {"layout":"bullets","heading":"Slide 3","bullets":["Long bullet that needs shortening here"]},
    {"layout":"stats","heading":"Slide 4","stats":[{"label":"L","value":"V"}]},
    {"layout":"closing","heading":"Slide 5"}
  ]}'

curl -N --no-buffer -b "session=<admin-cookie>" \
  -X POST http://localhost:1000/api/presentations/<id>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"edit slide 3 — shorten the bullet to 3 words"}'

# Then verify slide indices 0,1,3,4 are byte-for-byte preserved:
curl -s -b "session=<admin-cookie>" \
  http://localhost:1000/api/presentations/<id> | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const p=JSON.parse(d);
const s=p.slides;
console.log('slide[0] preserved:', JSON.stringify(s[0])==='{\\"layout\\":\\"cover\\",\\"heading\\":\\"Slide 1\\"}');
console.log('slide[1] preserved:', s[1].heading==='Slide 2');
console.log('slide[2] changed:', s[2].bullets[0] !== 'Long bullet that needs shortening here');
console.log('slide[3] preserved:', s[3].stats[0].label==='L');
console.log('slide[4] preserved:', s[4].heading==='Slide 5');
"
```

### Sampling Rate

- **Per task commit:** Run Test 3 (Zod unit script) — `npx tsx server/lib/__tests__/slideBlockSchema.test.ts`
- **Per wave merge:** Run Tests 1, 2, and 3 with a live dev server
- **Phase gate:** All four tests pass + `npm run check` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/lib/__tests__/slideBlockSchema.test.ts` — covers PRES-12 (Zod 8-variant unit test)
- [ ] `ANTHROPIC_API_KEY=` added to `.env.example` — required for PRES-11 to be exercisable
- [ ] `.env` — developer must set real `ANTHROPIC_API_KEY` value locally

*(No test framework install needed — the unit test uses `npx tsx` which is already available via the `tsx` dev dependency)*

---

## Open Questions

1. **Which Claude model string to use?**
   - What we know: `server/app.ts` uses `getActiveAIClient()` for the OpenAI/Groq shim which
     reads `claude-sonnet-4-6` equivalents from settings. The Anthropic singleton is separate.
   - What's unclear: Should the model be hardcoded in the route, or read from `integrationSettings`?
   - Recommendation: Hardcode `"claude-sonnet-4-6"` for Phase 18. Phase 19 can add a model
     selector if needed. The `getAnthropicClient()` singleton is already separate from the AI
     provider shim.

2. **Should `UPDATE_SLIDES_TOOL` be exported from `shared/schema.ts` or live in `server/lib/`?**
   - What we know: `shared/schema.ts` exports Zod types; the tool is server-only (never needed
     by the client).
   - Recommendation: Define `UPDATE_SLIDES_TOOL` in `server/routes/presentationsChat.ts` or a
     new `server/lib/slidesTool.ts`. Do NOT put it in `shared/` — it imports `@anthropic-ai/sdk`
     which is a server-only dep and would bloat the client bundle.

3. **`max_tokens` sizing for large slide arrays?**
   - What we know: 8 slides with full bilingual text can easily exceed 1000 tokens of output.
     `max_tokens: 4096` is a safe default for up to ~15 slides.
   - Recommendation: Use `max_tokens: 4096` as a default. Document this in the route comment.
     If a presentation grows beyond ~20 slides, the caller can increase or this becomes a
     Phase 19 configuration option.

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@anthropic-ai/sdk/src/lib/MessageStream.ts` — inspected directly; `inputJson`,
  `contentBlock`, `finalMessage`, `error`, `end` event signatures confirmed
- `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` — `Tool` interface,
  `ToolChoiceTool` interface, `stream()` method signature confirmed
- `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` line 154 — `stream()` method signature
- `server/storage.ts` lines 1906–1913 — `updatePresentation()` signature and behavior confirmed
- `server/routes/_shared.ts` — `requireAdmin` middleware confirmed
- `shared/schema/presentations.ts` — `slideBlockSchema` (all 8 variants), `SlideBlock` type confirmed
- `server/lib/anthropic.ts` — `getAnthropicClient()` singleton confirmed
- `server/routes/brandGuidelines.ts` — `getBrandGuidelines()` pattern confirmed
- `server/app.ts` — Express setup, error middleware `res.headersSent` guard confirmed

### Secondary (MEDIUM confidence)

- Express SSE pattern (headers + `flushHeaders()` + `res.write("data: ...\n\n")`) — standard
  HTTP/1.1 specification; no verification needed beyond Express docs
- `tool_choice: { type: "tool", name: "..." }` forcing tool invocation — confirmed via
  `ToolChoiceTool` interface in SDK source (`messages.ts` line 1780)

### Tertiary (LOW confidence)

- None — all critical claims verified from SDK source or existing project code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK version confirmed from installed package; all APIs inspected from source
- Architecture: HIGH — patterns derived from SDK source + existing project conventions
- Pitfalls: HIGH — derived from SDK source inspection + existing route patterns in codebase
- Environment: HIGH — `ANTHROPIC_API_KEY` absence confirmed from `.env` and `.env.example` inspection

**Research date:** 2026-04-21
**Valid until:** 2026-07-21 (90 days — SDK APIs are stable; tool_use interface is GA)
