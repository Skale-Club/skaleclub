---
phase: 18
slug: ai-authoring-endpoint
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — manual curl + inline tsx script |
| **Config file** | None |
| **Quick run command** | `npm run dev` then curl commands below |
| **Full suite command** | `npx tsx server/lib/__tests__/slideBlockSchema.test.ts` + curl tests |
| **Estimated runtime** | ~30 seconds (curl tests require running server) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run Zod unit test + curl SSE smoke test
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | PRES-12 | unit | `npx tsx server/lib/__tests__/slideBlockSchema.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | PRES-11 | smoke (curl) | See Test 1 below | N/A | ⬜ pending |
| 18-01-03 | 01 | 1 | PRES-11 | integration | See Test 2 below | N/A | ⬜ pending |
| 18-01-04 | 01 | 1 | PRES-13 | integration | See Test 4 below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/lib/__tests__/slideBlockSchema.test.ts` — Zod unit test for all 8 SlideBlock variants (PRES-12)
- [ ] `ANTHROPIC_API_KEY` added to `.env.example` — endpoint cannot be exercised without it

*No test framework install needed — uses `npx tsx` which is already available.*

---

## Test 1: SSE Stream Emits `data:` Events Before Stream Closes (PRES-11)

```bash
# Verify progressive streaming — events arrive before connection closes
# Requires: dev server running, valid admin session cookie, ANTHROPIC_API_KEY set
curl -N --no-buffer -b "session=<admin-cookie>" \
  -X POST http://localhost:5000/api/presentations/<id>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a 3-slide deck about digital marketing"}' \
  2>&1 | head -20
# Expected: multiple "data: {\"type\":\"progress\"}" lines appear BEFORE the final
# "data: {\"type\":\"done\",...}" line — not all at once
```

## Test 2: DB Slides Updated After Stream Completes (PRES-11)

```bash
# After Test 1 completes, verify DB was written
curl -s -b "session=<admin-cookie>" \
  http://localhost:5000/api/presentations/<id> | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const p=JSON.parse(d);
console.log('slideCount:', p.slides?.length);
console.log('guidelinesSnapshot set:', !!p.guidelinesSnapshot);
console.log('version:', p.version);
"
# Expected: slides.length > 0, guidelinesSnapshot truthy, version = previous + 1
```

## Test 3: SlideBlock Zod Validation for All 8 Variants (PRES-12) — Wave 0 unit test

```typescript
// File: server/lib/__tests__/slideBlockSchema.test.ts
// Run: npx tsx server/lib/__tests__/slideBlockSchema.test.ts
import { slideBlockSchema } from "../../../shared/schema.js";
import { z } from "zod";

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

## Test 4: Partial Edit Preserves Untouched Slides Byte-for-Byte (PRES-13)

```bash
# 1. Create a presentation with 5 known slides via PUT /api/presentations/:id
# 2. Send targeted edit message
curl -N --no-buffer -b "session=<admin-cookie>" \
  -X POST http://localhost:5000/api/presentations/<id>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Edit slide 3 — shorten the body to one sentence"}' \
  2>&1 | tail -5
# 3. Fetch updated presentation and verify slides[0,1,3,4] unchanged
curl -s -b "session=<admin-cookie>" \
  http://localhost:5000/api/presentations/<id> | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const p=JSON.parse(d);
// Compare slides[0,1,3,4] against known originals
console.log('Slide 3 (index 2) changed:', JSON.stringify(p.slides[2]));
"
# Expected: slides[2] has shorter body; other slides unchanged
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE progress events arrive progressively | PRES-11 | Requires live API call + timing observation | Run Test 1 and observe events arriving in real-time with `--no-buffer` |
| Stream error event on invalid message | PRES-11 | Edge case requiring mock/bad API key | Set invalid ANTHROPIC_API_KEY and verify `data: {"type":"error",...}` event sent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
