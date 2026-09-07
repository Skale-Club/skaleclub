---
phase: quick-260906-qwl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/App.tsx
  - client/src/pages/DynamicLanding.tsx
  - client/src/components/pages/sections/sectionTheme.ts
  - client/src/components/pages/sections/ProcessStepperSection.tsx
  - client/src/components/pages/sections/PricingTableSection.tsx
  - client/src/components/pages/sections/FaqAccordionSection.tsx
  - client/src/components/pages/sections/ContentBlocksSection.tsx
  - client/src/components/pages/sections/LeadFormCtaAdapter.tsx
  - client/src/components/pages/sections/TrustBadgesAdapter.tsx
  - scripts/seed-nfc-keychains-landing.ts
autonomous: false
requirements: [QWL-01, QWL-02, QWL-03, QWL-04, QWL-05]

must_haves:
  truths:
    - "Visiting /nfc-keychains/br, /nfc-pricing/br, /barbershops/br and /websites/br renders the Portuguese page (not the 404 page)"
    - "Visiting /barbershops-br and /websites-br still renders the same Portuguese page it renders today"
    - "The hreflang tags on every member of a bilingual pair point the PT alternate at /<base>/br, whichever URL form was used to reach the page"
    - "The 4 NFC pages render on a dark background with WCAG AA body text"
    - "/websites, /barbershops and the homepage render exactly as they do today"
    - "npm run check reports zero errors"
  artifacts:
    - path: "client/src/App.tsx"
      provides: "/:slug/br route registered directly above the /:slug catch-all"
      contains: "/:slug/br"
    - path: "client/src/pages/DynamicLanding.tsx"
      provides: "brVariant slug resolution + /br-canonical hreflang URL builder"
      contains: "brVariant"
    - path: "client/src/components/pages/sections/sectionTheme.ts"
      provides: "shared optional theme zod fragment"
      contains: "z.enum([\"light\", \"dark\"])"
    - path: "scripts/seed-nfc-keychains-landing.ts"
      provides: "renamed PT slugs, theme:dark props, orphan cleanup"
      contains: "nfc-keychains-br"
  key_links:
    - from: "client/src/App.tsx"
      to: "client/src/pages/DynamicLanding.tsx"
      via: "DynamicPageBr lazy wrapper passing brVariant"
      pattern: "DynamicPageBr"
    - from: "client/src/pages/DynamicLanding.tsx"
      to: "/api/pages/slug/:slug"
      via: "resolved single-segment `<base>-br` slug in the query key"
      pattern: "/api/pages/slug/"
    - from: "scripts/seed-nfc-keychains-landing.ts"
      to: "pages table"
      via: "upsert by slug then delete exactly the two renamed legacy slugs"
      pattern: "RENAMED_LEGACY_SLUGS"
---

<objective>
Two additive changes, one plan.

1. Make `/<slug>/br` a working URL for every managed bilingual landing, resolving the
   existing `<slug>-br` database row, with `/br` becoming the canonical form in hreflang.
   The DB keeps single-segment slugs; the slash lives only in the client route.
2. Give the 4 NFC pages a dark treatment via an opt-in `theme` prop, with `/websites`,
   `/barbershops` and the homepage provably untouched.

Purpose: the user asked for `/nfc-keychains/br` instead of `precos-chaveiros`, explicitly
extended it to barbershops, and chose "all 4 NFC pages only" for the dark design.

Output: 4 reachable `/br` URLs, 2 renamed NFC PT rows, 5 theme-aware section components,
and a reseed gated on explicit user approval.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260906-qwl-nfc-barbershop-br-routes-and-dark-nfc-pa/260906-qwl-CONTEXT.md
@CLAUDE.md
@client/src/App.tsx
@client/src/pages/DynamicLanding.tsx
@client/src/components/pages/sections/ProcessStepperSection.tsx
@scripts/seed-nfc-keychains-landing.ts

<interfaces>
<!-- Verified during planning. Use these directly — do not re-explore. -->

