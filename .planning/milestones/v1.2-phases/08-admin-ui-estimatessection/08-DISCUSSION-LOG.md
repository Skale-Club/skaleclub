# Phase 8: Admin UI (EstimatesSection) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 08-admin-ui-estimatessection
**Areas discussed:** Service Picker UX

---

## Service Picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline checklist | Scrollable list of catalog services with checkboxes; checking pre-fills fields | ✓ |
| Combobox / search dropdown | Searchable dropdown, appends one item at a time | |
| You decide | Claude picks based on existing patterns | |

**User's choice:** Inline checklist (Recommended)
**Notes:** Admin checks services they want; each checked row is pre-filled with catalog snapshot data.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — inline editable | Checked service rows show editable inputs for title, description, price | ✓ |
| No — read-only snapshot | Services added as-is, editable only via PUT after save | |

**User's choice:** Yes — inline editable
**Notes:** Satisfies EST-07 requirement for "pre-filled and editable before saving".

---

| Option | Description | Selected |
|--------|-------------|----------|
| Editable rows only | Re-edit shows only current estimate's services as editable rows; checklist for adding new | ✓ |
| Full checklist re-shown | Catalog checklist re-rendered with already-selected items checked | |

**User's choice:** Editable rows only (Recommended)
**Notes:** Cleaner re-edit UX — existing rows managed in-place; checklist appears only when adding new services.

---

## Claude's Discretion

- Dialog layout (single scrollable form decided by Claude)
- Features field (deferred — not editable in Phase 8)
- Copy-link format (full URL with window.location.origin)
- Delete confirmation pattern (AlertDialog, following FormsSection)
- Sidebar icon selection
- Toast wording
- Empty state text

## Deferred Ideas

- Features array editing in the dialog — deferred past Phase 8
- Estimate status / expiry — out of scope for v1.2
