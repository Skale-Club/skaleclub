# Public section template system v1

Created 2026-10-11. This is the execution source of truth for maturing the
public-site section/template architecture and its vertical rhythm. Work is
performed locally, reviewed at explicit checkpoints, and is not deployed until
Vanildo approves the complete package.

## Status

| Phase | Deliverable | Status | Approval gate |
|---|---|---|---|
| 0 | Baseline inventory and screenshots | complete locally | classification review |
| 1 | Spacing hierarchy and section contracts | complete locally | token/role review |
| 2 | Shared registry and save-time validation | complete locally | architecture review |
| 3 | Non-hero frame migration | complete locally | responsive visual review |
| 4 | Pill, compact, bridge, and CTA migration | complete locally | responsive visual review |
| 5 | Hero family and trust-badge composition | complete and responsively verified locally | hero review |
| 6 | Reviews template hardening | complete locally | reviews review |
| 7 | Guided editor and migration framework | implemented; authenticated admin UAT open | admin workflow review |
| 8 | Automated verification and responsive landing preview complete; human UAT open | local checks complete | production approval |

The phases were executed as one local package after Vanildo's approval to
proceed on 2026-10-11. No production push, production seed, or deployment is
allowed without a separate explicit production approval.

## Locked decisions

1. Harmony does not mean one padding value for every block.
2. Public content is classified by role and density before it receives spacing.
3. Standard editorial sections share one responsive rhythm.
4. Compact/pill sections, CTA bands, and bridge elements use smaller related
   rhythms from the same scale.
5. Heroes use a separate template family because they must account for the
   fixed header, viewport, imagery, trust badges, and handoff to the next band.
6. Trust badges have two valid compositions: hero bridge/overlap and standalone
   compact band. They are not treated as a full editorial section.
7. Current public section spacing is generally too large. The new candidate
   scale begins smaller and is calibrated visually before broad migration.
8. Outer section spacing, inner content gaps, card padding, and pill padding are
   different token domains and must never be used interchangeably.
9. Existing content, order, links, analytics, translations, and behavior are
   preserved during spacing/template migration unless separately approved.
10. The section registry becomes the single source of truth for rendering,
    server validation, admin editing, previews, migrations, and tests.
11. Permanent maintenance guidance lives in
    `docs/PUBLIC_SECTION_TEMPLATE_SYSTEM.md`; implementation changes that alter
    the contract must update that document in the same commit.

## Permanent documentation deliverable

The execution plan is a migration tracker, not the long-term maintenance
manual. The permanent contract is `docs/PUBLIC_SECTION_TEMPLATE_SYSTEM.md`.
Every phase must keep it current with approved roles, token values, canonical
edit paths, examples, exceptions, and the future-edit workflow. Phase 8 must
verify that every canonical path documented there exists and that a maintainer
can change a role token without editing individual section components.

## Scope

Included:

- Homepage and all homepage content bands.
- Managed landing pages, including barbershops and NFC/product landings.
- Portfolio, apps, services, product guides, and public campaign pages.
- Blog list/post, FAQ, contact, privacy, and terms pages.
- Shared public components used by those pages.

Separate layout systems, inventoried but not forced into marketing-section
rhythm:

- Admin application.
- Estimate/presentation viewers.
- vCard and link-in-bio experiences.
- Full-screen tools and authenticated application shells.

## Hierarchy: page to pill

The implementation must keep these layers distinct:

1. **Page shell** — header/footer, global background, route-level layout.
2. **Hero frame** — top-of-page composition with its own geometry.
3. **Section frame** — full-bleed background, outer vertical rhythm, container,
   borders, anchor offset.
4. **Content group** — heading-to-body gap and grid/list spacing.
5. **Component** — card, carousel, embed, media, form, or map.
6. **Micro component** — pill, chip, badge, button, icon label.

Only layer 3 owns ordinary section top/bottom padding. A card or pill cannot
change the section's outer rhythm, and a section cannot reuse card padding as
its vertical rhythm.

## Section roles and candidate spacing

All values are provisional until Phase 1 visual calibration. They deliberately
start below today's common 80px mobile / 112px desktop spacing. Every value is
on an 8px grid.

