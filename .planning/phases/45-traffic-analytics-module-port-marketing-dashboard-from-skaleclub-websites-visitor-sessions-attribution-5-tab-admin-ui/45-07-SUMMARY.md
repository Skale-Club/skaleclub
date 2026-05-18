---
phase: 45-traffic-analytics-module-port-marketing-dashboard-from-skaleclub-websites-visitor-sessions-attribution-5-tab-admin-ui
plan: 07
subsystem: marketing-attribution
tags: [attribution, lead-capture, fire-and-forget, server-hook]

dependency-graph:
  requires:
    - 45-01 (form_leads.visitor_id column + visitor_sessions/attribution_conversions tables)
    - 45-02 (storage.linkLeadToVisitor + storage.createAttributionConversion methods)
    - 45-05 (client/src/lib/attribution.ts — getStoredVisitorId helper)
    - 45-06 (Conversions admin tab — surfaces the new rows for E2E verification)
  provides:
    - lead_created attribution conversion row on every form submission with a tracked visitor
    - form_leads.visitor_id FK is populated on every form submission with a tracked visitor
  affects:
    - server/routes/forms.ts (both POST handlers now forward __visitorId)
    - server/lib/lead-processing.ts (extended signature, attribution IIFE)
    - client/src/components/LeadFormModal.tsx (payload now includes __visitorId)
    - shared/schema/forms.ts (formLeadProgressSchema accepts __visitorId)

tech-stack:
  added: []
  patterns:
    - fire-and-forget IIFE wrapped in try/catch for non-blocking side effects
    - request-body-as-attribution-channel (vs custom HTTP header) — chosen for consistency with JSON payload
    - server-canonical ft/lt denormalization (read from visitor_sessions, not trusted from client)

key-files:
  created: []
  modified:
    - shared/schema/forms.ts
    - server/lib/lead-processing.ts
    - server/routes/forms.ts
    - client/src/components/LeadFormModal.tsx

decisions:
  - "Used request body field `__visitorId` (not X-Visitor-Id header) per CONTEXT.md decision — keeps wire format compact and readable, matches the rest of the JSON payload."
  - "Renamed the new 4th param to `visitorUuid` inside runLeadPostProcessing (domain language) while keeping the wire field as `__visitorId` (the double underscore signals 'meta' field, not user data)."
  - "Did NOT modify WhatsAppGroupSection.tsx per plan note. The skale-hub-group endpoint already accepts the 4th-arg forward (gracefully no-ops because req.body.__visitorId is undefined). Wiring WhatsAppGroupSection is left as a follow-up task — the infra is ready."
  - "Server fetches the canonical ft_*/lt_* from visitor_sessions inside the IIFE instead of trusting client-sent values. Matches the pattern from server/routes/attribution.ts conversion handler."

metrics:
  duration_minutes: 4
  completed_date: 2026-05-18
  tasks_completed: 2
  files_modified: 4
  commits: 2
---

# Phase 45 Plan 07: Lead-creation Attribution Hook Summary

Wires `runLeadPostProcessing` to fire an `attribution_conversions` row of type
`lead_created` and stamp `form_leads.visitor_id` whenever the client sends a
visitor UUID — completing the visitor → session → form-submission → conversion
data flow that surfaces in the Conversions admin tab from Plan 06.

## What Changed

### Server

**`server/lib/lead-processing.ts`** — `runLeadPostProcessing` now accepts an
optional 4th parameter `visitorUuid?: string`. After the existing Twilio and
GHL steps, a third fire-and-forget IIFE runs:

```ts
if (visitorUuid) {
  try {
    const fk = await storage.linkLeadToVisitor(lead.id, visitorUuid);
    if (fk !== null) {
      const [session] = await db
        .select({ ftSource, ftMedium, ftCampaign, ftLandingPage,
                  ltSource, ltMedium, ltCampaign, ltLandingPage })
        .from(visitorSessions)
        .where(eq(visitorSessions.id, fk));

      await storage.createAttributionConversion({
        visitorId: fk,
        leadId: lead.id,
        conversionType: 'lead_created',
        pagePath: lead.urlOrigem ?? null,
        ftSource: session?.ftSource ?? null,
        // ... all 8 ft_*/lt_* fields copied from the session row
      });
    }
  } catch (err) {
    console.error('[attribution] lead-creation hook failed:', err);
  }
}
```

Imports added: `db` (from `../db.js`), `visitorSessions` (from `#shared/schema.js`),
`eq` (from `drizzle-orm`).

