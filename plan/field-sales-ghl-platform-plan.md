# Field Sales Platform + GoHighLevel Integration Plan

## Overview

This document defines a concrete implementation plan for a new mobile-first field sales product inside the existing `skaleclub` project.

The goal is to build a better version of the reference system shown in the screenshots, while keeping everything inside the current stack:

- React frontend in `client/src/`
- Express API in `server/`
- Shared contracts and database schema in `shared/`
- Existing admin panel and authentication flows
- Existing GoHighLevel integration settings and sync capabilities

This product should be **English-only** and designed as a native-feeling PWA for reps in the field.

---

## Product Goal

Build a **Field Sales OS** that allows sales reps to:

- find and manage target accounts
- check in at customer locations with GPS validation
- record visit outcomes, notes, and next actions
- create and update sales opportunities
- sync accounts, contacts, and pipeline activity with GoHighLevel
- operate reliably on mobile, including poor-network scenarios

Managers should be able to:

- assign reps and territories
- review visit compliance
- monitor pipeline and rep performance
- audit sync failures and manual overrides
- configure GHL mapping and automation behavior

---

## Existing Repo Capabilities We Should Reuse

### Already available

- admin auth and user model
- singleton settings tables
- GHL integration settings UI
- basic GHL helper functions for contacts, custom fields, calendar slots, and appointments
- existing lead capture system
- VCard system that can be tied to rep identity
- PWA support

### Relevant existing files

- `shared/schema.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/integrations/ghl.ts`
- `client/src/components/admin/IntegrationsSection.tsx`
- `client/src/pages/VCard.tsx`

### Important constraint

Current GHL support is a starting point, not a finished CRM integration. It currently focuses on settings, contact helpers, and appointment primitives. The new product requires:

- account and visit models
- opportunity sync
- webhook reconciliation
- retryable sync jobs
- rep and manager workflows
- offline-first mobile behavior

---

## Product Scope

## Core modules

### 1. Mobile Field App

New route group for a dedicated mobile shell:

- `/field`
- `/field/check-in`
- `/field/accounts`
- `/field/visits`
- `/field/sales`
- `/field/dashboard`
- `/field/settings`

### 2. Admin / Manager Console

New admin section for:

- rep management
- account assignment
- pipeline mapping
- GHL sync status
- dashboard and reporting
- visit review and compliance

### 3. Sync Layer

Server-side sync orchestration between local database and GoHighLevel:

- contacts
- accounts/business entities
- opportunities
- tasks
- appointments
- webhook events

---

## Target User Roles

### Rep

- sees assigned accounts
- performs check-in/check-out
- logs notes and sales activity
- creates opportunities and follow-up tasks
- syncs when online

### Manager

- sees all reps and team metrics
- reviews invalid or manual check-ins
- assigns accounts and territories
- monitors sync failures and pipeline progression

### Admin

- configures product settings
- configures GHL credentials and mappings
- manages stages, reasons, task templates, and permissions

---

## Information Architecture

## Mobile bottom navigation

- `Check-In`
- `Accounts`
- `Visits`
- `Sales`
- `Dashboard`

## Manager navigation inside admin

- `Field Sales Overview`
- `Reps`
- `Accounts`
- `Visits`
- `Pipeline`
- `Sync Health`
- `Settings`

---

## UX Principles

- Mobile-first, one-thumb operation
- Fast entry, low friction, low typing
- Action-driven screens, not dense tables
- Explicit offline state and sync queue
- GPS confidence visible to the user
- Manual overrides allowed, but always audited
- Every visit ends with a clear outcome and next action

---

## Data Model

Add the following tables to `shared/schema.ts`.

## 1. `sales_reps`

Purpose: map app users to field sales identities.

Suggested fields:

- `id`
- `userId`
- `displayName`
- `email`
- `phone`
- `team`
- `role`
- `vcardId`
- `ghlUserId`
- `isActive`
- `createdAt`
- `updatedAt`

## 2. `sales_territories`

Purpose: assignment and routing.

Suggested fields:

- `id`
- `name`
- `description`
- `rulesJson`
- `isActive`
- `createdAt`
- `updatedAt`

## 3. `sales_accounts`

Purpose: the local master record for companies or target businesses.

Suggested fields:

- `id`
- `name`
- `legalName`
- `website`
- `phone`
- `email`
- `industry`
- `source`
- `status`
- `ownerRepId`
- `territoryId`
- `ghlContactId`
- `ghlCompanyId`
- `lastVisitAt`
- `nextVisitDueAt`
- `createdAt`
- `updatedAt`

