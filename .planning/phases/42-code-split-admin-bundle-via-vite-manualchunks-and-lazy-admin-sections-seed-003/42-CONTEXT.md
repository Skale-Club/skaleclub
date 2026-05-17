# Phase 42: Code-split admin bundle via Vite manualChunks and lazy admin sections (SEED-003) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped (configuration + lazy loading)

<domain>
## Phase Boundary

Eliminate Vite's "chunks larger than 500 kB" build warnings by:
1. Splitting vendor libraries into stable cacheable chunks via
   `build.rollupOptions.output.manualChunks` in `vite.config.ts`.
2. Lazy-loading each admin Section inside `client/src/pages/Admin.tsx` using
   `React.lazy(() => import(...))` with a Suspense fallback.

In scope:
- `vite.config.ts` chunking configuration.
- `client/src/pages/Admin.tsx` import strategy for admin sections.
- Suspense boundary + loading skeleton inside Admin.tsx.

Out of scope:
- Splitting non-admin pages further (Home, EstimateViewer, PresentationViewer
  already lazy where appropriate).
- Server-side bundle changes.
- Service worker / precaching changes.

</domain>

<decisions>
## Implementation Decisions

### manualChunks strategy
- `vendor-react`: react, react-dom, react/jsx-runtime, scheduler, wouter.
- `vendor-ui`: @radix-ui/*, lucide-react, cmdk, sonner, vaul, react-day-picker.
- `vendor-query`: @tanstack/react-query, @tanstack/react-query-devtools.
- `vendor-utils`: date-fns, zod, drizzle-zod, clsx, tailwind-merge.
- Everything else falls into Vite's automatic chunking per route.

### Lazy loading pattern
- Each Section component in `Admin.tsx` is wrapped: `const BlogSection =
  lazy(() => import('@/components/admin/blog/BlogSection'));`
- A single `<Suspense fallback={<SectionSkeleton />}>` wraps the active
  Section render in Admin.tsx.
- `SectionSkeleton` is a simple AdminCard + skeleton rows component (~30
  LOC) to avoid a layout shift while chunks load.

### Acceptance
- `npm run build` produces no "chunks larger than 500 kB" warnings.
- All admin sections still navigate and render correctly.
- TypeScript still passes.

### Claude's Discretion
- Final vendor-chunk groupings can be tuned if a group exceeds 500 KB or two
  groups overlap significantly. Aim for ~5 vendor chunks max — over-splitting
  hurts HTTP/2 perf.
- Skeleton design is at Claude's discretion (match existing AdminCard look).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/App.tsx:75` — existing `lazy(() => import('@/pages/PresentationViewer'))`
  pattern proves the dynamic-import path resolves cleanly under Vite.
- AdminCard primitive available for the SectionSkeleton wrapper.

### Established Patterns
- Lazy imports use the `@/` alias mapped to `client/src/` (per tsconfig.json
  paths section).
- Section component names are stable strings used by AdminSidebar and Admin.tsx
  routing — do not change them.

### Integration Points
- `vite.config.ts` — already configured for Vite 5 + React plugin. The
  `build.rollupOptions.output` key may not exist yet; add it.
- `Admin.tsx` will see the most changes — imports flip from static to lazy
  for every admin Section.

</code_context>

<specifics>
## Specific Ideas

- Depends on Phase 41 being complete — small focused files split cleaner via
  `manualChunks`. If Phase 41 was skipped, the chunk for a 1300-LOC admin
  file would dwarf surrounding logic and defeat the purpose.
- Watch for chunk-name churn breaking long-cache headers; Vite uses content
  hashes so this is fine in practice but worth verifying after the change.

</specifics>

<deferred>
## Deferred Ideas

- Preloading strategy for sibling admin sections on hover — nice-to-have but
  beyond this phase's "make warnings stop" goal.
- Server-side rendering of admin shell — out of scope; admin is SPA.

</deferred>
