---
id: SEED-003
status: dormant
planted: 2026-05-17
planted_during: Debug sweep (post-v1.9)
trigger_when: When admin dashboard or homepage TTI feels slow on real-world connections, OR when a perf milestone is being scoped
scope: Small
---

# SEED-003: Code-split admin bundle (Vite manualChunks)

## Why This Matters

Production build emits 3 chunks over Vite's 500 KB warning threshold:

| Chunk | Size (min) | Size (gzip) |
|---|---|---|
| `Admin-*.js` | 566 KB | 146 KB |
| `index-*.js` | 545 KB | 172 KB |
| `XpotApp-*.js` | 499 KB | 134 KB |

The Admin bundle ships every admin section to every admin page load — including
PresentationsSection (949 LOC), BlogSection (1330 LOC), ChatSection (1018 LOC).
Most admin sessions touch 1–2 sections. The other 10 are dead weight.

## When to Surface

**Trigger:** When real-world admin TTI feels slow, or when we set a perf budget.
Not urgent — gzip sizes are still under 200 KB each, so on broadband this is
imperceptible. The real cost is mobile / slow connections and Vite's nagging
warning hiding genuine regressions.

## Scope Estimate

**Small** — single phase, mostly config:

1. In `vite.config.ts`, add `build.rollupOptions.output.manualChunks` to split:
   - vendor chunks (react, react-dom, @radix-ui/*, @tanstack/react-query)
   - heavy admin sections lazy-loaded per route (already the case for
     `PresentationViewer` — extend the pattern to admin sub-sections)
2. Convert the largest admin sections to `lazy(() => import(...))` inside
   `Admin.tsx` so they ship only when navigated to.
3. Re-run `npm run build`, verify all chunks under 500 KB.
4. Manual smoke: every admin tab loads, no flash of empty content beyond a brief
   skeleton.

## Breadcrumbs

- `client/src/App.tsx:75` — `PresentationViewer = lazy(...)` shows the existing
  lazy-load pattern. Replicate inside `Admin.tsx` for sections.
- Vite docs on `manualChunks`:
  https://rollupjs.org/configuration-options/#output-manualchunks
- After SEED-002 (admin file split) lands, this becomes much easier — small
  cohesive files split cleanly. **Order: do SEED-002 first if both are scheduled.**

## Notes

- Don't manually-split vendor chunks too aggressively — over-splitting hurts HTTP/2
  perf. Aim for ~5 chunks total (vendor-react, vendor-ui, app-admin, app-public,
  shared).
- Watch for chunk-name churn breaking cache headers — Vite uses content hashes so
  that's fine, but verify after deploy.
