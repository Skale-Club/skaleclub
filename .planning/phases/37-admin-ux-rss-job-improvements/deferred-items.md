# Deferred Items — Phase 37

## Pre-existing TypeScript errors (out of scope, not introduced by Phase 37)

`npm run check` reports these errors that pre-date Phase 37 work:

```
server/lib/blogContentValidator.ts(16,26): error TS2307: Cannot find module 'sanitize-html' or its corresponding type declarations.
server/lib/blogContentValidator.ts(45,9): error TS7006: Parameter 'tagName' implicitly has an 'any' type.
server/lib/blogContentValidator.ts(45,18): error TS7006: Parameter 'attribs' implicitly has an 'any' type.
server/lib/rssFetcher.ts(26,20): error TS2307: Cannot find module 'rss-parser' or its corresponding type declarations.
```

**Verified pre-existing:** Confirmed via `git stash && npm run check` — same errors appear on the unmodified main branch HEAD (5e44cb5).

**Cause:** Likely missing dev dependency installs (`@types/sanitize-html`, `@types/rss-parser`, or the runtime packages themselves). These shipped in Phase 35/36 implementation summaries as installed but appear to have been removed from `node_modules` since.

**Action:** Run `npm install` to restore. Not addressed in Phase 37 (out of scope; no Phase 37 file imports these modules).