client/src/App.tsx:79 — the existing lazy wrapper to clone:
```tsx
const DynamicPage = lazy(() => import("@/pages/DynamicLanding").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
```
client/src/App.tsx:276-279 — the insertion point (comment is authoritative, wouter matches top-down):
```tsx
{/* Catch-all dynamic landing route — MUST be last before the 404 fallback.
    Wouter matches top-down, so any new known route must be added ABOVE this line. */}
<Route path="/:slug" component={DynamicPage} />
<Route component={NotFound} />
```

client/src/pages/DynamicLanding.tsx — current signature + hreflang builder:
```tsx
export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useQuery<PageResponse>({ queryKey: [`/api/pages/slug/${slug}`], ... });
  // ...
  const selfHref = `${origin}/${slugForSeo}`;
  const altHref  = `${origin}/${altSlug}`;
  const xDefaultHref = pageLanguage === "en" ? selfHref : altHref;
```
`PageResponse` = `{ slug, name, sections, isActive, language: "en" | "pt", alternateSlug?: string | null }`.

scripts/seed-nfc-keychains-landing.ts:398-401 — the four page specs:
```ts
const LANDING_EN: LandingSpec = { slug: "nfc-keychains",    ..., alternateSlug: "chaveiros-nfc",    sections: LANDING_SECTIONS };
const LANDING_PT: LandingSpec = { slug: "chaveiros-nfc",    ..., alternateSlug: "nfc-keychains",    sections: LANDING_SECTIONS };
const PRICING_EN: LandingSpec = { slug: "nfc-pricing",      ..., alternateSlug: "precos-chaveiros", sections: PRICING_SECTIONS };
const PRICING_PT: LandingSpec = { slug: "precos-chaveiros", ..., alternateSlug: "nfc-pricing",      sections: PRICING_SECTIONS };
```
`upsertLanding(spec)` (line 441) selects `WHERE pages.slug = spec.slug`, UPDATEs if found else
INSERTs. It has no id/rename path — **renaming a slug creates a new row and orphans the old one.**

Section shapes (all follow the same optional-prop + DEFAULTS pattern):
| component | section wrapper class today | testid |
|---|---|---|
| ProcessStepperSection | `bg-zinc-50 py-20 sm:py-24` | `section-process-stepper`, `step-process-{n}` |
| PricingTableSection | `bg-zinc-50 py-20 sm:py-24` | `section-pricing-table`, `pricing-line-{n}` |
| FaqAccordionSection | `bg-white py-20 sm:py-24` | `section-faq-accordion`, `faq-item-{n}` |
| ContentBlocksSection | `bg-white py-20 sm:py-24` | `section-content-blocks`, `content-block-{n}` |
| LeadFormCtaAdapter | `bg-zinc-950 py-20 text-center` | `data-landing-lead-cta` attribute |
| TrustBadgesAdapter | `container-custom mx-auto px-4 sm:px-6 py-6` (no bg) | — |
</interfaces>

<verified_findings>
<!-- Established during planning. Confirm at runtime where noted; do not re-derive. -->

**SPA fallback for two-segment paths — NO config change is expected in either environment:**
- Express prod: `server/static.ts:25` — `app.use("*", (_req, res) => res.sendFile(index.html))`.
  A wildcard mount, so `/nfc-keychains/br` is served index.html. This is the Coolify path.
- Express dev: `server/vite.ts:33` — `app.use("*", ...)` transforms and serves index.html. Same.
- `server/routes/redirects.ts:57` — `app.get("/:slug([a-z0-9-]+)")`. Single-segment only, so the
  short-link resolver can never intercept `/<slug>/br`.
- `vercel.json` rewrites: `"/([a-z0-9][a-z0-9-]*)"` has no `/` in its character class, so a
  two-segment path does not match it and falls through to `"/((?!assets/).*)" -> "/index.html"`,
  the SPA entry. It therefore bypasses `/api/index` — which is fine, because for a path with no
  DB redirect record `api/index.ts:25-30` serves that exact same `dist/public/index.html`.

