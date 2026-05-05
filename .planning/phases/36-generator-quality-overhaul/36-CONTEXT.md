# Phase 36: Generator Quality Overhaul - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto (`--auto`) — all gray areas resolved with recommended defaults

<domain>
## Phase Boundary

Make the existing blog generator (`server/lib/blog-generator.ts`) production-grade:
- Prompts target Brazilian Portuguese (pt-BR) explicitly
- Generated HTML is sanitized to a strict allowlist before insert
- Slugs are accent-normalized (NFD)
- Content length is bounded
- Every Gemini call has a timeout (AbortController) and handles empty responses
- Model identifiers are env-overridable

OUT OF SCOPE: admin UI changes (Phase 37), dynamic cron frequency (Phase 38), per-stage durationMs logging (Phase 38), retry-with-backoff (Phase 38).

</domain>

<decisions>
## Implementation Decisions

### Sanitization Library

- **D-01:** Use `sanitize-html` npm package for HTML sanitization.
  - **Why:** Dedicated, battle-tested, handles whitespace/comment edge cases that hand-rolled regex cannot. Tiny (~30KB), no native deps. Established pattern of "single canonical lib per concern" in the project.

### Allowed HTML Tags (strict allowlist)

- **D-02:** Tags allowed in saved post body: `p, h2, h3, ul, ol, li, strong, em, a, blockquote`. Everything else (including `script, iframe, form, style, link, img, video, table, code, span, div, h1, h4-6, br`) is stripped (children preserved as text).
  - **Why:** Matches BLOG2-01 verbatim. Block + minimal inline. No images in v1.9 body content (cover image is separate). No `h1` because the post title is rendered separately. No `code` because we're not a developer blog. No `br` because Gemini sometimes uses them as cheap paragraph breaks.

### `<a>` Tag Policy

- **D-03:** Allowed attributes on `<a>`: `href` only. Sanitizer forces `rel="noopener noreferrer nofollow"` and `target="_blank"` on every saved anchor. URLs must match `^(https?:\/\/|\/)` — `javascript:`, `data:`, `mailto:`, `tel:` are stripped.
  - **Why:** Prevents XSS via `href="javascript:..."`. `nofollow` because Gemini's link suggestions are AI-guesses, not editorially vetted. `_blank` opens external links in new tabs (UX standard).

### Slug Normalization

- **D-04:** Inline pure function `slugifyTitle(title: string): string` in `server/lib/blog-generator.ts` (no new dependency):
  ```
  title.normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
       .toLowerCase()
       .replace(/[^a-z0-9]+/g, '-')                          // non-alnum → hyphen
       .replace(/^-+|-+$/g, '')                              // trim hyphens
       .slice(0, 80);                                         // cap length
  ```
  Then existing `${baseSlug}-${Date.now()}` pattern is preserved for uniqueness.
  - **Why:** No npm dep needed (≈10 lines). NFD strip is the canonical pt-BR accent-removal technique. 80-char cap leaves room for the timestamp suffix without exceeding URL length conventions.

### Content Length Measurement

- **D-05:** Length validation runs AFTER sanitization, on the plain-text projection (HTML stripped). Bounds: `600 ≤ plainTextLength ≤ 4000` characters.
  - **Why:** Tag bytes don't count toward "is this a substantive blog post?" — measuring plain text gives a reading-time-correlated metric. After sanitization so we measure what's actually saved.

### Validation Failure Mode

- **D-06:** Any of the following marks the job `failed` with the corresponding `reason` and the post is NOT created:
  - Sanitizer detected forbidden tags AND the plain text after stripping is < 600 chars → `reason: 'invalid_html'`
  - Sanitization left valid HTML but plain text is < 600 or > 4000 chars → `reason: 'content_length_out_of_bounds'`
  - When sanitizer just strips tags (no length impact) → continue silently with sanitized content (no failure)
  - Empty Gemini candidates array → `reason: 'gemini_empty_response'`
  - Gemini call timed out → `reason: 'gemini_timeout'`
  - **Why:** Hard fail when content is unsalvageable. Silently sanitize when we can rescue the content. Distinct reasons help admin debug from job history (Phase 37).

### Gemini Timeout Strategy

- **D-07:** Every Gemini call wrapped in an `AbortController` with default 30000ms timeout. Override via env var `BLOG_GEMINI_TIMEOUT_MS`. On abort, throw a typed `GeminiTimeoutError` caught by the job runner → marked failed with `reason: 'gemini_timeout'`.
  - **Why:** A hung call shouldn't block the runtime forever. 30s is generous (Gemini Flash typically replies in < 5s). Configurable for slow networks.

