# Quick Task 260906-edl — Summary

**Description:** Barbershop PT copy + Xphere booking integration scope
**Date:** 2026-09-06
**Branch:** dev
**Status:** Complete (both tasks)

## Task 1 — Hand-written pt-BR copy for the barbershop landing

**Files:** `scripts/seed-barbershop-translations.ts` (new)
**Commit:** `dceb450` — feat(edl-01): seed hand-written pt-BR translations for barbershop landing

Idempotent upsert of 46 hand-written pt-BR rows into the `translations` table
(`source_language: 'en'`, `target_language: 'pt'`), keyed on the
`(source_text, source_language, target_language)` unique index. Mirrors the
structure of the sibling `scripts/seed-barbershop-landing.ts` from quick task
260906-e15.

Covers every display string on the barbershop landing: the 12 form question
titles, their placeholders, all select option labels, and the `heroWebsites` +
`leadFormCta` section copy. Deliberately excluded: `barbershop-leads` (that is
the `formSlug` prop, not display text). Deliberately included as identity rows:
the numeric and currency labels (`1`, `2-3`, `4-6`, `7+`, the phone
placeholder) — they stop `t()` re-querying the translation provider on every
render.

### Why hand-written rather than machine-translated

Production `POST /api/translate` currently returns 200 but echoes source text
back and caches nothing (the documented "AI unavailable" fallback). `t()`
consults the `translations` table before calling the provider, so these
hand-seeded rows are authoritative and keep winning after that provider fix
lands. A separate session owns that fix; nothing in this task touched
`server/routes/translate.ts` or any AI provider config.

### Verification

- `translations` pt row count went 369 → 415 — exactly 46 new rows, no collateral writes.
- Spot-checked 6 representative rows back out of the DB; all matched the intended copy.
- Live `https://skale.club/barbershops-br` now renders the hero as
  "Sua barbearia merece cadeira cheia todos os dias." with the CTA
  "Quero mais clientes" — previously English.
- Live `https://skale.club/barbershops` still renders English — no regression on
  the EN page.

## Task 2 — Xphere booking integration scoping document

**Files:** `plan/xphere-booking-integration-plan.md` (new, ~15.7 KB)

Design document only — no code, no DB writes, no changes in the Xphere or
`skaleclub-websites` repos.

Sections: Goal, Blocker, Prior Art, Current State, Proposed Flow, Why Redirect
Rather Than Embed, Configuration Needed, Open Questions, Out of Scope.

### The two findings that shaped it

**1. Stage 1 is blocked.** Xphere's `src/lib/leads/ingestion-schema.ts:11`
declares `product: z.literal('skaleclub_websites')` inside a `.strict()` object.
`skaleclub_websites` is a *different project* (`C:\Users\Vanildo\Dev\skaleclub-websites`,
remote `github.com/Skale-Club/websites`) — not this repo. So this repo posting to
`POST /api/v1/leads` today gets a 422. The doc gives three resolution options and
recommends widening the literal to a `z.enum` on the Xphere side; it explicitly
marks "just send `skaleclub_websites` from here" as the wrong choice, because it
merges two products' lead attribution inside Xphere.

**2. Stage 1 is a port, not a greenfield design.** `skaleclub-websites` already
has a complete production Xphere integration — `shared/xphere-contract.ts` (33
lines), `server/integrations/xphere.ts` (318 lines), `scripts/verify-xphere-contract.ts`,
and `docs/integrations/xphere-lead-integration-plan.md` (661 lines) — including a
durable delivery queue with retry and reconciliation. The doc directs this repo to
mirror that shape and states plainly that a naive fire-and-forget POST would be a
regression against it.

Stage 2 (booking) is **not** blocked: redirect to Xphere's existing public booking
page `/book/[slug]/[eventType]`, choosing the event type from the form's
`tipoVisita` answer (`presencial` → an `in_person` event type, `online` → a
`video` one). One known gap: that page reads only `searchParams.debug`, so there
is no name/email/phone prefill — a small change in the Xphere repo, specified but
not performed here.

### Open questions left for the user

Which product value Xphere should accept for this site; whether the two Skale Club
properties should be one lead source or two; which Xphere org/calendar profile to
use; whether in-person visits need an address field; whether booking is mandatory
or skippable after submit; and whether the contract module should be extracted for
both repos to share or deliberately duplicated.

## Notes

- GHL is excluded throughout on the user's explicit instruction ("não estamos mais
  trabalhando com eles"). The doc contains zero GHL references; the dead
  `getGHLFreeSlots` / `createGHLAppointment` helpers in this repo were left
  untouched and are not proposed as a path.
- Executor was interrupted by a session usage limit after Task 1 was committed and
  Task 2's document had been written but not yet committed. Both were verified and
  finished by the orchestrator; no work was lost or redone.
