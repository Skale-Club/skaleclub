# Public Section Template System

Status: implemented and responsively verified locally on 2026-10-11. Human
acceptance and production approval remain open. Execution evidence is tracked in
`.planning/plans/public-section-template-system-v1.md`.

This document is the permanent source of guidance for creating, editing, and
maintaining public-site sections. It must remain after the initial migration is
complete and must be updated whenever the section contract changes.

## Purpose

The public site must feel visually related without forcing every piece of
content into the same height. Harmony comes from a shared scale, explicit
content roles, and predictable responsive behavior. It does not come from one
padding value applied indiscriminately to heroes, editorial sections, trust
badges, pills, and CTAs.

## The hierarchy

Keep these layers separate:

1. **Page shell** — route layout, public header/footer, and page background.
2. **Hero frame** — first-screen geometry, header clearance, imagery, trust
   placement, and handoff to the next section.
3. **Section frame** — outer vertical rhythm, background, container, border,
   and anchor offset.
4. **Content group** — heading-to-content spacing and grid/list gaps.
5. **Component** — card, carousel, embed, map, media, or form.
6. **Micro component** — pill, chip, badge, icon label, or button.

Ordinary outer top/bottom padding belongs only to the section frame. Component
and micro-component padding must not be reused as section spacing.

## Section roles

| Role | Use |
|---|---|
| `editorial` | Normal titled section containing copy, media, cards, FAQ, map, or reviews |
| `dense` | Repeated product/app rows and information-heavy lists |
| `compact` | Standalone trust/proof band and small supporting blocks |
| `pill` | Short link callout or one-line/two-line action band |
| `cta` | Conversion band with heading and primary action |
| `bridge` | Element that visually straddles two bands, normally hero trust badges |
| `flush` | Structural/background wrapper with no visible rhythm of its own |
| `hero` | Separate top-of-page template family |

Every public section must declare a role. A role must describe the content's
function, not be chosen simply to obtain a desired padding value.

## Current v1 vertical rhythm

These values are the single local implementation source. They remain
provisional for production until responsive review is approved.

| Role | Mobile `<770px` | Tablet `770–1023px` | Desktop `>=1024px` |
|---|---:|---:|---:|
| `editorial` | 48px | 64px | 80px |
| `dense` | 40px | 48px | 64px |
| `compact` | 24px | 32px | 40px |
| `pill` | 24px | 32px | 40px |
| `cta` | 40px | 48px | 56px |
| `flush` | 0 | 0 | 0 |
| `bridge` | Composition-owned | Composition-owned | Composition-owned |
| `hero` | Variant-owned | Variant-owned | Variant-owned |

The scale uses 8px increments. Top and bottom are symmetric for ordinary
roles. Asymmetric outer spacing is allowed only inside a named `hero` or
`bridge` template whose composition requires it.

## Trust badges and other small bands

Trust badges are not full editorial sections.

- Attached to a hero: use `bridge`. The hero template owns the overlap, card
  position, and transition to the following section.
- Rendered independently: use `compact`.

Short link callouts use `pill`. Conversion sections use `cta`. Do not promote
these elements to `editorial` merely to reuse a wrapper.

## Hero family

Heroes do not use ordinary section-role padding. Each hero maps to a named
variant:

- homepage;
- split landing;
- industry landing;
- dark product;
- editorial page header;
- portfolio;
- campaign/form.
- blog post.

Each variant must define:

- fixed-header clearance;
- minimum/maximum height behavior;
- content alignment;
- image aspect, size, crop, and position;
- mobile/tablet/desktop behavior;
- trust placement: inline, bridge, or absent;
- bottom handoff to the next section.

### Industry landing hero

Use `heroWebsites` with `layout: "industry"` for a vertical-specific landing
such as barbershops, beauty salons, clinics, or home services. The template is
content-driven and must not inspect the image path or page slug to decide its
layout.

The industry template provides:

