# Phase 36: Generator Quality Overhaul - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-05-04
**Phase:** 36-generator-quality-overhaul
**Mode:** Auto (`--auto`) — all gray areas resolved with recommended defaults

---

## Auto-Selected Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| Sanitization library | `sanitize-html` npm | Battle-tested, dedicated, ~30KB |
| Allowed tags | Strict allowlist (p, h2, h3, ul, ol, li, strong, em, a, blockquote) | Matches BLOG2-01 verbatim; no images in body, no h1, no br |
| `<a>` policy | href only; force rel=noopener noreferrer nofollow + target=_blank | XSS protection; AI links not editorially vetted |
| Slug normalization | Inline NFD strip function (no new dep) | ~10 lines; canonical pt-BR technique |
| Content length | Plain-text length, 600-4000 chars, after sanitization | Reading-time correlated, post-sanitize is what's saved |
| Failure mode | invalid_html / content_length_out_of_bounds / gemini_timeout / gemini_empty_response | Distinct reasons for admin debugging |
| Gemini timeout | AbortController, default 30s, env override BLOG_GEMINI_TIMEOUT_MS | Gemini Flash typically < 5s; configurable for slow networks |
| Empty candidates | Throw GeminiEmptyResponseError, mark failed (no retry in this phase) | Phase 38 owns retry logic |
| Env-overridable models | BLOG_CONTENT_MODEL + BLOG_IMAGE_MODEL with hardcoded fallbacks | Lets ops swap if Google deprecates |
| Prompt structure | Single user message with brand block + RSS context inline | Gemini OpenAI-compat doesn't have first-class system role here |
| Brand voice | Hardcoded pt-BR block in blog-generator.ts | YAGNI — companySettings.blogBrandVoice is future work |
| Failure reason taxonomy | Add 4 new reason values (additive, no migration) | Text column accepts; Phase 37 surfaces them |
| File layout | New blogContentValidator.ts + modified blog-generator.ts/.env.example/package.json | Validator is reusable, generator stays orchestrator |
| Sanitizer config | `transformTags` on `<a>` forces safe rel/target | Single source of truth; safe link defaults regardless of Gemini output |
| Idempotency | No DB migration; new reasons added at application layer | Zero risk to existing content |

## Claude's Discretion

- Internal helper names
- Defensive parsing of `BLOG_GEMINI_TIMEOUT_MS` (recommended `Number(...) || 30_000`)
- `.env.example` comment phrasing

## Deferred Ideas

- Configurable brand voice via companySettings
- Per-stage timeout override
- Retroactive sanitization of old posts
- Retry-with-backoff (Phase 38)
- HTML validation on admin manual edits
- Per-category length bounds
- Plagiarism/Copyscape check (out of scope per REQUIREMENTS.md)