## 4. `sales_account_locations`

Purpose: physical visit targets and geofence validation.

Suggested fields:

- `id`
- `accountId`
- `label`
- `addressLine1`
- `addressLine2`
- `city`
- `state`
- `postalCode`
- `country`
- `lat`
- `lng`
- `geofenceRadiusMeters`
- `isPrimary`
- `createdAt`
- `updatedAt`

## 5. `sales_account_contacts`

Purpose: people attached to accounts.

Suggested fields:

- `id`
- `accountId`
- `name`
- `jobTitle`
- `email`
- `phone`
- `isPrimary`
- `ghlContactId`
- `createdAt`
- `updatedAt`

## 6. `sales_visits`

Purpose: authoritative visit lifecycle.

Suggested fields:

- `id`
- `repId`
- `accountId`
- `locationId`
- `status`
- `scheduledAt`
- `checkedInAt`
- `checkedOutAt`
- `durationSeconds`
- `checkInLat`
- `checkInLng`
- `checkOutLat`
- `checkOutLng`
- `distanceFromTargetMeters`
- `gpsAccuracyMeters`
- `validationStatus`
- `manualOverrideReason`
- `source`
- `createdAt`
- `updatedAt`

Status examples:

- `planned`
- `in_progress`
- `completed`
- `cancelled`
- `invalid`

Validation examples:

- `valid`
- `outside_geofence`
- `gps_unavailable`
- `manual_override`

## 7. `sales_visit_notes`

Purpose: structured visit results.

Suggested fields:

- `id`
- `visitId`
- `summary`
- `outcome`
- `sentiment`
- `objections`
- `competitorMentioned`
- `nextStep`
- `followUpRequired`
- `createdByRepId`
- `createdAt`
- `updatedAt`

## 8. `sales_visit_attachments`

Purpose: proof of visit.

Suggested fields:

- `id`
- `visitId`
- `type`
- `fileUrl`
- `caption`
- `createdAt`

## 9. `sales_opportunities_local`

Purpose: local source of truth for field pipeline items.

Suggested fields:

- `id`
- `accountId`
- `repId`
- `visitId`
- `title`
- `pipelineKey`
- `stageKey`
- `value`
- `currency`
- `status`
- `closeDate`
- `lossReason`
- `notes`
- `ghlOpportunityId`
- `syncStatus`
- `createdAt`
- `updatedAt`

## 10. `sales_tasks`

Purpose: follow-up execution.

Suggested fields:

- `id`
- `accountId`
- `visitId`
- `opportunityId`
- `repId`
- `type`
- `title`
- `description`
- `dueAt`
- `status`
- `ghlTaskId`
- `createdAt`
- `updatedAt`

## 11. `sales_sync_events`

Purpose: observability and retries.

Suggested fields:

- `id`
- `provider`
- `entityType`
- `entityId`
- `direction`
- `status`
- `payload`
- `attemptCount`
- `lastError`
- `lastAttemptAt`
- `createdAt`

## 12. `sales_app_settings`

Purpose: module-specific configuration.

Suggested fields:

- `id`
- `checkInRequiresGps`
- `defaultGeofenceRadiusMeters`
- `allowManualOverride`
- `offlineQueueEnabled`
- `defaultPipelineKey`
- `defaultStageKey`
- `defaultTaskTemplate`
- `createdAt`
- `updatedAt`

---

## API Design

Create new routes under `/api/field/*`.

## Rep-facing routes

- `GET /api/field/me`
- `GET /api/field/dashboard`
- `GET /api/field/accounts`
- `POST /api/field/accounts`
- `GET /api/field/accounts/:id`
- `PATCH /api/field/accounts/:id`
- `GET /api/field/accounts/:id/contacts`
- `POST /api/field/accounts/:id/contacts`
- `GET /api/field/visits`
- `POST /api/field/visits/check-in`
- `POST /api/field/visits/:id/check-out`
- `PATCH /api/field/visits/:id/note`
- `POST /api/field/visits/:id/attachments`
- `GET /api/field/opportunities`
- `POST /api/field/opportunities`
- `PATCH /api/field/opportunities/:id`
- `GET /api/field/tasks`
- `POST /api/field/tasks`
- `PATCH /api/field/tasks/:id`
- `POST /api/field/sync/flush`

## Manager/admin routes