### Empty Candidates Handling

- **D-08:** After every Gemini call, check `response.candidates?.length`. If 0 or undefined, throw a typed `GeminiEmptyResponseError`. The job runner catches it and marks the job failed with `reason: 'gemini_empty_response'`. No retry in this phase (retry-with-backoff is Phase 38).
  - **Why:** Empty candidates = either content filter triggered or model outage. We don't want to silently produce a blank post. Distinct error class makes it easy for Phase 38 to add retry logic.

### Env-Overridable Models

- **D-09:** Two new env vars with hardcoded fallbacks:
  - `BLOG_CONTENT_MODEL` — fallback `'gemini-2.5-flash'`
  - `BLOG_IMAGE_MODEL` — fallback `'gemini-2.5-flash-image-preview'` (or whatever Phase 22 currently uses — verify before locking)
  - Documented in `.env.example`
  - Read once at module load (not per-call) — no hot-reload needed
  - **Why:** Lets ops swap models if Google deprecates one without redeploying code. Env-time read keeps the codebase free of feature-flag logic.

### Prompt Structure

- **D-10:** Use the existing single-prompt pattern (Gemini OpenAI-compat does not have first-class system/user split for the chat-completions interface used here). Inject brand voice + RSS source context inside the user message:
  ```
  You are a content writer for Skale Club, a Brazilian B2B agency.
  Write in Brazilian Portuguese (pt-BR). Audience: business owners.
  Tone: professional, data-driven, actionable. No fluff.

  Source RSS item:
    Title: {item.title}
    Summary: {item.summary}

  Task: ...
  ```
  - **Why:** Single string is simpler and works the same on the OpenAI-compat endpoint we use for Gemini. Brand block as a leading "system-style" instruction is a common pattern.

### Brand Voice Block

- **D-11:** Brand voice paragraph is HARDCODED in `server/lib/blog-generator.ts` for v1.9. Future iterations can read it from `companySettings`. Content (verbatim, in pt-BR):
  ```
  Você é um redator da Skale Club, uma agência brasileira de marketing B2B.
  Escreva em português brasileiro (pt-BR). Público-alvo: donos de negócios B2B.
  Tom: profissional, orientado a dados, acionável. Sem floreios.
  ```
  - **Why:** YAGNI — admin doesn't need to tune the voice in v1.9. Hardcoded is one less thing that can break.

### HTML Output Instructions in Prompt

