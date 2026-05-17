# Phase 41: Split admin sections over 600 LOC into sub-components (SEED-002) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped (pure mechanical refactor)

<domain>
## Phase Boundary

Reduce every `.tsx` file under `client/src/components/admin/` to ≤ 600 lines by
extracting cohesive UI chunks (dialogs, tab panes, list rows, form fragments) into
their own component files inside a per-area subfolder. This is a structural
refactor only — no behavior change, no feature change, no styling change.

In scope:
- The 9 admin section files currently > 600 LOC (BlogSection, ChatSection,
  PresentationsSection, EstimatesSection, PortfolioSection, forms/FormsSection,
  SkaleHubSection, integrations/AIAssistantCard, LeadsSection).

Out of scope:
- Any new admin feature, props change, or visual redesign.
- Renaming exported Section components or moving them out of their current path
  (the Admin.tsx imports must keep working unchanged).
- Adjusting business logic, React Query keys, or data-testid attributes.

</domain>

<decisions>
## Implementation Decisions

### Folder structure
- Mirror the existing per-area subfolder pattern (`admin/forms/`,
  `admin/integrations/`). New folders: `admin/blog/`, `admin/chat/`,
  `admin/presentations/`, `admin/estimates/`, `admin/portfolio/`, `admin/hub/`,
  `admin/leads/`.
- Top-level Section file (e.g. `admin/blog/BlogSection.tsx`) re-exports as the
  composition root. All sub-components live alongside it.

### Order (lowest risk first)
1. LeadsSection (618)
2. AIAssistantCard (643) — already inside `integrations/`
3. SkaleHubSection (655)
4. forms/FormsSection (677) — already inside `forms/`
5. PortfolioSection (752)
6. EstimatesSection (896)
7. PresentationsSection (949) — chat editor is delicate
8. ChatSection (1018) — streaming + scroll state
9. BlogSection (1330) — largest, multiple tabs/modals

### Verification between files
- After each file: `npm run check` must pass.
- After every 3 files: `npm run build` smoke check.
- After all files: full `npm run build` and `wc -l` confirmation that no file
  under `admin/` exceeds 600 lines.

### What to extract
- Dialog/Modal contents → `<FilenameDialog>.tsx`
- Tab pane bodies → `<FilenameTabPanel>.tsx`
- Table/list row components → `<FilenameRow>.tsx`
- Form fragments (inputs grouped by section) → `<FilenameFormFields>.tsx`
- Custom hooks defined inline → `use<Filename>.ts` (e.g. data-fetching hooks)

### Claude's Discretion
- Naming of extracted sub-components is at Claude's discretion within the
  patterns above.
- Whether to extract a chunk depends on cohesion — a 50-line block tightly
  coupled to surrounding state is better left in place than artificially
  separated. Aim for ≤ 600 lines first; only further extract if a logical
  cleavage exists.
- If a file approaches but does not exceed the limit (e.g. 605 LOC), do not
  contort the structure to shave a few lines — leave it close to the limit if
  splitting would create a forced abstraction.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/admin/AdminCard.tsx`, `SectionHeader.tsx`,
  `EmptyState.tsx`, `FormGrid.tsx` — design-system primitives already used by all
  admin sections. Sub-components should keep using these (no new shells).
- Existing per-area folders (`admin/forms/`, `admin/integrations/`) provide the
  pattern to mirror — top-level Section file imports from sibling files.

### Established Patterns
- React Query is the data layer; keys are derived from a stable string convention
  per section. Do NOT change query keys during the split (would invalidate cache).
- `data-testid` attributes on key elements support E2E tests. Preserve verbatim.
- Sub-components receive props (not React Query directly) where reasonable —
  except top-level dialog/tab components that own their own data fetching.

### Integration Points
- `client/src/pages/Admin.tsx` imports each Section by name. Imports MUST stay
  valid — keep the same default-or-named export for each Section.
- `client/src/components/admin/AdminSidebar.tsx` references sections by their
  display name strings — not affected by file splits.

</code_context>

<specifics>
## Specific Ideas

- For BlogSection (1330 LOC): likely splits include `BlogPostsList`,
  `BlogPostEditorDialog`, `BlogGenerationJobsPanel`, `BlogRssSourcesPanel`,
  `BlogAutomationSettings`. The page already has tabs — each tab body is a
  natural extraction target.
- For ChatSection (1018 LOC): isolate `ConversationsList`,
  `ConversationDetailPanel`, `ChatSettingsForm`. The streaming message buffer
  and scroll-lock logic should travel with the message list panel.
- For PresentationsSection (949 LOC): split `PresentationsList`,
  `BrandGuidelinesEditor`, `PresentationChatEditor` (SSE stream + slide JSON
  editor). The SSE pump must stay co-located with its consumer to avoid prop
  drilling the EventSource.

</specifics>

<deferred>
## Deferred Ideas

- Bundle code-splitting and `lazy()` wrappers on these sections — see Phase 42
  (SEED-003). Order matters: this refactor (Phase 41) lands first; Phase 42
  uses the resulting small files for clean dynamic imports.

</deferred>