- vertical centering inside the usable hero area *below* the floating header;
- one-to-three `headlineLines`, each optionally using the brand accent;
- an optional, explicitly selected `accentMark` (currently `barber-pole`);
- a reusable media frame with `square`, `4:3`, `3:2`, or `16:9` proportions;
- configurable crop focal point and corner radius;
- balanced desktop columns that scale the media frame with the full copy block,
  including CTAs and their supporting note, instead of assigning an unrelated
  fixed image height;
- a static image when `mediaItems` contains one item and accessible carousel
  controls when it contains two or more;
- optional autoplay, disabled with `0` and automatically suppressed for
  reduced-motion visitors or while the carousel is being used.

The primary CTA stays visually dominant. A telephone demo is grouped with its
own explanatory note so the note does not appear to describe both actions. Its
desktop width is bounded so the note cannot force the secondary CTA onto a new
row and make the text column artificially taller than the 4:3 media frame.

To reproduce the barbershop structure for another industry, duplicate the
managed page and change only its local `heroWebsites` props, section copy,
images, and curated catalog selections. Do not fork the React component. For a
salon, for example, omit `accentMark` unless an approved salon-specific mark is
added to the shared enum, replace `eyebrow`, `headlineLines`, `subheadline`,
CTAs, and `mediaItems`, then select the relevant shared services in
`ourServices`.

`backgroundImageUrl` and `backgroundImageAlt` remain as backwards-compatible
single-image fallbacks. New industry pages should also declare `mediaItems`,
including intrinsic width and height, so adding carousel slides later is only
a data edit. Keep hero photography distinct from images repeated in sections
below it.

## Template definition contract

The non-React contract for every template lives in
`shared/section-definitions.ts`: schema, label, family, role, version, content
ownership, starter props, and migrations. The client registry binds that
contract to a React renderer. The API and admin editor import the same shared
contract, so their type lists and validation cannot diverge. The registry also
provides the declared role to `SectionFrame`; role metadata is therefore an
active visual contract, not documentation that can drift away from rendering.

```ts
sectionDefinitionMetadata.reviews = {
  label: "Reviews",
  family: "section",
  role: "editorial",
  version: 1,
  contentSource: "local-with-global-fallback",
};

sectionPropsSchemas.reviews = reviewsPropsSchema;
sectionStarterProps.reviews = { title: "", subtitle: "" };
```

Required metadata:

- stable `type`;
- `family` and `role` or hero variant;
- schema and typed defaults;
- template version;
- content ownership: local, global, or explicit fallback;
- editor metadata;
- migration function when the persisted contract changes.

`managedPageSectionSchema` runs the registered migration before validating the
current schema. Old rows without an explicit version normalize to the current
version when read or saved; unsupported future versions remain invalid. Keep
migrations deterministic and idempotent, and cover every new step with a test.

## Canonical edit points

Maintainers can change the system without hunting through individual pages.
These are the implemented single sources of truth:

| Concern | Canonical source |
|---|---|
| Responsive role values | `client/src/styles/section-tokens.css` |
| Section wrapper behavior | `client/src/components/editorial/SectionFrame.tsx` |
| Shared section contracts and metadata | `shared/section-definitions.ts` |
| React component binding | `client/src/components/pages/sectionRegistry.ts` |
| Hero variants and frame enforcement | `client/src/components/editorial/SectionFrame.tsx` |
| Guided admin editor | `client/src/components/admin/pages/SectionComposer.tsx` |
| Legacy review embed parser | `shared/reviews-embed.ts` |
| Barbershop landing content/order | `scripts/seed-barbershop-landing.ts` |
| Curated Portuguese landing copy | `scripts/data/landing-pt-copy.ts` |
| Permanent maintenance guide | This document |
| Migration/execution history | `.planning/plans/public-section-template-system-v1.md` |

The exact paths may change during implementation. If they do, update this table
in the same commit. A completed migration must not leave this table pointing to
missing files.

## How to adjust spacing later