| Role | Intended use | Mobile `<770` | Tablet `770–1023` | Desktop `>=1024` |
|---|---|---:|---:|---:|
| `editorial` | Normal titled sections with cards, copy, media, map, FAQ, reviews | 48px | 64px | 80px |
| `dense` | Repeated product/app rows or information-heavy lists | 40px | 48px | 64px |
| `compact` | Trust badge band, short proof strip, small supporting block | 24px | 32px | 40px |
| `pill` | Link callout or one-line action band | 24px | 32px | 40px |
| `cta` | Conversion band with heading and one primary action | 40px | 48px | 56px |
| `bridge` | Element straddling two sections, normally trust badges | composition-owned | composition-owned | composition-owned |
| `flush` | Structural wrapper with no visual band of its own | 0 | 0 | 0 |
| `hero` | First-screen composition | variant-owned | variant-owned | variant-owned |

Default top and bottom values are symmetric for `editorial`, `dense`,
`compact`, `pill`, and `cta`. Asymmetry is allowed only inside a named hero or
bridge composition and must be encoded by that template, never by an ad-hoc
class on a page.

### Initial classification

This table is a hypothesis to validate in Phase 0, not permission to migrate
blindly.

| Existing section/family | Proposed role | Notes |
|---|---|---|
| Services, Our Services, About, Areas Served | `editorial` | Normal content bands |
| Reviews | `editorial` | Embed may remain full-bleed inside the frame |
| Blog homepage section | `editorial` | Heading and card grid |
| Feature Grid, Content Blocks, FAQ | `editorial` | Shared heading/content rhythm |
| Process Stepper, Pricing Table, Pricing Plans | `editorial` | Internal grids retain their own gaps |
| Portfolio services/products/pillars | `editorial` | Section-level grouping |
| Individual portfolio app rows | `dense` | Repeated rows should not feel like separate full chapters |
| Trust Badges standalone | `compact` | Small proof band |
| Trust Badges attached to hero | `bridge` | Hero owns overlap and next-section handoff |
| Link Callout | `pill` | Short one-line/two-line action |
| Lead Form CTA, Portfolio CTA | `cta` | Smaller than editorial, larger than pill |
| Home hero, landing hero, PageHeader, portfolio hero | `hero` | Separate family |
| Wrappers used only for background continuity | `flush` | No padding of their own |

## Target section definition

Each registered template must eventually expose one definition consumed by the
renderer, server, editor, previews, migrations, and tests:

```ts
defineSection({
  type: "reviews",
  family: "section",
  role: "editorial",
  version: 1,
  schema: reviewsPropsSchema,
  defaults: reviewsDefaults,
  component: ReviewsSection,
  editor: ReviewsEditor,
  contentSource: "local-with-global-fallback",
  migrate: migrateReviews,
});
```

Hero definitions use `family: "hero"` and a named variant instead of a normal
section role.

## Phase 0 — Baseline and classification

### Tasks

- Inventory every public route and every visible band in rendered order.
- Record component, registry type, current top/bottom padding, container, tone,
  content source, and pages that consume it.
- Mark each block as hero, editorial, dense, compact, pill, CTA, bridge, or
  flush.
- Capture baseline screenshots at 390x844, 834x1194, 1024x768, and 1440x900.
- Note intentional relationships such as hero/trust-badge overlap and
  full-bleed carousels.
- Identify all section-level `py-*`, `pt-*`, `pb-*`, negative margins, and
  padding overrides.

### Acceptance

- Every public band appears exactly once in the inventory.
- Every band has a proposed role and written rationale.
- Ambiguous classifications are listed for approval before code changes.
- Baseline screenshots and routes are linked from this plan.

## Phase 1 — Tokens and contracts

### Tasks

- Add named CSS variables for the candidate responsive role scale.
- Introduce a `SectionFrame` contract that owns tone, role, container, border,
  anchor offset, and outer vertical padding.
- Keep content-group gaps separate from frame padding.
- Introduce typed primitives for section heading gap, grid gap, card padding,
  pill padding, and CTA spacing.
- Create a development-only warning when a non-hero frame receives direct
  outer `py/pt/pb` overrides.
- Build a visual specimen page showing every role with identical placeholder
  content at all four target viewports.
- Update `docs/PUBLIC_SECTION_TEMPLATE_SYSTEM.md` with the approved token values,
  real canonical source paths, and specimen route.

### Acceptance

- Changing one role token updates every specimen using that role.
- `editorial`, `dense`, `compact`, `pill`, and `cta` are visually related but
  clearly different in hierarchy.
- Candidate values are reviewed before existing sections are migrated.

## Phase 2 — Shared registry and validation

### Tasks

- Replace the loose component/schema map with typed section definitions.
- Move section metadata usable by the server into a shared module without
  importing React server-side.
- Derive admin available types from the registry; remove the manual list.
- Validate type, version, and props in the admin before save and again in the
  server route.