**`scripts/seed-nfc-keychains-translations.ts` needs NO functional edit.** Its entries are keyed
on `source` English text (`{ source, translated }`), which this task does not change. The only
occurrences of `chaveiros-nfc` / `precos-chaveiros` in that file are in header comments (lines
2, 8, 57). A comment-only refresh is optional; the data must not be touched.

**`TrustBadges` and `ReviewsSection` (shared with the homepage) are ALREADY dark.**
`client/src/components/home/TrustBadges.tsx:33` is `bg-[#111111] ... border-white/10` with
`text-white` / `text-slate-400` / `text-blue-300`. `client/src/components/home/ReviewsSection.tsx:88`
is `bg-[#111111] ... text-white`. Consequence:
- `ReviewsAdapter` needs **no change at all** — it renders an already-dark full-bleed section.
  Do not add a `theme` prop to it and do not touch `ReviewsSection.tsx`.
- `TrustBadgesAdapter` needs only a dark background on **its own wrapper div** so there is no
  light gutter around the already-dark badge card. Adapter-level only.
No file under `client/src/components/home/` is modified by this plan, so the homepage cannot regress.
</verified_findings>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the /:slug/br route and make /br the canonical hreflang form</name>
  <files>client/src/App.tsx, client/src/pages/DynamicLanding.tsx</files>
  <action>
**A. `client/src/pages/DynamicLanding.tsx`**

1. Change the component signature to accept an optional flag:
   ```tsx
   export default function DynamicPage({ brVariant = false }: { brVariant?: boolean }) {
     const { slug: routeSlug } = useParams<{ slug: string }>();
     // `/x/br` resolves the `x-br` row. The DB never stores a slash: shared/schema/pages.ts
     // slugPattern forbids it, so the two-segment form lives only in the route.
     const slug = brVariant && routeSlug && !routeSlug.endsWith("-br")
       ? `${routeSlug}-br`
       : routeSlug;
   ```
   Everything downstream (`queryKey: [\`/api/pages/slug/${slug}\`]`, `enabled: !!slug`) keeps
   using `slug` unchanged, so the API is still called with a single-segment value. The
   `!endsWith("-br")` guard makes the nonsense `/x-br/br` resolve `x-br` instead of 404ing on
   `x-br-br`.

2. Add a module-level URL builder above the component:
   ```tsx
   // A managed bilingual pair stores single-segment slugs (`x` and `x-br`), but the PT
   // member's canonical public URL is the two-segment `/x/br` form (quick 260906-qwl).
   // Legacy `/x-br` URLs keep rendering; they simply self-report the `/x/br` canonical.
   function landingPath(slug: string): string {
     return slug.endsWith("-br") ? `/${slug.slice(0, -3)}/br` : `/${slug}`;
   }
   ```

3. In the hreflang effect, replace only the two href constructions:
   ```tsx
   const selfHref = `${origin}${landingPath(slugForSeo)}`;
   const altHref  = `${origin}${landingPath(altSlug)}`;
   ```
   Leave `selfTag`, `altTag` and `xDefaultHref` logic exactly as-is. Because both hrefs derive
   from `data.slug` / `data.alternateSlug` (never from the request URL), the emitted tags are
   identical whether the page was reached via `/x-br` or `/x/br`. Required output:

   | Page reached | self | alternate | x-default |
   |---|---|---|---|
   | `/nfc-keychains` (en) | `en` -> `/nfc-keychains` | `pt-BR` -> `/nfc-keychains/br` | `/nfc-keychains` |
   | `/nfc-keychains/br` (pt) | `pt-BR` -> `/nfc-keychains/br` | `en` -> `/nfc-keychains` | `/nfc-keychains` |
   | `/barbershops-br` (pt, legacy URL) | `pt-BR` -> `/barbershops/br` | `en` -> `/barbershops` | `/barbershops` |

   Do NOT add a canonical `<link>`: `client/src/hooks/use-seo.ts:105` sets a single global
   canonical from `settings.seoCanonicalUrl`, so there is nothing to contradict.

