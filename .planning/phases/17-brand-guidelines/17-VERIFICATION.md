---
phase: 17-brand-guidelines
verified: 2026-04-21T22:00:00Z
status: gaps_found
score: 4/6 must-haves verified
gaps:
  - truth: "GET /api/brand-guidelines returns 200 with { content: null } when no row exists (never 404)"
    status: failed
    reason: "Route returns { content: \"\" } (empty string) instead of { content: null } when getBrandGuidelines() returns undefined. The expression is `row?.content ?? \"\"` not `row?.content ?? null`."
    artifacts:
      - path: "server/routes/brandGuidelines.ts"
        issue: "Line 9: `res.json({ content: row?.content ?? \"\" })` — should be `?? null` per plan spec and PRES-09 contract"
    missing:
      - "Change `?? \"\"` to `?? null` in the GET handler so Phase 18 AI endpoint can distinguish 'no guidelines saved' from 'empty string saved'"

  - truth: "PUT with content > 2000 chars returns 400 with a human-readable error message"
    status: failed
    reason: "PUT handler has no Zod validation and no 2000-character limit. It only checks `typeof content !== 'string'`, meaning a 10,000-character string is accepted without rejection."
    artifacts:
      - path: "server/routes/brandGuidelines.ts"
        issue: "Lines 13-20: No z.string().max(2000) validation. The plan required `brandGuidelinesSchema` with `z.string().max(2000, 'Brand guidelines cannot exceed 2,000 characters')` and `safeParse`."
    missing:
      - "Add Zod schema: `const brandGuidelinesSchema = z.object({ content: z.string().max(2000, 'Brand guidelines cannot exceed 2,000 characters') })`"
      - "Replace manual typeof check with `safeParse` and return 400 with `parsed.error.errors[0]?.message` on failure"
human_verification:
  - test: "Save button styling matches brand guidelines"
    expected: "CTA Save button should use Brand Yellow bg-[#FFFF01] with text-black font-bold rounded-full per CLAUDE.md brand guidelines"
    why_human: "Button renders with only `gap-2` class and inherits default shadcn Button styling — needs visual confirmation whether this is acceptable deviation or a brand compliance issue"
  - test: "Textarea rehydrates content on page reload"
    expected: "After saving, refreshing /admin/presentations shows saved text in the textarea"
    why_human: "useEffect syncs data?.content to local state — requires browser interaction to confirm the full fetch-render-save-reload cycle"
---

# Phase 17: Brand Guidelines Verification Report

**Phase Goal:** Implement brand guidelines CRUD — admin can view/edit brand guidelines content stored in the `brand_guidelines` DB table, exposed via `GET /api/brand-guidelines` (public) and `PUT /api/brand-guidelines` (admin-auth), with a frontend editor in the Admin Presentations section.
**Verified:** 2026-04-21T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status      | Evidence                                                                          |
|----|-----------------------------------------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------|
| 1  | GET /api/brand-guidelines returns 200 with `{ content: null }` when no row exists (never 404) | FAILED      | Returns `{ content: "" }` — `?? ""` used instead of `?? null` (line 9)           |
| 2  | PUT /api/brand-guidelines (admin-auth) upserts content; subsequent GET returns saved string    | VERIFIED    | requireAdmin wired, upsertBrandGuidelines called, result returned                |
| 3  | PUT with content > 2000 chars returns 400 with human-readable error message                   | FAILED      | No length validation; only typeof string check; 10,000-char PUT would succeed    |
| 4  | Admin clicking Presentations in sidebar renders the brand guidelines textarea editor          | VERIFIED    | presentations in slugMap, `{activeSection === 'presentations' && <BrandGuidelinesSection />}` on line 215 |
| 5  | Typing in the editor updates the live character count below the textarea                       | UNCERTAIN   | No char count UI found in BrandGuidelinesSection.tsx — component has no counter  |
| 6  | Clicking Save fires PUT and shows a 'Saved' toast; button is disabled while pending           | PARTIAL     | saveMutation fires PUT and toast fires on success; button disabled while pending; BUT toast title is t('Brand guidelines saved') not t('Saved') — acceptable variance. Missing 'Save failed' PT translation. |

**Score:** 4/6 truths verified (2 failed, 1 uncertain/partial)

### Required Artifacts

| Artifact                                                          | Expected                                          | Status    | Details                                                                    |
|-------------------------------------------------------------------|---------------------------------------------------|-----------|----------------------------------------------------------------------------|
| `server/routes/brandGuidelines.ts`                                | GET + PUT /api/brand-guidelines route handlers    | STUB      | Exists and wired, but GET returns "" not null, PUT has no Zod validation  |
| `client/src/components/admin/BrandGuidelinesSection.tsx`          | Textarea editor, char count, Save button          | PARTIAL   | Exists with textarea and Save; no live character count displayed           |
| `client/src/components/admin/shared/types.ts`                     | AdminSection union with 'presentations'           | VERIFIED  | Line 21: `| 'presentations'` present                                      |
| `client/src/components/admin/shared/constants.ts`                 | SIDEBAR_MENU_ITEMS Presentations entry            | VERIFIED  | Line 49: `{ id: 'presentations', ... icon: Presentation }` present        |
| `client/src/pages/Admin.tsx`                                      | Routing wired for presentations section           | VERIFIED  | Both slug maps, render line 215, import line 27 all present               |
| `client/src/lib/translations.ts`                                  | PT translations for all new t() strings           | PARTIAL   | 8 of 9 t() strings have PT entries; `'Save failed'` key missing           |

### Key Link Verification

