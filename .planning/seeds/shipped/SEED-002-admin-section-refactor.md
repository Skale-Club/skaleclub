---
id: SEED-002
status: shipped
planted: 2026-05-17
planted_during: Debug sweep (post-v1.9)
trigger_when: Next time an admin section >900 LOC needs a non-trivial feature added — or when /gsd:new-milestone scope touches admin DX / maintainability
shipped_as: Phase 41 (9 plans, v2.0)
shipped_on: 2026-05-17
scope: Medium
---

> **Shipped 2026-05-17 as Phase 41 (v2.0).** All 9 admin files split into per-area
> subfolders. Parent files reduced from 7538 LOC total → 2899 LOC. ~36 new
> cohesive sub-components across `admin/leads/`, `admin/integrations/`,
> `admin/hub/`, `admin/forms/`, `admin/portfolio/`, `admin/estimates/`,
> `admin/presentations/`, `admin/chat/`, `admin/blog/`. Behavior, props,
> React Query keys, and `data-testid` attributes preserved verbatim. See
> `.planning/phases/41-split-admin-sections-over-600-loc-into-sub-components-seed-002/41-VERIFICATION.md`.

# SEED-002: Split admin sections >600 LOC into sub-components

## Why This Matters

CLAUDE.md sets a hard **600-line cap per file** for admin code. 9 files are over,
several by 1.5–2.2×. Every new feature added to these files makes the next change
harder, slower, and riskier — Cursor / Claude responses on these files burn massive
context, and reviewing diffs in 1300-line files masks bugs.

Current violations (from 2026-05-17 sweep):

| File | LOC | Excess |
|---|---|---|
| `client/src/components/admin/BlogSection.tsx` | 1330 | 2.2× |
| `client/src/components/admin/ChatSection.tsx` | 1018 | 1.7× |
| `client/src/components/admin/PresentationsSection.tsx` | 949 | 1.6× |
| `client/src/components/admin/EstimatesSection.tsx` | 896 | 1.5× |
| `client/src/components/admin/PortfolioSection.tsx` | 752 | 1.25× |
| `client/src/components/admin/forms/FormsSection.tsx` | 677 | 1.13× |
| `client/src/components/admin/SkaleHubSection.tsx` | 655 | 1.09× |
| `client/src/components/admin/integrations/AIAssistantCard.tsx` | 643 | 1.07× |
| `client/src/components/admin/LeadsSection.tsx` | 618 | 1.03× |

## When to Surface

**Trigger:** Don't proactively schedule. Surface when:
- The next feature touches one of the violators and the change would push it further
  past the cap.
- `/gsd:new-milestone` scope mentions admin UX, performance, or DX.
- A new contributor onboards and complains about file size (real signal).

## Scope Estimate

**Medium** — single phase, can be done section-by-section incrementally:

1. Start with the worst (`BlogSection`) — extract sub-tabs/modals/forms into
   `client/src/components/admin/blog/*` files.
2. Repeat for `ChatSection`, `PresentationsSection`, etc., in size order.
3. Each split is mechanical: identify cohesive UI chunks (modal, tab pane, form),
   move into its own component file, import back. Behavior must not change — same
   props, same React Query keys, same `data-testid` attrs.
4. After each split: `npm run check`, manual smoke of the admin section, commit.

Order this work by file size and by how often each section is being actively edited
(blog and chat are hot right now).

## Breadcrumbs

- Admin design system primitives already exist:
  `client/src/components/admin/SectionHeader`, `AdminCard`, `EmptyState`, `FormGrid`.
  Use these in the split sub-components for consistency.
- Pattern proven by `client/src/pages/Admin.tsx` itself — it was the entry point
  refactor that introduced `SectionHeader` and shrunk Admin.tsx to 260 LOC.
- `forms/FormsSection.tsx` lives in a subfolder — that pattern (folder per admin
  area) scales well and should be the target structure for blog/chat/presentations
  too: `admin/blog/BlogSection.tsx` + `admin/blog/BlogJobsPanel.tsx` + etc.

## Notes

- Don't do this for its own sake. Only justify when a real feature change makes it
  worthwhile — otherwise it's pure churn risk.
- Splitting `PresentationsSection` will be hardest because of the streaming chat
  editor — message buffer + scroll lock + SSE pump are tightly coupled. Plan that
  one carefully or leave it last.