- Return validation errors with section index, type, field path, and message.
- Preserve readable errors in preview; public production must not silently lose
  content without telemetry.
- Add versioned prop migration support.
- Declare content ownership as local, global, or explicit fallback.

### Acceptance

- Registered types and editor types cannot diverge.
- Invalid props receive HTTP 400 and cannot be persisted.
- Existing stored pages pass validation or have an explicit migration.
- Renderer no longer relies on `ComponentType<{ props: any }>`.

## Phase 3 — Editorial and dense migration

### Tasks

- Migrate normal homepage sections first as the reference implementation.
- Migrate managed landing editorial sections.
- Migrate portfolio group sections and dense app/product rows.
- Migrate blog, FAQ, contact, product guides, and legal content frames.
- Remove obsolete `.section-y` and duplicated hard-coded section padding only
  after all consumers have moved.
- Preserve internal grid/card/media spacing unless the inventory identifies a
  separate defect.

### Acceptance

- Every migrated outer frame receives spacing only from its role.
- Computed top and bottom padding match the approved responsive tokens.
- Content, order, links, translations, analytics, and interactions are intact.
- Before/after screenshots are attached for each route group.

## Phase 4 — Compact, pill, bridge, and CTA migration

### Tasks

- Implement standalone trust badges as `compact`.
- Implement hero-attached trust badges as `bridge` owned by the hero
  composition.
- Migrate Link Callout and equivalent strips to `pill`.
- Migrate conversion bands to `cta`.
- Audit micro-component padding separately so button/chip/badge sizing does not
  get mistaken for section spacing.

### Acceptance

- Smaller bands retain their intended compactness.
- Trust badges preserve their overlap/bridge behavior where currently used.
- No compact element is inflated to editorial-section height.
- All smaller roles still use the same 8px rhythm and responsive progression.

## Phase 5 — Hero family

### Tasks

- Define variants for homepage, split landing, dark product, editorial header,
  portfolio, and campaign/form heroes.
- Give each variant explicit rules for navbar clearance, viewport/min-height,
  image aspect/position, content alignment, bottom handoff, and trust placement.
- Remove one-off hero padding only after each existing hero maps to a variant.
- Test short and tall viewports, long PT copy, missing images, and absent trust
  badges.

### Acceptance

- Every hero maps to a named variant.
- No hero uses ordinary section-role padding.
- Header never overlaps meaningful hero content.
- Trust badges work as inline, bridge, or absent without leaving dead space.

## Phase 6 — Reviews hardening

### Tasks

- Replace raw script/HTML as the preferred configuration with typed Xphere
  token and widget options.
- Keep a controlled migration path for the existing embed.
- Make local versus inherited review configuration explicit.
- Preserve full-bleed widget behavior inside an editorial frame.
- Restrict arbitrary script execution from CMS content.

### Acceptance

- Current live reviews, owner responses, carousel controls, and theme remain
  functional.
- The reviews section uses approved editorial frame spacing.
- Landing-specific review configuration cannot unexpectedly modify homepage or
  unrelated landings.

## Phase 7 — Visual editor and content migrations

### Tasks

- Generate the section picker from registry metadata.
- Add per-template forms, field descriptions, asset guidance, inheritance
  indicators, responsive preview, reorder, duplicate, and delete controls.
- Keep raw JSON only as an advanced mode.
- Run versioned migrations over existing page JSON locally/staging first.
- Produce a migration report before any production data write.

### Acceptance

- Every registered template can be created and edited without raw JSON.
- Editor preview uses the same renderer and tokens as the public page.
- Migration is idempotent and reports changed/unchanged/failed pages.

## Phase 8 — Verification and release package

### Automated verification

- Unit tests for every section schema, defaults, role, and migration.
- Registry test proving editor/server/renderer type parity.
- Render smoke test for every template with defaults and representative props.
- Responsive screenshot tests at the four target viewports.
- Assertion that non-hero outer frames do not carry direct padding overrides.
- Accessibility checks for heading order, landmarks, anchors, keyboard controls,
  and reduced motion.
- Documentation check proving every canonical source path in
  `docs/PUBLIC_SECTION_TEMPLATE_SYSTEM.md` exists.
- Maintainability check proving a responsive role can be adjusted from one
  token source without editing individual page or section components.
- `npm run check` and `npm run build` pass.

### Human UAT

- Review route groups one at a time: homepage, barbershops, NFC/products,
  portfolio, content pages.