**B. `client/src/App.tsx`**

4. Next to the existing `DynamicPage` lazy wrapper (line 79), add a sibling:
   ```tsx
   // `/:slug/br` — the PT member of a bilingual pair, resolved to the `<slug>-br` DB row.
   const DynamicPageBr = lazy(() => import("@/pages/DynamicLanding").then(m => ({ default: () => <PageWrapper><m.default brVariant /></PageWrapper> })));
   ```

5. Register the route IMMEDIATELY ABOVE the `/:slug` catch-all (the file comment at line 276-277
   makes this mandatory; wouter matches top-down). Every existing two-segment route
   (`/f/:slug`, the blog post pattern, `${pagePaths.hub}/grupo`) already sits higher and keeps
   winning:
   ```tsx
   {/* Portuguese member of a bilingual landing pair. Resolves the `<slug>-br` row;
       the legacy one-segment `/<slug>-br` URL below still works and is not redirected. */}
   <Route path="/:slug/br" component={DynamicPageBr} />
   ```

**C. Do NOT change** `shared/schema/pages.ts`, `shared/reservedSlugs.ts`, `server/routes/pages.ts`,
`server/static.ts`, `server/vite.ts` or `vercel.json`. See `<verified_findings>` — two-segment
SPA fallback already works in both environments. Confirm this at runtime in `<verify>` rather
than assuming; if a curl comes back non-HTML, stop and report before editing any config.
  </action>
  <verify>
    <automated>npm run check</automated>
    Then, against `skaleclub-dev` on port 5000 (`.claude/launch.json`):
    - `curl -sI http://localhost:5000/barbershops/br` -> 200 with `content-type: text/html`
    - `curl -s http://localhost:5000/api/pages/slug/barbershops-br | head -c 200` -> JSON, not 404
    - Browser `/barbershops/br` and `/websites/br` -> Portuguese page renders (not 404)
    - Browser `/barbershops-br` and `/websites-br` -> still render, unchanged
    - DevTools on `/barbershops/br`: `document.querySelectorAll('link[data-page-i18n]')` shows
      `pt-BR -> /barbershops/br`, `en -> /barbershops`, `x-default -> /barbershops`
    - DevTools on `/barbershops-br`: identical three tags (canonical form, not the legacy URL)
  </verify>
  <done>All four `/br` URLs plus both legacy `-br` URLs render the correct page, hreflang matches the table above from either URL form, and `npm run check` is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add the opt-in theme prop to the five section components</name>
  <files>client/src/components/pages/sections/sectionTheme.ts, client/src/components/pages/sections/ProcessStepperSection.tsx, client/src/components/pages/sections/PricingTableSection.tsx, client/src/components/pages/sections/FaqAccordionSection.tsx, client/src/components/pages/sections/ContentBlocksSection.tsx, client/src/components/pages/sections/LeadFormCtaAdapter.tsx, client/src/components/pages/sections/TrustBadgesAdapter.tsx</files>
  <action>
**Hard rule: never add a `dark:` Tailwind variant.** `client/src/context/ThemeContext.tsx`
forces `dark` on the `<html>` element for the entire public site, so a `dark:` variant would
instantly restyle `/websites`, `/barbershops` and the homepage. Dark is an explicit prop only.

**A. New file `client/src/components/pages/sections/sectionTheme.ts`** — one source of truth
for the enum so the five schemas cannot drift:
```ts
// Quick 260906-qwl — opt-in dark styling for managed landing sections.
// `undefined` and "light" both mean "render exactly as before this task".
// Never use a `dark:` Tailwind variant here: ThemeContext forces the `dark`
// class on the whole public site, which would restyle every landing at once.
import { z } from "zod";

export const sectionThemeSchema = z.enum(["light", "dark"]).optional();
export type SectionTheme = z.infer<typeof sectionThemeSchema>;
```

**B. Palette — use exactly this mapping.** Every value already exists in the codebase; invent nothing.