- `GET /api/field/admin/overview`
- `GET /api/field/admin/reps`
- `POST /api/field/admin/reps`
- `PATCH /api/field/admin/reps/:id`
- `GET /api/field/admin/accounts`
- `PATCH /api/field/admin/accounts/:id/assign`
- `GET /api/field/admin/visits`
- `PATCH /api/field/admin/visits/:id/review`
- `GET /api/field/admin/pipeline`
- `GET /api/field/admin/sync-events`
- `POST /api/field/admin/sync-events/:id/retry`
- `GET /api/field/admin/settings`
- `PUT /api/field/admin/settings`

## GHL integration routes

- `GET /api/field/admin/ghl/pipelines`
- `GET /api/field/admin/ghl/stages`
- `GET /api/field/admin/ghl/users`
- `GET /api/field/admin/ghl/custom-fields`
- `POST /api/field/admin/ghl/test-sync`
- `POST /api/field/webhooks/ghl`

---

## GoHighLevel Integration Design

## Phase 1 integration mode

Use the existing private integration token pattern already present in the app.

Existing settings already support:

- API key
- location ID
- calendar ID

This keeps the first release simple and aligned with the current admin panel.

## Phase 2 integration mode

Design the code so the provider can later support OAuth / Marketplace app installs.

Implementation rule:

- do not hardcode the field sales module directly to only one token model
- create a provider abstraction in `server/integrations/ghl.ts` or `server/services/ghl/*`

## Required GHL objects

- contacts
- custom fields
- opportunities
- pipelines and stages
- tasks if available for the chosen workflow
- appointments only if scheduling becomes part of visit planning
- webhooks for status reconciliation

## Sync rules

### Local-first model

The local database should be the operational source for the mobile app. GHL sync should be asynchronous where possible.

Why:

- better offline support
- better observability
- easier conflict handling
- less fragile field experience

### Sync triggers

- account created locally
- account contact created or updated
- visit completed
- opportunity created or stage changed
- task created or completed

### Sync statuses

- `pending`
- `synced`
- `failed`
- `needs_review`

### Retry policy

- immediate attempt on write
- scheduled retry on failure
- manual retry from admin sync dashboard

### Webhooks

Use GHL webhooks to reconcile:

- opportunity stage changes
- contact updates
- appointment changes
- deleted or merged records where applicable

---

## UI Deliverables

## Mobile app screens

### 1. Check-In

Features:

- account search
- recent accounts
- location validation card
- slide-to-check-in
- timer while active
- manual override with required reason

### 2. Accounts

Features:

- search and filters
- assigned accounts
- recently visited accounts
- create account
- account detail with contacts, history, open tasks, open opportunities

### 3. Visit Detail

Features:

- active timer
- meeting objective
- structured notes
- outcomes
- product/service interest
- next action
- check-out

### 4. Sales

Features:

- opportunity list
- stage filters
- value summary
- quick stage updates
- lost reason capture

### 5. Dashboard

Rep metrics:

- visits today
- active visit
- opportunities created
- overdue follow-ups
- weekly conversion

## Admin screens

### 1. Field Sales Overview

- visits today
- active reps
- checked-in reps
- overdue follow-ups
- new opportunities
- sync errors

### 2. Reps

- assign app access
- connect VCard
- assign territory
- active/inactive

### 3. Accounts

- assignment
- duplicate review
- import and bulk actions

### 4. Visits

- invalid visits
- manual overrides
- duration anomalies
- missing checkout review

### 5. Sync Health

- failures by entity type
- retry queue
- webhook log summaries

### 6. GHL Mapping

- pipeline selection
- stage mapping
- custom field mapping
- owner mapping

---

## Offline and PWA Requirements

This module must rely on the project's new PWA support.

## Required offline behavior

- app shell works offline
- queued check-ins are stored locally
- queued notes and updates can be retried
- user sees pending sync count
- conflict state is visible if the same record changed remotely

## Storage approach

Use IndexedDB or a thin client-side persistence layer for:

- pending visit actions
- pending note updates
- pending opportunity updates
- account search cache

## Service worker role

- app shell caching
- runtime caching for field screens
- support re-open in poor connectivity

Do not make the service worker responsible for business logic. Queue state should remain in app code.

---

## Security and Audit Requirements

- rep routes require authenticated user
- manager/admin routes require admin or elevated field role
- manual GPS override always requires reason
- all review actions must be timestamped and attributable
- sync payloads and errors must be inspectable by admins
- sensitive GHL credentials remain server-side only

