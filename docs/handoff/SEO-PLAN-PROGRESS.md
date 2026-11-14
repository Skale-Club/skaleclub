# SEO plan progress (skale.club)

Plan: https://app.notion.com/p/418b7a68612181479e8ed8fd619f4518
Branch: `feat/seo-ssr-hydration` (cut from `main` at 2353d96c). Not merged, not deployed.
Machine notes: the type check (`npx tsc --noEmit -p .`), the unit suite and `npm run build` all run locally (build ~10 s).

## Status per phase

| Phase | Status |
|---|---|
| 0 Restore deploy (`COOLIFY_TOKEN` 401) | Pending, owner action. Out of scope. |
| 1 Real SSR + hydration | Implemented, unit-tested, builds. Browser hydration check: see "Verification". |
| 2 Metadata quick wins | Not started yet (see Next step). |
| 3 Structured data | Not started yet. |
| 4 `/br/blog/<slug>` 301 | Not started yet. |
| 5 Edge / Cloudflare / DNS / favicon | Pending, out of scope. |
| 6 Search Console / blog cadence | Pending, out of scope. |

## Phase 1: what was ported from skaleclub-websites, what already existed, what differs

| Piece in skaleclub-websites | In skaleclub |
|---|---|
| `client/src/entry-server.tsx` (`renderPage`, `specsForRoute`, loopback prefetch, per-request QueryClient, dehydrate) | Ported as `client/src/entry-server.tsx`. Differences: single site (no tenant `X-Forwarded-Host`); route families are this app's (home, faq, blog index, blog post, landings `/<slug>` and `/products/<slug>`, settings-only pages); honours custom `pageSlugs`; `/br` aware (Portuguese prefetches the translation cache and the landing `-br` row); uses `prerenderToNodeStream` with `progressiveChunkSize` raised instead of `renderToPipeableStream`, so lazy routes come out inline (no `$RC` swap script, no hidden segment). |
| `server/ssr-react.ts` (`hasMainContent`, 500 chars, h1/h2, fallback to text, prod bundle import, inline state) | Ported as `server/ssr-react.ts`. Differences: `hasMainContent` looks only inside `<main>` because this app's navbar alone is over 500 characters; on by default, `ENABLE_REACT_SSR=false` is the kill switch (the reference is off by default); loopback port defaults to 1000 like `server/index.ts`. |
| `server/ssr-content.ts` fallback outside `#root`, loader and fallback mutually exclusive | Already existed as `server/seo/content/*` (route-specific summaries, better than the reference's generic one) and `applyPageContent` already dropped the loader. Changed: it was a fixed full-screen opaque overlay (z-index 9999); now an in-flow block placed ahead of `#root` (`client/index.html`). Added a "Page Not Found" block for 404s. |
| Initial-shell ceiling (`INITIAL_SHELL_TIMEOUT_MS` 2500 ms) | Added `client/src/lib/initial-shell.ts`; `App` reveals the shell after it. |
| `server/static.ts` + `server/vite.ts` kept in sync | New `server/seo/shell.ts` (`buildShell`) is the single function both call. Dev previously served the bare template with no SEO or content; it now serves the same head, body, status and headers as production. |
| `server/publicRoutes.ts` (real 404 + noindex) | Already existed: `server/seo/routes.ts` `resolveRoute`. Unchanged. |
| `server/pageSeo.ts` (page-specific metadata) | Already existed: `server/seo/inject.ts` + `shared/coreSeo.ts` + `shared/landingSeo.ts`. Unchanged in Phase 1 (Phase 2 edits copy there). |
| Cache headers (`s-maxage=60, swr=60` on public HTML, `s-maxage=0` on 404) | Added in `server/seo/shell.ts`: 200 indexable `public, max-age=0, s-maxage=60, stale-while-revalidate=60`; 404 `public, max-age=0, s-maxage=0, stale-while-revalidate=0`; admin/noindex and dev `no-cache`. Previously everything was `no-cache`. |
| Unit tests | `server/ssr/entry-server.test.ts` (18), `server/seo/shell.test.ts` (4), content tests updated. Run through Vite `ssrLoadModule` like dev, because the client code needs `import.meta.env`. |
| `CLAUDE.md` "Initial Shell / Crawlable Content" | Added to `CLAUDE.md` and `AGENTS.md` (see commit). |
| Vite SSR build in `script/build.ts` | Ported: `dist/server/entry-server.js` (+ `assets/`), `ssr.noExternal`, no sourcemap, `copyPublicDir: false`; `vite.config.ts` skips the Sentry upload and font copy for that build (`SKALE_SSR_BUILD=1`). |
| `hydrateRoot` in `main.tsx`, query-state hydration, lazy chunk preload | Ported; also seeds the PT translation cache and the landing page-language info before hydrating. |

### App changes needed to make SSR possible (not in the reference)
- `App` takes `ssrPath`, `serverRendered`, `queryClient`, `initialPageInfo`; wouter gets `ssrPath` (both the outer default router for `ThemeProvider` and the language router).
- `useRawPathname()` (`client/src/lib/languageRouting.ts`) replaces `usePathname()` so it resolves against `ssrPath`; `languageHref` reads the language from the router on the server.
- `useTranslation`: never schedules a translation fetch on the server; `TranslationCollectorContext` records which cached PT strings a render used so they can be inlined (`__SSR_TRANSLATIONS__`) and seeded in the browser before hydration.
- `DynamicLanding` no longer waits on an effect before rendering (it showed a loader forever on the server). A PT-only page at an EN URL (`/grupo`) is seeded through `LanguageProvider initialPageInfo`.
- `NfcGuide` reads `?form=` after mount (it read `window` during render).

## Decisions / gotchas
- Default is ON with a kill switch, not off by default. Reason: the fallback keeps working whenever a render is empty, throws or exceeds 3 s.
- Loopback prefetch needs `PORT` set the same way the server listens (container uses 8888).
- Vite dev: `server/vite.ts` custom logger exits the process on any logged error; an SSR module load error in dev would therefore kill the dev server. Not changed.
- Owner decision pending (Phase 2 / problem 5): the home positioning differs per language (EN "AI Automation & Smart Websites for Growing Businesses", PT "Marketing Orientado a Dados e Crescimento Escalável"). Deliberately NOT changed.

## Verification (only commands that were run)
- `npx tsc --noEmit -p .` -> no errors.
- `DATABASE_URL=postgresql://test:test@127.0.0.1:1/test npx tsx --test "server/**/*.test.ts" "shared/**/*.test.ts"` -> 378 pass, 0 fail.
- `npm run build` -> client, `dist/server/entry-server.js`, `dist/index.cjs` build. A standalone `node` import of the built SSR bundle with a mocked `fetch` rendered `/faq` with the FAQ question in the HTML.

## Commits
(see git log on the branch)

## Next step
Phase 2, then 3, then 4 (see Notion plan).