| Light (today) | Dark | Contrast on `#111111` |
|---|---|---|
| `bg-zinc-50` (section) | `bg-[#0f1014]` | — |
| `bg-white` (section) | `bg-[#111111]` | — |
| `bg-white` (card) | `bg-white/5` | — |
| `border-zinc-200` / `divide-zinc-200` | `border-white/10` / `divide-white/10` | — |
| `shadow-sm` (card) | `shadow-none` | — |
| `text-zinc-900` (headings, price, labels) | `text-white` | 18:1 |
| `text-zinc-700` (bullet text) | `text-zinc-200` | 14:1 |
| `text-zinc-600` (body) | `text-zinc-300` | 13:1 |
| `text-zinc-500` (note) | `text-zinc-400` | 7.3:1 |
| `text-[#1C53A3]` (eyebrow, Check icon) | `text-blue-300` | 9.6:1 |
| `bg-[#1C53A3]/10 text-[#1C53A3]` (kind chip) | `bg-[#5173D6]/20 text-blue-300` | 9.6:1 |
| `bg-zinc-300` (stepper connector line) | `bg-white/15` | — |
| `border-zinc-50` (stepper step-number ring) | `border-[#0f1014]` | — |
| `bg-[#1C53A3]` (stepper icon circle, white icon) | keep `bg-[#1C53A3]`; shadow -> `shadow-[#5173D6]/30` | — |

**`#5173D6` must never be used as a text color on dark** — it measures 4.3:1, below AA. It is a
FILL only, behind white text/icons (exactly how `LeadFormCtaAdapter` and the stepper badge
already use it). `text-blue-300` (`#93c5fd`) is the dark-mode text accent, matching the existing
usage in `client/src/components/home/TrustBadges.tsx:39`.

**C. Per-component change (same shape in all five).**
1. Add `theme: sectionThemeSchema,` to the props schema (import from `./sectionTheme`).
   For `TrustBadgesAdapter`, whose schema is `z.object({}).passthrough()`, make it
   `z.object({ theme: sectionThemeSchema }).passthrough()`.
2. Declare two sibling class maps with identical keys directly above the component:
   ```ts
   const LIGHT = { section: "bg-zinc-50", heading: "text-zinc-900", /* ... */ } as const;
   const DARK  = { section: "bg-[#0f1014]", heading: "text-white",  /* ... */ } as const;
   ```
   **Every `LIGHT` value must be copied verbatim from the current className** so that
   `theme` undefined reproduces today's markup character for character.
3. In the component: `const c = props.theme === "dark" ? DARK : LIGHT;` then substitute
   `c.section`, `c.heading`, etc. into the JSX. Only the theme-varying tokens move into the map;
   layout classes (`py-20 sm:py-24`, `container-custom`, `max-w-3xl`, grid/flex, spacing) stay
   inline and unchanged.
4. Do not touch a single `data-testid`, `data-landing-lead-cta`, `key`, or DOM structure.

**D. Component-specific notes.**
- `ProcessStepperSection` is SHARED with `/websites` and `/barbershops`, which seed `props: {}`.
  Its `theme` is optional, so those pages take the `LIGHT` branch and must render
  byte-identically, including the original `Search / Palette / Code2 / Rocket` icon defaults.
  Do not change `DEFAULTS`, `ICONS`, `ICON_MAP` or `processStepperIconNames`.
- `LeadFormCtaAdapter` is already dark (`bg-zinc-950`). Its dark branch changes ONLY the section
  background to `bg-[#0f1014]` so it sits in the same palette family as its neighbours;
  heading/subheading/button classes are unchanged in both branches. Add a short comment saying
  the prop exists for palette consistency, not because the light branch was light.
- `TrustBadgesAdapter`: dark branch adds `bg-[#0f1014]` to the existing wrapper div and,
  because the badge card wants breathing room on a dark page, bumps `py-6` to `py-6 sm:py-8`
  only in the dark branch. Do NOT import from or edit `client/src/components/home/TrustBadges.tsx`.
