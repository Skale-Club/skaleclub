# Skale Hub GHL Visit Sync Plan

## Goal
Connect Skale Hub participants and access events to GoHighLevel so each registered visitor is linked to a GHL contact and each meaningful visit/action is recorded in GHL.

## Current State
- Skale Hub already records participants, registrations, and access events in:
  - `hub_participants`
  - `hub_registrations`
  - `hub_access_events`
- Public Skale Hub flow writes events through:
  - `POST /api/skale-hub/register`
  - `POST /api/skale-hub/:liveId/access`
- GHL integration already exists in `server/integrations/ghl.ts` with:
  - `getOrCreateGHLContact`
  - `updateGHLContact`
  - `createGHLNote`
- GHL settings already live behind `/api/integrations/ghl`.

## Proposed Behavior
1. When someone registers for Skale Hub, create or update a GHL contact using name, phone, and/or email.
2. Store the returned GHL contact ID on the Skale Hub participant.
3. When a visitor registers, joins a live, opens a replay, or is denied access, create a GHL note on that contact.
4. Keep GHL sync best-effort: Skale Hub access should never fail just because GHL is unavailable.
5. Show GHL sync status in the Skale Hub admin participant history.

## Data Model Changes
Add GHL tracking columns to `hub_participants`:

- `ghl_contact_id TEXT`
- `ghl_sync_status TEXT DEFAULT 'pending'`
- `ghl_last_synced_at TIMESTAMP`
- `ghl_sync_error TEXT`

Add GHL note tracking columns to `hub_access_events`:

- `ghl_note_id TEXT`
- `ghl_sync_status TEXT DEFAULT 'pending'`
- `ghl_synced_at TIMESTAMP`
- `ghl_sync_error TEXT`

Optional later enhancement:
- `hub_registrations.ghl_note_id` if registration notes should be tracked separately from access events.

## Backend Plan
1. Extend `shared/schema/hub.ts`
   - Add the GHL columns to Drizzle table definitions.
   - Update exported types automatically through `$inferSelect`.
   - Add a new migration, for example `0037_skale_hub_ghl_sync.sql`.

2. Add storage methods in `server/storage.ts`
   - `updateHubParticipantGhlSync(participantId, updates)`
   - `updateHubAccessEventGhlSync(eventId, updates)`
   - Ensure participant history can expose `ghlContactId` and `ghlSyncStatus`.

3. Add a Skale Hub GHL sync helper
   - New file: `server/lib/skale-hub-ghl-sync.ts`
   - Responsibilities:
     - Load enabled GHL settings.
     - Upsert/find a GHL contact for a participant.
     - Write a concise note for each event.
     - Catch and store errors without breaking the Skale Hub request.

4. Update GHL helper behavior if needed
   - Current `getOrCreateGHLContact` expects `phone: string`.
   - Skale Hub accepts phone or email, so either:
     - Make phone optional in `server/integrations/ghl.ts`, or
     - Create a dedicated `getOrCreateGHLContactFlexible` helper.
   - Preferred: make a small backward-compatible helper that supports email-only contacts.

5. Wire sync into Skale Hub routes
   - In `POST /api/skale-hub/register`:
     - After local participant/registration/event succeeds, sync participant to GHL.
     - Create a note like: `Skale Hub registration approved for "{live.title}"`.
   - In `POST /api/skale-hub/:liveId/access`:
     - After each access event is logged, create a note for granted/denied join/replay events.
     - Include live title, event type, outcome, timestamp, matched-by method, and source.

## GHL Note Format
Recommended note examples:

```text
Skale Hub: Registration approved
Live: Weekly Live - Google Ads
Status: approved
Matched by: phone
Date: 2026-05-02 14:30 America/New_York
```

```text
Skale Hub: Live access granted
Live: Weekly Live - Google Ads
Action: join
Matched by: phone
Date: 2026-05-02 14:35 America/New_York
```

```text
Skale Hub: Access denied
Live: Weekly Live - Google Ads
Action: join
Reason: registration_required
Matched by: email
Date: 2026-05-02 14:36 America/New_York
```

## Admin UI Plan
1. Update `SkaleHubSection.tsx`
   - Add GHL badge/status to participant history:
     - `GHL: synced`
     - `GHL: pending`
     - `GHL: failed`
   - If `ghlContactId` exists, optionally show an external-link button to the contact.

2. Optional controls
   - Add a small "Retry GHL sync" button for failed participant sync.
   - Add admin endpoint:
     - `POST /api/skale-hub/participants/:id/ghl-sync`

## Reliability Rules
- GHL sync must be non-blocking.
- Local Skale Hub event logging remains the source of truth.
- Store sync failures for visibility instead of throwing request errors.
- Avoid duplicate notes by saving `ghl_note_id` per access event.
- Do not sync if GHL integration is disabled or missing credentials.

## Verification
1. Type check with `npm run check`.
2. Manually test with GHL disabled:
   - Registration and access still work.
   - Sync status remains pending/skipped without user-facing errors.
3. Manually test with GHL enabled:
   - Register a new Skale Hub visitor.
   - Confirm contact is created/found in GHL.
   - Confirm registration note is added.
   - Click join/replay.
   - Confirm visit note is added.
4. Test email-only visitor:
   - Contact should still be created/found if GHL accepts email-only contacts.
5. Test repeated visit:
   - Same participant should reuse the same GHL contact.
   - Each distinct access event should create at most one GHL note.

## Implementation Order
1. Migration and schema updates.
2. Storage update methods.
3. Flexible GHL contact helper.
4. Skale Hub GHL sync helper.
5. Route integration for register/access events.
6. Admin UI sync indicators.
7. Manual verification with disabled and enabled GHL.
