# Quick Task 260906-qwl: /br routes + dark NFC pages - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Task Boundary

Two changes the user asked for after reviewing the live NFC pages:

1. **`/br` as a path segment, not a `-br` suffix.** The user dislikes `precos-chaveiros`,
   asked for the English name with `/br`, then clarified explicitly: *"mas não seria traço
   seria /br"* and *"inclusive o mesmo para o barbershop"*. So the Portuguese version of a
   managed landing must be reachable at `/<slug>/br`, and this applies to the existing
   barbershop pages too, not only the new NFC ones.

2. **Dark design for the 4 NFC pages only.** The user picked "All 4 NFC pages only" when
   asked how far the dark treatment should reach.

</domain>

<decisions>
## Implementation Decisions

### URL scheme — `/br` path segment
- Target URLs: `/nfc-keychains/br`, `/nfc-pricing/br`, `/barbershops/br`, `/websites/br`.
- **Approach: a new `/:slug/br` route that resolves the `<slug>-br` DB row.** The database
  keeps single-segment slugs, so `shared/schema/pages.ts` `slugPattern` needs no change and
  no slug may ever contain a slash.
- **Old `-br` URLs must keep working.** `/barbershops-br` and `/websites-br` are already live
  and links may be circulating. This change is additive.
- `/br` becomes the **canonical** form in hreflang output.
- The NFC Portuguese rows are renamed to fit the shared convention:
  `chaveiros-nfc` -> `nfc-keychains-br`, `precos-chaveiros` -> `nfc-pricing-br`.
  Those two URLs are not yet used in any automation, so breaking them is expected.

### Dark design
- Scoped to the 4 NFC pages. `/websites`, `/barbershops` and the homepage must not change.
- **Opt-in `theme` prop, never a `dark:` Tailwind variant on shared components** — see the
  verified constraint below for why.

### Claude's Discretion
- Exact dark palette values, within the constraint of reusing the site's existing accent.
- Whether `trustBadges` / `reviews` participate in the dark treatment at all.

</decisions>

<specifics>
## Verified facts (checked against the codebase — do NOT re-derive)

1. **Routing is single-segment.** `client/src/App.tsx:278` is
   `<Route path="/:slug" component={DynamicPage} />`, the last route before `NotFound`.
   The file's own comment says any new known route MUST be added ABOVE that line.
   Wouter matches top-down. A two-segment path does not match `/:slug` today, so
   `/barbershops/br` currently renders the 404 page.

2. **Slugs may not contain slashes.** `shared/schema/pages.ts:28`
   `slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, applied to both `slug` (line 56) and
   `alternateSlug` (line 63), max 80 chars. This is why the DB keeps `-br` slugs and the
   slash lives only in the route.

3. **The API is single-segment too:** `server/routes/pages.ts:10`
   `app.get("/api/pages/slug/:slug", ...)`. The client should keep calling it with the
   resolved `<slug>-br` value.

4. **`DynamicLanding.tsx` builds hreflang** from `data.slug` + `data.alternateSlug` as
   `${origin}/${slug}`. That URL construction is what must start emitting `/slug/br`.

5. **The public site is ALWAYS dark-classed.** `client/src/context/ThemeContext.tsx`
   `applyTheme()`: `themeToApply = inAdmin ? newTheme : 'dark'`, and `tailwind.config.ts`
   has `darkMode: ["class"]`. **Consequence:** adding `dark:` variants to any shared
   component instantly restyles `/websites`, `/barbershops` and the homepage. That is a
   regression and is forbidden. Dark styling must be an explicit opt-in prop.

6. **No page section uses `dark:` today** — all 15 files in
   `client/src/components/pages/sections/` hardcode light colors (`bg-zinc-50`, `bg-white`,
   `text-zinc-900`). `HeroWebsitesSection` is the exception in spirit: it hardcodes a solid
   `#1C53A3` blue and already reads as dark.

7. **Current `pages` rows in production (9):**
   `barbershops`/`barbershops-br`, `websites`/`websites-br`, `nfc-keychains`/`chaveiros-nfc`,
   `nfc-pricing`/`precos-chaveiros`, and `grupo` (no alternate).

8. **Adapters:** `LeadFormCtaAdapter` renders its own markup (safe to restyle).
   `TrustBadgesAdapter` and `ReviewsAdapter` wrap `client/src/components/home/TrustBadges.tsx`
   and `ReviewsSection.tsx`, which the homepage also uses (restyle at the adapter level, or
   drop from scope).

9. **`scripts/seed-nfc-keychains-translations.ts` is keyed on SOURCE TEXT**, which this task
   does not change, so it should need no edit. Confirm rather than assume.

</specifics>

<canonical_refs>
## Canonical References

- `client/src/App.tsx` — route table, catch-all at line 278
- `client/src/pages/DynamicLanding.tsx` — page fetch + hreflang construction
- `shared/schema/pages.ts` — slug validation
- `server/routes/pages.ts` — public page endpoint
- `client/src/context/ThemeContext.tsx` — forces dark on the public site
- `scripts/seed-nfc-keychains-landing.ts` — the 4 NFC rows
- `scripts/seed-barbershop-landing.ts` — MUST NOT be modified

</canonical_refs>