- `ReviewsAdapter`: **no change**. Per `<verified_findings>` the underlying `ReviewsSection` is
  already `bg-[#111111]` full-bleed. Leave the file untouched and leave `reviews` with `props: {}`
  in the seed.
- `client/src/components/pages/sectionRegistry.tsx` needs no edit — the schemas it already
  imports gain the field in place.
  </action>
  <verify>
    <automated>npm run check</automated>
    - `git diff --stat client/src/components/home/` -> EMPTY (no shared home component touched)
    - `grep -rn "dark:" client/src/components/pages/sections/` -> no matches
    - `grep -c "data-testid" ` on each of the 5 edited section files -> same count as before the edit
    - Browser `/websites` and `/barbershops`: stepper still light (`bg-zinc-50`, dark text) with
      Search / Palette / Code2 / Rocket icons; compare against a pre-change screenshot
    - Browser `/` (homepage): trust badges and reviews strip unchanged
  </verify>
  <done>Five components accept `theme`, default rendering is verbatim-identical to today, no `dark:` variant exists anywhere under `sections/`, no file under `components/home/` changed, and `npm run check` is clean.</done>
</task>

<task type="auto">
  <name>Task 3: Update the NFC seed script — slug rename, dark props, orphan cleanup (no DB write)</name>
  <files>scripts/seed-nfc-keychains-landing.ts</files>
  <action>
Code changes only. **Do not run the script in this task** — every DB write is gated in Task 4.

**A. Rename the two PT slugs (lines 398-401).** Slugs stay single-segment; `/br` is a route, not a slug.
```ts
const LANDING_EN: LandingSpec = { slug: "nfc-keychains",    name: "NFC Keychains (EN)", language: "en", alternateSlug: "nfc-keychains-br", sections: LANDING_SECTIONS };
const LANDING_PT: LandingSpec = { slug: "nfc-keychains-br", name: "NFC Keychains (PT)", language: "pt", alternateSlug: "nfc-keychains",    sections: LANDING_SECTIONS };
const PRICING_EN: LandingSpec = { slug: "nfc-pricing",      name: "NFC Pricing (EN)",   language: "en", alternateSlug: "nfc-pricing-br",   sections: PRICING_SECTIONS };
const PRICING_PT: LandingSpec = { slug: "nfc-pricing-br",   name: "NFC Pricing (PT)",   language: "pt", alternateSlug: "nfc-pricing",      sections: PRICING_SECTIONS };
```
This adopts the same `<base>` / `<base>-br` convention `barbershops` and `websites` already use,
so the Task 1 route serves all four pairs with no per-page special casing.

**B. Update the header comment block (lines 7-11)** to list `nfc-keychains-br` and
`nfc-pricing-br`, and add a line noting the public PT URLs are `/nfc-keychains/br` and
`/nfc-pricing/br`. Leave the pricing-facts comment block (lines 19-23) alone.

**C. Add the orphan cleanup.** `upsertLanding` keys on slug with no rename path, so the two
renamed specs INSERT new rows and leave the originals behind. Add near the seed runner:
```ts
// One-time cleanup for the 260906-qwl slug rename (chaveiros-nfc -> nfc-keychains-br,
// precos-chaveiros -> nfc-pricing-br). upsertLanding() keys on `slug`, so the renamed
// specs INSERT new rows and orphan the originals. Delete exactly these two slugs and
// nothing else. Idempotent: once they are gone this deletes zero rows and logs a no-op.
const RENAMED_LEGACY_SLUGS = ["chaveiros-nfc", "precos-chaveiros"] as const;

async function deleteRenamedLegacyPages() {
  for (const slug of RENAMED_LEGACY_SLUGS) {
    const deleted = await db
      .delete(pages)
      .where(eq(pages.slug, slug))
      .returning({ id: pages.id, slug: pages.slug });
    if (deleted.length > 0) {
      console.log(`  Deleted orphaned legacy page slug='${slug}' (id=${deleted[0].id}).`);
    } else {
      console.log(`  No page with slug='${slug}' — nothing to delete.`);
    }
  }
}
```
Call it in `main()` **after all four upserts**, never before:
```ts
async function main() {
  await upsertForm();
  await upsertLanding(LANDING_EN);
  await upsertLanding(LANDING_PT);
  await upsertLanding(PRICING_EN);
  await upsertLanding(PRICING_PT);
  console.log("Cleaning up slugs renamed by quick 260906-qwl:");
  await deleteRenamedLegacyPages();
  console.log("Done.");
  await pool.end();
}
```
The `eq(pages.slug, slug)` predicate over a frozen two-element literal array is the whole blast
radius — no `like`, no `in`, no pattern matching, and nothing that could reach `barbershops-br`,
`websites-br` or `grupo`.

