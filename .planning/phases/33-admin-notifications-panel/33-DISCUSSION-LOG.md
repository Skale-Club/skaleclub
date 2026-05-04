# Phase 33: Admin Notifications Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 33-admin-notifications-panel
**Mode:** --auto (all areas auto-resolved with recommended defaults)
**Areas discussed:** Event card layout, channel editor layout, variable reference display, API route location, GET data strategy

---

## Event Card Layout

| Option | Description | Selected |
|--------|-------------|----------|
| One card per event with stacked channel rows | 3 cards, each with SMS + Telegram rows inline | ✓ |
| Accordion list with expand | Collapsed by default, expand to edit | |
| Flat table (all events × channels in one table) | Compact but loses channel-specific textarea space | |

**Auto-selected:** One card per event (recommended — matches NOTIF-10 "one card per event" wording)

---

## Channel Editor Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked rows (SMS then Telegram) | Each row: toggle + textarea + variable badges + save button | ✓ |
| Side-by-side tabs | Tab per channel — less visible, needs extra click | |
| Side-by-side columns | Two-column layout — textarea too narrow on mobile | |

**Auto-selected:** Stacked rows (recommended — most readable, textarea has full width)

---

## Variable Reference Display

| Option | Description | Selected |
|--------|-------------|----------|
| Badge pills below textarea | Monospace `{{var}}` badges below each textarea | ✓ |
| Collapsible "Variables" section | Hidden by default — friction to discover | |
| Static tooltip/popover | Less discoverable | |

**Auto-selected:** Badge pills below textarea (recommended — always visible, satisfies NOTIF-12)

---

## API Route Location

| Option | Description | Selected |
|--------|-------------|----------|
| New `server/routes/notifications.ts` | Separate file, registered in routes.ts | ✓ |
| Add to `server/routes/integrations.ts` | Integrations file already large; different concern | |

**Auto-selected:** New notifications.ts file (recommended — separation of concerns, consistent with skaleHub pattern)

---

## Frontend Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| GET all, group by eventKey on client | Single query, client groups by eventKey | ✓ |
| GET per-event (3 separate queries) | More requests, complex cache management | |

**Auto-selected:** GET all, group client-side (recommended — simpler, single cache key)

---

## Claude's Discretion

- Exact card styling
- Event display names mapping
- Whether variable badge click copies to clipboard
- Error state display within channel rows