---

## Reporting and KPIs

## Rep KPIs

- visits completed
- average visit duration
- valid check-in rate
- opportunities created
- pipeline value created
- follow-up completion rate

## Manager KPIs

- rep activity by day and week
- account coverage by territory
- conversion from visit to opportunity
- conversion from opportunity to won
- sync error rate
- accounts with no recent activity

---

## Implementation Phases

## Phase 0: Discovery and Contracts

Estimate: 2-3 days

Deliverables:

- confirm product naming
- confirm account-to-GHL object mapping
- confirm opportunity pipeline design
- confirm field-level permissions
- confirm English-only UI copy rules
- finalize schema and route contracts

## Phase 1: Foundation

Estimate: 4-6 days

Deliverables:

- new Drizzle tables
- storage methods in `server/storage.ts`
- Zod request/response contracts
- role model for reps
- seed defaults for module settings

## Phase 2: GHL Sync Foundation

Estimate: 4-6 days

Deliverables:

- pipeline and stage retrieval
- opportunity create/update helpers
- account/contact sync helpers
- sync event log
- admin sync diagnostics

## Phase 3: Mobile MVP

Estimate: 1-2 weeks

Deliverables:

- field mobile shell
- check-in flow
- accounts list/detail
- visit notes
- opportunity creation
- rep dashboard

## Phase 4: Manager Console

Estimate: 1 week

Deliverables:

- field sales admin section
- reps management
- visit review
- sync health dashboard
- account assignment

## Phase 5: Offline Reliability

Estimate: 4-6 days

Deliverables:

- client-side queue
- retry UX
- sync badge
- network recovery handling

## Phase 6: Hardening

Estimate: 1 week

Deliverables:

- webhook reconciliation
- duplicate handling
- analytics events
- performance review
- manual QA on Android and iPhone

---

## Recommended File Layout

## Frontend

- `client/src/pages/field/FieldApp.tsx`
- `client/src/pages/field/FieldCheckIn.tsx`
- `client/src/pages/field/FieldAccounts.tsx`
- `client/src/pages/field/FieldVisits.tsx`
- `client/src/pages/field/FieldSales.tsx`
- `client/src/pages/field/FieldDashboard.tsx`
- `client/src/components/field/*`
- `client/src/lib/field-sync.ts`
- `client/src/lib/field-offline.ts`

## Backend

- `server/services/field/accounts.ts`
- `server/services/field/visits.ts`
- `server/services/field/opportunities.ts`
- `server/services/field/tasks.ts`
- `server/services/field/sync.ts`
- `server/routes/field.ts` or equivalent route registration block
- `server/integrations/ghl.ts` expanded or split into focused service modules

## Shared

- `shared/schema.ts`
- `shared/field.ts`
- `shared/routes.ts`

---

## Decisions To Lock Before Coding

1. Whether `sales_accounts` map to GHL contacts only, businesses/companies, or a hybrid.
2. Whether reps can create opportunities immediately or only after completed visits.
3. Whether invalid GPS check-ins block the flow or allow manager-reviewed override.
4. Whether assignment uses territories, round robin, or manual ownership.
5. Whether we attach field sales to existing users only or allow invite-only rep accounts.

---

## Recommended Initial Build Order

To get the fastest usable version in production:

1. schema + storage
2. rep role + field shell
3. accounts list/detail
4. check-in/check-out
5. visit notes
6. local opportunities
7. GHL opportunity sync
8. manager dashboard
9. offline queue
10. webhook reconciliation

---

## Verification Checklist

- [ ] `npm run check` passes after each implementation phase
- [ ] `npm run build` passes after each implementation phase
- [ ] field routes are mobile-usable on real devices
- [ ] check-in works with valid GPS coordinates
- [ ] manual override creates an audit trail
- [ ] account creation syncs to GHL successfully
- [ ] opportunity creation syncs to GHL successfully
- [ ] failed syncs appear in admin
- [ ] rep dashboard metrics update from real data
- [ ] manager can review visit anomalies

---

## Success Criteria

The project is successful when:

- reps can complete a full visit flow from mobile without leaving the site
- managers can inspect field activity and sync health in one place
- GHL remains synchronized without blocking rep workflows
- the system is materially faster, clearer, and more reliable than the reference screenshots
- the product reuses the existing website, auth, admin, VCard, and lead infrastructure instead of duplicating it