**D. Set `theme: "dark"` on the appropriate sections.**
`LANDING_SECTIONS` (line 243):
- `heroWebsites` — unchanged (already sits on solid `#1C53A3`)
- `{ type: "trustBadges", props: { theme: "dark" } }`
- `processStepper` — add `theme: "dark"` to `NFC_STEPPER_PROPS`... **do not mutate the shared
  const**; instead spread it at each use site: `{ type: "processStepper", props: { ...NFC_STEPPER_PROPS, theme: "dark" } }`
- `reviews` — unchanged `props: {}` (already dark, see `<verified_findings>`)
- `leadFormCta` — add `theme: "dark"` alongside the existing props

`PRICING_SECTIONS` (line 271): add `theme: "dark"` to `contentBlocks`, `pricingTable`,
`faqAccordion` and `leadFormCta`, and use the same `{ ...NFC_STEPPER_PROPS, theme: "dark" }`
spread for `processStepper`.

**E. Change no copy and no number.** `$10` / `$200` / `$50` and every string in both section
arrays stay exactly as written. Introduce no turnaround or SLA figure anywhere.

**F. Files that must NOT be modified:** `scripts/seed-barbershop-landing.ts`,
`scripts/seed-websites-landing.ts` (the Task 1 route gives them `/br` with zero DB change),
`shared/reservedSlugs.ts`, `shared/schema/pages.ts`, and
`scripts/seed-nfc-keychains-translations.ts` — that last one is keyed on `source` English text
which is unchanged, so it needs no functional edit (see `<verified_findings>`). A comment-only
refresh of its lines 2/8/57 slug references is permitted; touching any `{ source, translated }`
entry is not.
  </action>
  <verify>
    <automated>npm run check</automated>
    - `grep -n "chaveiros-nfc\|precos-chaveiros" scripts/seed-nfc-keychains-landing.ts` -> matches ONLY inside `RENAMED_LEGACY_SLUGS` and its comment
    - `grep -rn "delete(" scripts/seed-nfc-keychains-landing.ts` -> exactly one delete, guarded by `eq(pages.slug, slug)`
    - `git diff --stat scripts/` -> only `seed-nfc-keychains-landing.ts` (plus, at most, comment-only lines in the translations script)
    - `git diff scripts/seed-nfc-keychains-landing.ts | grep -E "^[-+].*\\\$(10|200|50)"` -> no removals of the price strings
    - Script NOT executed in this task — confirm no `tsx scripts/seed-*` command was run
  </verify>
  <done>The seed defines `nfc-keychains-br` / `nfc-pricing-br` with reciprocal alternateSlugs, carries `theme: "dark"` on the right sections in both arrays, contains exactly one narrowly-scoped delete running after the upserts, and no price or copy string changed. No database was written.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Approve the production DB write, then run full regression QA</name>
  <what-built>
Tasks 1-3 are code-only and type-clean:
- `/:slug/br` route + `/br`-canonical hreflang, with legacy `-br` URLs still rendering
- opt-in `theme` prop on 5 section components; no shared home component touched
- seed script renaming the two NFC PT rows, tagging sections `theme: "dark"`, and cleaning up
  the two orphaned slugs