- Compare hierarchy, not merely pixel equality.
- Confirm compact/pill/bridge sections still feel intentionally smaller.
- Confirm standard sections feel tighter than today without becoming cramped.
- Record requested changes in this plan and rerun the affected phase's checks.

### Release gate

- Present final diff, screenshots, migration report, test/build results, and
  rollback instructions.
- Ask for explicit production approval.
- Only after approval: commit/push/deploy and verify health, version, and the
  representative public routes.

## Recursive tracking protocol

For every execution pass:

1. Read this plan and the latest decision log before editing.
2. Select only the next pending task whose dependencies are complete.
3. Record files to touch and the expected visible outcome.
4. Implement locally.
5. Run the task's automated checks.
6. Capture the required responsive evidence.
7. Update task status and findings here.
8. If evidence contradicts a token or classification, revise the plan first,
   document why, and repeat the affected task rather than layering an override.
9. Stop at approval gates; do not infer approval from silence or from approval
   of a different section.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-11 | Replace one-size spacing with role hierarchy | Pills, trust badges, CTA, and bridge elements must retain their hierarchy |
| 2026-10-11 | Start with smaller candidate spacing | Current 80px/112px common rhythm feels too large |
| 2026-10-11 | Treat hero as a separate template family | Header, viewport, imagery, and trust composition require different geometry |
| 2026-10-11 | Require explicit production approval | Changes are accumulated into one reviewed package |
| 2026-10-11 | Use representative real routes as the visual specimen | They exercise the real content hierarchy and avoid maintaining a throwaway specimen page |
| 2026-10-11 | Preserve missing section versions as v1 compatibility | All 17 stored pages predate explicit versions and must remain readable while new saves become versioned |
| 2026-10-11 | Parse legacy review embeds instead of mounting stored HTML | Preserve the current widget while preventing arbitrary CMS script execution |
| 2026-10-11 | Replace the barbershop price paragraphs with the existing `ourServices` catalog carousel | Preserve the site's established service-card system; select Xkedule first, then Xsites, Paid Advertising, and Xareable; there are no real cases yet for a portfolio |
| 2026-10-11 | Make shared role metadata drive `SectionFrame` through the renderer registry | The registry must control actual spacing behavior, not merely describe it |
| 2026-10-11 | Run section migrations at the shared schema boundary | API, editor, renderer, and maintenance scripts must normalize persisted content consistently |

## Evidence log

| Phase | Evidence | Result | Follow-up |
|---|---|---|---|
| 0–5 | `docs/PUBLIC_SECTION_INVENTORY.md` plus screenshots in `.planning/evidence/section-system/` | Barbershop reviewed at mobile, tablet, small desktop, and desktop; homepage, portfolio, FAQ, and NFC product sampled on mobile | Human review of the package remains the release gate |
| 1 | `shared/section-system-maintainability.test.ts` | Canonical paths exist; ordinary role values live in one token file; hero/bridge remain composition-owned | Update this test when canonical paths change |
| 2/7 | Read-only validation against current page rows | 17/17 stored pages satisfy the shared managed-section schema; no production data was changed | Add explicit versions on a future approved data migration, if desired |
| 2/7 | `shared/section-definitions.test.ts` | Registry/schema/metadata parity, valid starters, field paths, version rejection, compatibility, and idempotent migration covered | Authenticated admin visual workflow still needs human UAT |
| 6 | Local `/br/barbershops#reviews` using the stored legacy snippet | Xphere reviews, owner responses, cards, stars, and carousel controls render through the safe parser | Confirm again after production approval/deployment |
| 6 | `shared/reviews-embed.test.ts` | Xphere conversion and provider allowlisting covered; arbitrary script hosts rejected | Extend for any future review provider |
| Barbershop services | `.planning/evidence/barbershop-services/` at 390, 834, 1024, and 1440px | Existing catalog carousel reused with Xkedule, Xsites, Paid Advertising, and Xareable in that order | Review the complete landing after the approved data update |
| 8 | `npm test`, `npm run check`, `npm run build`, and direct-padding audit | Passing locally; direct outer padding found only in named hero compositions | Record the final command output in release notes |
| Barbershop final package | `.planning/evidence/barbershop-final/` at 390, 834, and 1440px, using request interception for the pending seed only | No horizontal overflow; square mobile hero; approved barbershop imagery; catalog photos; About photo; NFC content all render without writing the database | Human visual acceptance and explicit production approval remain open |
| 2/7 final integrity | Read-only validation after schema-bound migration wiring | 17 pages / 99 sections valid; zero failures; existing rows unchanged | Production data write remains prohibited until approval |