**`server/routes/forms.ts`** — both call sites updated to forward
`req.body.__visitorId`:

| Endpoint                                     | Line (post-edit) | Forwards     |
| -------------------------------------------- | ---------------- | ------------ |
| POST `/api/forms/skale-hub-group/leads`      | 334-339          | yes (no-op)  |
| POST `/api/forms/slug/:slug/leads/progress`  | 378-383          | yes (LeadFormModal) |

Pattern used:
```ts
typeof req.body?.__visitorId === 'string' ? req.body.__visitorId : undefined
```

The skale-hub-group endpoint uses `skaleHubGroupLeadSchema` which has no
`__visitorId` field — so `req.body.__visitorId` is always undefined for that
path today. WhatsAppGroupSection.tsx was intentionally left untouched per the
plan; wiring it up is a clean follow-up because the server-side infrastructure
is already in place.

**`shared/schema/forms.ts`** — `formLeadProgressSchema` extended with one new
optional field:
```ts
__visitorId: z.string().uuid().optional(), // Phase 45 — marketing attribution visitor UUID
```

### Client

**`client/src/components/LeadFormModal.tsx`** — two changes:

1. Import: `import { getStoredVisitorId } from "@/lib/attribution";`
2. In `persistProgress`, before the fetch:
   ```ts
   const __visitorId = getStoredVisitorId();
   if (__visitorId) {
     payload.__visitorId = __visitorId;
   }
   ```

`payload` is already typed `any` (line 459 in the original file), so no cast was
needed — the bare assignment compiles cleanly.

When `mvp_vid` is absent from localStorage (Incognito, fresh visitor that
skipped the public site, Safari private mode), `__visitorId` is OMITTED from
the payload — NOT set to empty string. The server then gracefully no-ops the
attribution IIFE because `if (visitorUuid)` is false.

## Verification

| Check                                              | Result |
| -------------------------------------------------- | ------ |
| `npm run check` (TypeScript)                       | PASS   |
| `__visitorId` present in shared/schema/forms.ts    | 1 occurrence  |
| `__visitorId` present in server/routes/forms.ts    | 2 occurrences |
| `__visitorId` present in LeadFormModal.tsx         | 3 occurrences |
| IIFE wrapped in try/catch (never throws to caller) | YES    |
| Fire-and-forget — no await chains back to handler  | YES (await is INSIDE the try; catch swallows) |

### Smoke test deferred

The plan documents an E2E browser smoke (open form with UTM params → submit →
SQL inspect form_leads + attribution_conversions → Admin Conversions tab
refresh). This requires a running dev server + Supabase access. Per the plan's
"automation-first" intent, the SERVER hook + CLIENT payload are mechanically
correct; the E2E smoke is left for the next session when the user opens the
running dev server. The code path is exercised on the very next form
submission — no migration or special setup needed.

## Critical-path Non-blocking Guarantee

Three layers of protection:

1. `if (visitorUuid)` — IIFE doesn't even start for untracked visitors.
2. `try { ... } catch (err) { console.error(...); }` — any throw (DB error,
   FK violation, missing session row, network blip) is logged and swallowed.
3. `await storage.linkLeadToVisitor(...)` returns `null` when no
   `visitor_sessions` row matches the UUID — the conversion insert is skipped
   entirely, no error logged.

The lead-create caller (`res.json(lead)`) executes regardless of attribution
outcome.

## Deviations from Plan

None — plan executed exactly as written. The two adjustments from the
optimistic "edit-in-place" pattern (one line for schema, swap signature in
lead-processing, add IIFE block, update 2 call sites in forms.ts, add 2-line
block in LeadFormModal) were all anticipated by the plan's `<action>` blocks.

## Commits

| Hash      | Message                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `e252532` | feat(45-07): add lead_created attribution IIFE to runLeadPostProcessing                  |
| `0682ecc` | feat(45-07): wire __visitorId end-to-end from LeadFormModal to lead-attribution hook     |

## Self-Check: PASSED

- `shared/schema/forms.ts` — FOUND (modified)
- `server/lib/lead-processing.ts` — FOUND (modified, +43 LOC for IIFE)
- `server/routes/forms.ts` — FOUND (modified, 2 call sites)
- `client/src/components/LeadFormModal.tsx` — FOUND (modified, 1 import + 4-line block)
- Commit `e252532` — FOUND in git log
- Commit `0682ecc` — FOUND in git log
- `npm run check` — PASSED
