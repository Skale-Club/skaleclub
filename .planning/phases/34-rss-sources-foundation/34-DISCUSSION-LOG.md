# Phase 34: RSS Sources Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 34-rss-sources-foundation
**Areas discussed:** Cascade behavior, Item retention, Auth support, Score storage
**Mode:** User delegated all decisions to recommended defaults

---

## Cascade Behavior on Source Delete

| Option | Description | Selected |
|--------|-------------|----------|
| Cascade | Delete all items with the source — clean, simpler | ✓ |
| Set source_id NULL | Orphan items, preserve item history | |
| Restrict | Block delete if items exist | |

**User's choice:** Recommended default (Cascade)
**Notes:** Matches v1.5/v1.6 cascade pattern. Posts survive (live in blog_posts), only the RSS-item-to-post trace is lost. Operational simplicity wins.

---

## Item Retention Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep forever | All items kept indefinitely | ✓ |
| Purge used after N days | Cleanup used items older than N days | |
| Keep used, purge skipped | Mid-ground retention | |

**User's choice:** Recommended default (Keep forever)
**Notes:** YAGNI. Schema doesn't need to anticipate cleanup. Add a purge job later if DB growth becomes a problem.

---

## Auth Support for Private Feeds

| Option | Description | Selected |
|--------|-------------|----------|
| Public feeds only | No auth fields in schema | ✓ |
| Optional auth fields | Nullable auth_type/auth_value columns | |

**User's choice:** Recommended default (Public feeds only)
**Notes:** All Skale Club RSS sources will be public blogs/news/industry sites. Adding auth columns later is an additive migration — forward-compatible.

---

## Score Storage Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Compute on-the-fly | Score computed each generator run, no DB column | ✓ |
| Store score on item | Persist score, recompute on settings change | |

**User's choice:** Recommended default (Compute on-the-fly)
**Notes:** Pending item counts are small (tens to low hundreds). Scoring is keyword-overlap math — sub-millisecond. Compute-fresh avoids stale-cache issues when SEO keywords change in settings.

---

## Claude's Discretion

- Exact column ordering in the migration SQL
- Whether `blog_rss_sources` has `created_at` / `updated_at` (recommended yes)
- `summary` column type — default `text` per project convention
- Whether to add `feed_format` enum on source — recommended no (parser auto-detects)

## Deferred Ideas

- Auth support for private feeds (additive migration when needed)
- pgEnum for status field (current text+CHECK is sufficient)
- Automatic cleanup of stale items (separate phase if DB growth matters)
- Score caching (only if profiling shows it's a bottleneck)
- Multiple feed formats per source (RSS + Atom both supported by parser, no schema work)