1. Confirm the change is to a section role, not to an internal card/pill gap.
2. Edit the role token in the canonical token file, not individual sections.
3. Open the representative routes listed in `PUBLIC_SECTION_INVENTORY.md`.
4. Review at 390x844, 834x1194, 1024x768, and 1440x900.
5. Run section contract, render, and screenshot tests.
6. Verify at least one representative route for every consumer of the role.
7. Record the reason and before/after values in the change log below.
8. Request production approval when the change is part of a release package.

If only one section appears wrong, first verify that its role is correct and
that its internal content gaps are not creating the visual imbalance. Do not
add a local `py-*`, `pt-*`, or `pb-*` override as the first fix.

## How to add a section template later

1. Choose the content role based on function and hierarchy.
2. Add the typed definition, schema, defaults, and version.
3. Bind the React renderer; the schema-driven editor will expose its fields.
4. Add a migration if persisted props already exist.
5. Add it to the inventory and representative route review.
6. Add schema, render, registry-parity, and responsive tests.
7. Document any intentional exception here.

The generated admin composer reads fields from each Zod schema and the picker
reads `registeredSectionTypes`. Never create a second manual template list.
The advanced JSON editor keeps its draft synchronized when sections of the same
type are reordered or duplicated; preserve this behavior when changing editor
state management.

## Curated catalog sections

Use `ourServices` when a landing needs the same service-card carousel already
used by the main site. Do not recreate catalog cards as a one-off pricing grid.

- With no local props, it renders the complete global `Our Services` catalog.
- `items` can select and order a page-specific mix of existing product slugs
  and existing service titles. The cards and detail modal still read from the
  two canonical catalogs, so prices, images, links, and descriptions are not
  copied into the landing row.
- `eyebrow`, `title`, and `subtitle` may be local to the landing without changing
  the homepage heading.
- A catalog carousel is not a portfolio. Do not add a portfolio/case-study
  section until a real customer case, evidence, and permission to publish it
  exist.

The barbershop landing selects Xkedule, Xsites, Paid Advertising, and Xareable,
with Xkedule first. Edit only the selection/order and landing heading in
`scripts/seed-barbershop-landing.ts`. Product/service content remains editable
through the existing catalog administration. Running a seed is a separate data
change and still requires production approval.

## Review embed safety

New review sections use a structured Xphere configuration (`token`, layout,
theme, rating, sorting, limit, hero/card options). Existing `embedUrl` values
remain compatible through `shared/reviews-embed.ts`, which extracts only
allowlisted Xphere or ReputationHub data. Stored HTML and arbitrary script URLs
are never mounted or executed. Add a parser test whenever a legacy provider
shape changes.

## Allowed exceptions

An exception is allowed only when all of the following are true:

- a named role or hero variant cannot represent the composition;
- the reason is structural, not a one-page visual preference;
- the behavior is implemented as a reusable typed variant;
- responsive evidence is captured;
- this document and tests are updated.

An arbitrary Tailwind padding override on an outer public section is not an
acceptable exception.

## Review checklist

- Is the section's role correct for its content hierarchy?
- Do top and bottom feel balanced at all supported viewports?
- Does it remain visibly related to adjacent roles?
- Are compact/pill elements still intentionally smaller?
- Is the hero handling header and trust composition explicitly?
- Did the change preserve copy, translations, links, analytics, and behavior?
- Is configuration editable from one canonical location?
- Did documentation and tests change with the contract?

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-10-11 | Created target contract and maintenance workflow | Preserve spacing/template decisions beyond the initial migration |
| 2026-10-11 | Implemented role tokens, shared schemas/metadata, guided editor, versioning, and safe review parsing locally | Make spacing and templates consistent and maintainable without changing production |
| 2026-10-11 | Connected registry roles to visual frames, activated schema-bound migrations, and verified 390/834/1440px landing previews | Prevent metadata drift, stale editor JSON, and responsive regressions before production approval |
| 2026-10-11 | Added the reusable `industry` landing-hero configuration, header-aware vertical centering, and data-driven media carousel capability | Make the approved barbershop hero reproducible for salons and other vertical pages without component forks |