**Nothing has been written to the database yet.** The reseed is the only remaining step and it
must not run without explicit approval, because it (a) INSERTs `nfc-keychains-br` and
`nfc-pricing-br`, (b) rewrites the sections of all four NFC rows, and (c) DELETEs the rows
`chaveiros-nfc` and `precos-chaveiros`.
  </what-built>
  <how-to-verify>
**Step 1 — approve the write.** Confirm you want the reseed + delete to run against the
production database. If you say no, stop here: all code changes stand and the DB is untouched.

**Step 2 — on approval, run:**
```
npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts
```
Expected log: 4 landings seeded (2 "Updated existing", 2 "Inserted new"), then
`Deleted orphaned legacy page slug='chaveiros-nfc'` and `...'precos-chaveiros'`.
Re-run it once immediately: the second run must log 4 "Updated existing" and two
`nothing to delete` lines, proving idempotency.

**Step 3 — NFC pages (dark, both languages).** In the browser:
1. `/nfc-keychains` and `/nfc-keychains/br` — dark background end to end, no white band between
   sections, body text comfortably readable, prices still `$10` / `$200` / `$50`
2. `/nfc-pricing` and `/nfc-pricing/br` — same, plus the pricing card, FAQ accordion (open and
   close an item) and content blocks all legible on dark
3. `/chaveiros-nfc` and `/precos-chaveiros` — expected to 404 now (intentional; these were never
   used in automation)
4. Lead form CTA on each page opens the modal and submits

**Step 4 — regression (this is the part that must not break).**
1. `/websites` — process stepper is LIGHT (`bg-zinc-50`, dark text) with the original
   Search / Palette / Code2 / Rocket icons. Compare to a pre-change screenshot.
2. `/barbershops` — same light stepper check
3. `/websites/br` and `/barbershops/br` — Portuguese pages render (new URLs)
4. `/websites-br` and `/barbershops-br` — still render (legacy URLs, not redirected)
5. `/` homepage — trust badges strip and reviews section visually identical to before
6. Hreflang spot check on `/nfc-pricing/br`:
   `pt-BR -> /nfc-pricing/br`, `en -> /nfc-pricing`, `x-default -> /nfc-pricing`

**Step 5 —** `npm run check` one final time: zero errors.
  </how-to-verify>
  <resume-signal>Type "approved" to authorize the database write, or describe what you want changed first. After the reseed, report any visual regression on /websites, /barbershops or the homepage.</resume-signal>
</task>

</tasks>

<verification>
- `npm run check` clean after every task
- Four `/br` URLs live: `/nfc-keychains/br`, `/nfc-pricing/br`, `/barbershops/br`, `/websites/br`
- Two legacy URLs still live: `/barbershops-br`, `/websites-br`
- hreflang emits the `/br` form from either URL form of a pair
- `git diff --stat client/src/components/home/` is empty
- `git diff --stat scripts/` touches only the NFC landing seed (and at most comments elsewhere)
- No change to `shared/schema/pages.ts`, `shared/reservedSlugs.ts`, `vercel.json`, `server/`
- Exactly one `db.delete` in the codebase diff, scoped to two literal slugs
</verification>

<success_criteria>
1. The Portuguese version of all four managed pairs is reachable at `/<slug>/br` and the old
   `-br` URLs still work.
2. hreflang advertises `/br` as the PT URL regardless of which URL form was requested.
3. The 4 NFC pages render dark with AA-contrast body text and unchanged copy, prices and testids.
4. `/websites`, `/barbershops` and the homepage are visually unchanged.
5. `chaveiros-nfc` and `precos-chaveiros` no longer exist as rows; nothing else was deleted.
6. `npm run check` is clean.
</success_criteria>

<output>
After completion, create
`.planning/quick/260906-qwl-nfc-barbershop-br-routes-and-dark-nfc-pa/260906-qwl-SUMMARY.md`
recording: the two-segment SPA fallback findings confirmed at runtime, the final dark palette
actually shipped, and the row ids of the newly inserted `nfc-keychains-br` / `nfc-pricing-br` pages.
</output>