- **D-12:** Every content prompt ends with the same explicit rule block (verbatim):
  ```
  REGRAS DE FORMATAÇÃO (obrigatórias):
  - Devolva APENAS HTML do corpo do post — sem <html>, <head>, <body>, sem ``` blocos.
  - Use SOMENTE estas tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>.
  - PROIBIDO: <script>, <iframe>, <form>, <style>, <link>, <img>, <video>, <table>, <h1>, <br>.
  - Links: <a href="..."> apenas. Sem rel/target — o sistema adiciona.
  - Comprimento: entre 600 e 4000 caracteres de texto puro (sem contar tags).
  ```
  - **Why:** Belt-and-suspenders. Sanitizer enforces the contract; the prompt asks Gemini to comply natively so the sanitizer's job is rare cleanup, not heavy lifting.

### Failure Reason Taxonomy (additions to blog_generation_jobs.reason)

- **D-13:** New `reason` values for skipped/failed jobs:
  - `'invalid_html'` — content unsalvageable after sanitization
  - `'content_length_out_of_bounds'` — too short or too long
  - `'gemini_timeout'` — AbortController fired
  - `'gemini_empty_response'` — candidates array empty
  - **Why:** Pre-existing reasons (`no_settings`, `disabled`, `posts_per_day_zero`, `too_soon`, `locked`, `no_rss_items`) stay. New reasons are additive. Phase 37 admin UI will surface them in job history.

### File Layout

- **D-14:** New file:
  - `server/lib/blogContentValidator.ts` — pure module: `sanitizeBlogHtml(html): string`, `getPlainTextLength(html): number`, `slugifyTitle(title): string`, plus exported error classes (`GeminiTimeoutError`, `GeminiEmptyResponseError`)

  Modified files:
  - `server/lib/blog-generator.ts` — replace inline slug logic, wrap Gemini calls with AbortController, call sanitizer + length validator on Gemini output, use env-overridable model IDs, inject brand block + RSS context into prompts
  - `package.json` — add `sanitize-html`, `@types/sanitize-html`
  - `.env.example` — document `BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL`, `BLOG_GEMINI_TIMEOUT_MS`
  - **Why:** Validator/error classes are reusable and testable in isolation. Generator stays the orchestrator.

### Sanitizer Configuration

- **D-15:** `sanitize-html` config object lives at the top of `blogContentValidator.ts`:
  ```ts
  const SANITIZE_OPTS: sanitizeHtml.IOptions = {
    allowedTags: ['p','h2','h3','ul','ol','li','strong','em','a','blockquote'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http','https'],
    transformTags: {
      'a': (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    },
  };
  ```
  - **Why:** Single source of truth. Easy to tune. The transform forces safe link defaults regardless of what Gemini emits.

### Idempotency / Backwards Compatibility

- **D-16:** No DB migration required. The new `reason` values are added at the application layer (text column already accepts them). Existing post rows are not retroactively sanitized — only newly-generated drafts go through the new pipeline.
  - **Why:** Zero risk to existing content. The "old slop" cleanup, if needed, is a separate one-shot script outside this phase.

### Claude's Discretion

- Internal helper names (e.g., `extractPlainText`, `validateContentLength`)
- Which test-style sanity check to run during npm run check (we have no test framework — just static check)
- Whether to expose `BLOG_GEMINI_TIMEOUT_MS` parsing as `Number(...) || 30_000` (recommended yes — defensive)
- Exact `.env.example` comment phrasing for the three new vars

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md` — BLOG2-01..06 mapped to this phase
- `.planning/ROADMAP.md` §"Phase 36"
- `.planning/phases/35-rss-fetcher-and-topic-selection/35-CONTEXT.md` — RSS context now feeds the prompts (D-09 dependency)
- `.planning/phases/35-rss-fetcher-and-topic-selection/35-03-SUMMARY.md` — generator integration shape

### Existing Code
- `server/lib/blog-generator.ts` (~568 lines after Phase 35) — file Phase 36 modifies
- `server/lib/gemini.ts` — Gemini OpenAI-compat client (existing)
- `server/lib/rssTopicSelector.ts` — selectNextRssItem return type (BlogRssItem with title + summary)
- `shared/schema/blog.ts` — `blogGenerationJobs` reason field (text, no enum constraint)

### Reference for Sanitization API
- https://www.npmjs.com/package/sanitize-html (canonical config docs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/lib/blog-generator.ts` already has structured `{ skipped, reason }` returns
- `acquireLock` / `releaseLock` pattern is in place — new failure modes should release lock before returning
- `createBlogPost(storage, ...)` exists — sanitized HTML feeds in via the existing `content` field

### Established Patterns
- Single canonical npm dep per concern (rss-parser for RSS, @google/genai for Gemini, anthropic-ai/sdk for Claude)
- Module-level config objects (e.g., `parser` instance in rssFetcher.ts)
- Typed errors thrown from helpers, caught at the orchestrator layer
- Env vars read at module load with defensive `|| fallback` defaults

### Integration Points
- BlogGenerator.generate() — sanitize content right before createBlogPost()
- Gemini call sites in blog-generator.ts (topic prompt, content prompt, image generation)

</code_context>

<specifics>
## Specific Ideas

- The brand voice block (D-11) is hardcoded but isolated to one constant — moving to companySettings later is a 5-line change.
- The sanitizer's `transformTags` for `<a>` must NOT add `rel`/`target` if the original `<a>` lacks `href` (sanitizer should drop the link entirely in that case via `allowedAttributes`).
- The "invalid_html" failure path applies only when sanitization strips so much that plain-text length drops below 600 — pure formatting fixes (e.g., removing one `<br>`) are silent.
- `BLOG_GEMINI_TIMEOUT_MS` must parse defensively: `Number(process.env.BLOG_GEMINI_TIMEOUT_MS) || 30_000`.

</specifics>

<deferred>
## Deferred Ideas

- **Configurable brand voice** — `companySettings.blogBrandVoice` field. v1.9 is hardcoded.
- **Per-stage timeout override** — single 30s default for v1.9. Per-stage overrides (topic/content/image) can come later if profiling shows it's needed.
- **Retroactive sanitization of old posts** — separate one-shot script, not part of this phase.
- **Gemini retry-with-backoff** — Phase 38 owns this.
- **HTML validator that runs on admin manual edits** — admin manual posts are out-of-scope for v1.9 (no preview yet).
- **Length tuning per category** — single bound for v1.9. Per-category bounds if we add categories later.
- **Plagiarism / Copyscape check** — explicitly out of scope per REQUIREMENTS.md.

</deferred>

---

*Phase: 36-generator-quality-overhaul*
*Context gathered: 2026-05-04 (auto mode — recommended defaults)*