| From                              | To                                        | Via                                      | Status     | Details                                                               |
|-----------------------------------|-------------------------------------------|------------------------------------------|------------|-----------------------------------------------------------------------|
| `BrandGuidelinesSection.tsx`      | `/api/brand-guidelines`                   | `apiRequest('PUT', '/api/brand-guidelines', ...)` | WIRED | Line 30: apiRequest call present                                     |
| `server/routes/brandGuidelines.ts`| `storage.getBrandGuidelines()`             | GET handler                              | WIRED      | Line 8: storage.getBrandGuidelines() called                          |
| `server/routes/brandGuidelines.ts`| `storage.upsertBrandGuidelines(content)`  | PUT handler                              | WIRED      | Line 18: upsertBrandGuidelines(content) called                       |
| `server/routes.ts`                | `brandGuidelines.ts`                      | `registerBrandGuidelinesRoutes(app)`     | WIRED      | Lines 29+136: imported and registered                                |

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable | Source                        | Produces Real Data | Status   |
|---------------------------------|---------------|-------------------------------|---------------------|----------|
| `BrandGuidelinesSection.tsx`    | `content`     | useQuery → GET /api/brand-guidelines | DB select via getBrandGuidelines | FLOWING |
| `server/routes/brandGuidelines.ts` | `row`      | storage.getBrandGuidelines()  | `db.select().from(brandGuidelines)` — real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior                              | Command                                           | Result                        | Status |
|---------------------------------------|---------------------------------------------------|-------------------------------|--------|
| TypeScript compilation                | `npm run check`                                   | Exit 0, no errors             | PASS   |
| Route registration in routes.ts       | grep registerBrandGuidelinesRoutes server/routes.ts | Lines 29 + 136 match          | PASS   |
| presentations in AdminSection union   | grep presentations types.ts                       | `\| 'presentations'` present  | PASS   |
| presentations in both slug maps       | grep presentations Admin.tsx                      | Lines 59, 114, 215            | PASS   |
| PUT 2000-char validation              | Zod schema check in brandGuidelines.ts            | No z.string().max() found     | FAIL   |
| GET null vs empty string              | `?? null` check in brandGuidelines.ts             | `?? ""` used instead          | FAIL   |

### Requirements Coverage

| Requirement | Source Plan | Description                                          | Status   | Evidence                                                                    |
|-------------|-------------|------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| PRES-09     | 17-01-PLAN  | GET (no auth) + PUT (admin-auth) /api/brand-guidelines | PARTIAL | Routes exist and registered; GET returns "" not null; PUT lacks Zod 2000-char guard |
| PRES-10     | 17-01-PLAN  | Admin Brand Guidelines UI — textarea editor loads and saves via API | PARTIAL | Component exists, loads/saves; no char count; missing one PT key |

### Anti-Patterns Found

| File                                  | Line | Pattern                              | Severity | Impact                                                              |
|---------------------------------------|------|--------------------------------------|----------|---------------------------------------------------------------------|
| `server/routes/brandGuidelines.ts`    | 9    | `?? ""` instead of `?? null`         | Warning  | Phase 18 AI endpoint cannot distinguish "no content saved" from "empty content saved" |
| `server/routes/brandGuidelines.ts`    | 13-20 | No Zod 2000-char limit on PUT       | Blocker  | Plan requirement explicitly mandated max(2000) with error message; unlimited input accepted |
| `client/src/components/admin/BrandGuidelinesSection.tsx` | — | No live character count | Warning | Plan truth #5 requires char counter; textarea has no counter display |
| `client/src/lib/translations.ts`      | —    | Missing `'Save failed'` PT key       | Warning  | t('Save failed') used on line 40 of BrandGuidelinesSection; falls back to API on PT locale |

### Human Verification Required

#### 1. Save Button Brand Compliance

**Test:** Open /admin/presentations as admin, inspect the Save button styling.
**Expected:** Per CLAUDE.md brand guidelines — CTA buttons should use Brand Yellow `#FFFF01` with black bold text, pill-shaped (`rounded-full`). The current implementation uses default Button styling (`className="gap-2"`).
**Why human:** Visual styling decision — requires browser rendering to confirm if default admin theme button is acceptable or if Brand Yellow is required here.

#### 2. Full Save/Reload Cycle

**Test:** Navigate to /admin/presentations, type text in the textarea, click Save, reload the page.
**Expected:** Saved text reappears in the textarea after reload.
**Why human:** Requires browser session with admin authentication; cannot run without live server and auth state.

### Gaps Summary

Two gaps block full PRES-09 compliance:

**Gap 1 — GET null vs empty string (minor but spec-breaking):** The plan and PRES-09 requirement specified `{ content: null }` for an empty table. The implementation returns `{ content: "" }`. Phase 18 (AI authoring) reads this endpoint server-side — it likely needs to distinguish "no guidelines configured" from "admin saved an empty string". Fix: change `?? ""` to `?? null` in line 9 of `brandGuidelines.ts`.

**Gap 2 — Missing PUT 2000-char Zod validation (blocker):** The plan required `z.string().max(2000, "Brand guidelines cannot exceed 2,000 characters")` with `safeParse`. The implementation only checks `typeof content !== "string"`. An admin can submit arbitrarily large content. The plan's success criteria explicitly listed the 400 response with that exact error message as a gate. Fix: add the Zod schema and replace the typeof check with `safeParse`.

**Gap 3 — No live character counter in UI (warning):** Plan truth #5 states "Typing in the editor updates the live character count below the textarea." `BrandGuidelinesSection.tsx` has no `{charCount} / {MAX_CHARS}` display. The component is functional but lacks this UX feature.

**Gap 4 — Missing PT translation for 'Save failed' (warning):** The `useTranslation` hook falls back to the API for unknown keys, so this is functional but adds a translation API call on error. Fix: add `'Save failed': 'Falha ao salvar'` to the pt block in translations.ts.

---

_Verified: 2026-04-21T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
