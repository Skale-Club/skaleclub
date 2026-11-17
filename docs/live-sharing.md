# Optional live sharing

Presentations and estimates can optionally start a live session from their admin
list using **Present live**. Normal `/p/:slug` and `/e/:slug` links keep their
existing behavior. Starting a session does not create an audience link or show
a QR code. In the console, **Share with client** explicitly creates the QR/link.

The presenter controls the current slide and language. Guests follow in their
phone browser, with local scrolling for long slides and no shared navigation
controls. The clean-output link opens the same guest view for projection or
screen sharing. Xink tools, screen mirroring, annotations and video playhead
synchronization are outside this feature.

## Enable in development

1. Verify the database is a disposable development database with fake data.
   Do not assume the existing `.env` points at development.
2. Apply only `supabase/migrations/20261117010000_optional_live_sharing.sql`
   using the repository's migration runner against that verified target.
3. Set `LIVE_SHARING_ENABLED=true` in the server environment and restart.
   The default is `false`; the admin action stays hidden until enabled.
4. Keep a persistent `SESSION_SECRET` of at least 32 characters. Do not put its
   value in docs, screenshots, logs or shell arguments.

No source document is modified by starting, navigating or ending a session.
The session pins the document and renderer branding at creation, so source edits
do not change an ongoing meeting. Start a new session to present those edits.

## Access and controls

- Presenters need their existing Google Identity admin session and must own the
  live session. A per-tab controller credential lives in sessionStorage. A reload
  keeps it; a different tab uses **Take control in this tab** explicitly. A
  takeover invalidates the previous credential. Only an acknowledgement advances
  the local slide, and stale revisions are rejected rather than replayed.
- Sharing is a temporary read-only capability, valid until revoked, replaced,
  ended or the four-hour expiry. **Replace sharing link** invalidates the old
  link and its existing viewer cookies. **Hide sharing panel** only hides the
  QR; use **Revoke audience access** to disconnect guests.
- Protected estimates still require the access code captured at session start.
  No price/service snapshot or viewer cookie is returned until verification.
  The code is never stored in the live snapshot. Changing the source code does
  not change a pinned session: revoke/end that session and create a new one.
- The token in the URL fragment is exchanged for an HttpOnly, scoped cookie.
  The fragment is cleared after successful entry. A forwarded link can be used
  by someone else until expiry/revocation (and requires the code when gated).
- Ending a live session does not revoke an independent public document link.
  No permanent link is automatically offered after ending.

## Transport and persistence

`shared/liveSharing.ts` defines the protocol. `server/liveSharing/service.ts`
owns authorization, pinning, lifecycle and optimistic revisions. The Postgres
store serializes mutations with a row lock, commits state before fan-out, and
stores controller/share hashes instead of raw tokens. Join verification issues
a separate server-authenticated viewer cookie, so knowing a share token cannot
bypass an estimate's code gate by forging that cookie.

Presenter commands use authenticated HTTP; guests and presenter displays receive
named `state` SSE events. Every initial connection sends current state. The
frontend ignores older revisions; reconnect/visibility recovery fetches current
state instead of replaying old slide changes. Browser reconnection uses a
two-second retry. Presenter heartbeats run every 15 seconds; after 45 seconds
without one, the audience sees a disconnected label. Sessions expire after four
hours; commands do not extend expiry.

Local commands notify connected rooms immediately. One shared database poll per
active room per second discovers expiry, disconnection, and changes made by
another/restarted process. No viewer means no polling timer. Shutdown closes SSE
connections and timers. Slow clients exceeding the bounded output queue are
disconnected and may reconnect for current state.

The first deployment is intended for **one application process/replica**. The
50-audience/55-total connections per room and 500-total connection caps, counts
and rate limits are process-local. Row locking protects writes across replicas;
remote fan-out falls back to the one-second poll, but global caps/counts need a
shared presence implementation before scaling. Multiple tabs on one device
count as separate connections. Do not promise a latency percentile until tested
through the actual deployment proxy.

The new table uses RLS and revokes anonymous/authenticated Supabase role access.
On plain PostgreSQL the app role must own the table or have an appropriate
server-only policy/privilege. The migration supports databases without Supabase
roles. Expired snapshots stay server-side; no retention job is installed by this
feature. Include `live_sessions` in the normal backup/retention policy and purge
expired records only through an approved maintenance operation.

## Verify before release

Focused tests (no database):

```powershell
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 server/liveSharing/__tests__/service.test.ts server/liveSharing/__tests__/stream.test.ts server/routes/__tests__/liveSharing.test.ts server/lib/__tests__/sentry-scrub.test.ts
```

The route tests exercise actual HTTP/SSE with a transactional in-memory store,
including code-protected estimates, late join/reconnect, navigation and revocation.
They are not proof that a migration was applied or the deployment proxy streams.

Local verification, 2026-11-16 (Surface, critical memory): 28 focused checks
passed; the final warm run took 3.00 seconds with serial test execution. A
targeted TypeScript project covering the new UI/protocol/routes, source/database
adapters, telemetry/static integration and browser suite passed using the native
compiler with one worker and a 128 MiB soft memory limit. Full build, PostgreSQL
migration execution and browser/real-device checks were not run on this machine.

On a capable machine/CI, run the normal typecheck/build and the focused browser
suite `e2e/live-sharing.e2e.ts` against the built client. Browser tests use fake
sources and an in-memory backend, never production. Then verify:

1. Real iPhone Safari and Android Chrome, both same-network and cellular/Wi-Fi.
2. A normal presentation/estimate still works without any live session or QR.
3. QR appears only after sharing; copy/link and clean output work. Code-gated
   estimates do not disclose services/pricing before the code is accepted.
4. All 12 layouts, long content, EN/PT, rotation and magnification remain readable.
5. Late joins, background/lock/unlock, cellular switching, presenter reload,
   takeover, restart, expiry, link replacement, revoke and end behave correctly.
6. A 50-viewer/30-minute staging run measures the proposed p95 <500 ms slide
   propagation and <2 s recovery targets under documented network conditions.

SSE requires unbuffered delivery through the real Coolify/Traefik path. Test
timeouts/stream flushing there; setting `X-Accel-Buffering: no` alone does not
configure Traefik. API/live HTML responses are no-store/noindex; live routes are
network-only in the service worker and excluded from analytics, attribution,
replay and session-request error telemetry.

## Release and rollback

Keep the feature flag off until the migration and staging checks pass. For the
Skale Club website, prepare a backup and obtain the owner's approval before each
production step. Deploy code/schema additively, then enable the feature as a
separate reviewed step. No production operation is part of local implementation.

Rollback: disable `LIVE_SHARING_ENABLED` and restart the container. Existing
connections close; normal presentation/estimate routes remain available. Retain
the additive table for investigation/rollback, rather than dropping client data.
