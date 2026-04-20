---
status: partial
phase: 08-admin-ui-estimatessection
source: [08-VERIFICATION.md]
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar Rendering and Navigation
expected: Start `npm run dev`, navigate to `/admin/estimates`. "Estimates" appears in the admin sidebar after "Xpot" with a Receipt icon; clicking it renders the EstimatesSection list view.
result: [pending]

### 2. Create Flow with Catalog Picker
expected: Click "New Estimate" — dialog opens immediately showing the catalog checklist (scrollable list of portfolio services with checkboxes) without any extra click. Check one service → a service row with pre-filled title/description/price appears.
result: [pending]

### 3. Add Custom Row
expected: Inside the create dialog, click "Add custom row" — a blank row with empty title/description/price inputs and a "custom" badge appends to the service list.
result: [pending]

### 4. Drag-Reorder Persistence
expected: Add 2+ service rows, drag one by its GripVertical handle, save estimate. Re-open via Edit — the dragged order is preserved.
result: [pending]

### 5. Copy-Link Toast
expected: After creating an estimate, click the Copy icon on the list row — toast "Link copied" / "Share this link with your client." appears.
result: [pending]

### 6. Edit Mode — Catalog Picker Collapsed
expected: Click the Edit (Pencil) icon on an existing estimate — dialog shows "Edit Estimate", existing service rows pre-populated, catalog checklist NOT visible by default.
result: [pending]

### 7. Delete with AlertDialog
expected: Click Trash2/Delete on a list row — AlertDialog "Delete estimate?" appears with the client name. Clicking "Delete" removes the row and shows "Estimate deleted" toast.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
