# XpotContext Refactoring — Architecture Research

**Domain:** React Context decomposition for brownfield app
**Researched:** 2026-03-30
**Overall confidence:** HIGH

## Executive Summary

The current `XpotContext.tsx` (729 lines) is a single monolithic React Context that mixes 6 distinct domain concerns: auth, navigation, check-in, accounts, sales, and shared utilities. It provides 7+ TanStack Query results, 6+ mutations, and 15+ pieces of local state to 5 consumer components.

**The recommended approach is Domain-Scoped Custom Hooks + Composition — NOT Zustand.** Here's why:

1. TanStack Query already manages all server state (queries + cache). Adding Zustand for server state would be redundant.
2. Local UI state (form inputs, dropdowns, recording) is tab-scoped and doesn't cross context boundaries frequently.
3. The consumers are cleanly partitioned by tab — each consumer uses a predictable subset of the context.
4. React 18 + Context splitting is sufficient. No external state library needed for this use case.

The migration can be done incrementally without breaking any consumer by keeping a facade `useXpotApp()` hook during the transition.

## Current Architecture Analysis

### Consumer Usage Map

| Component | What it uses from context |
|-----------|--------------------------|
| `XpotCheckIn` | Check-in state, active visit, visit notes, audio recording, geo, accountsQuery, check-in mutations |
| `XpotAccounts` | Accounts tab state, account form, place search, geo, createAccountMutation, cross-tab navigation |
| `XpotSales` | AccountsQuery, opportunities/tasks queries, forms, create/update mutations |
| `XpotVisits` | `visitsQuery` only (manages its own audio recording locally) |
| `XpotDashboard` | `dashboardQuery` only |

### Dependency Graph

```
XpotAppContext (729 lines, 40+ fields)
├── Auth concern: xpotMeQuery, me, repName, signOut, syncMutation
├── Navigation concern: activeTab, pathname, setLocation
├── Online status: isOnline
├── Active visit: activeVisit, activeVisitStable (derived from queries)
├── Geo concern: geoState, loadCurrentLocation
├── Check-in tab: selectedAccountId, search, dropdown, filteredAccounts, placeQuery, 3 mutations
├── Accounts tab: search, form, place, filteredAccounts, placeQuery, createAccountMutation
├── Sales tab: opportunityForm, taskForm, 2 queries, 2 mutations, updateTaskStatus
├── Visits tab: visitsQuery
├── Dashboard tab: dashboardQuery
└── Audio recording: recording state, MediaRecorder, uploadAudioMutation
```

### Key Observation

Every consumer destructures a **predictable, non-overlapping subset** of the context. There is no component that needs random cross-cutting slices. This makes decomposition safe and clean.

## Recommended Pattern: Domain-Scoped Hooks + Composition

### Architecture

```
client/src/pages/xpot/
├── context/
│   ├── XpotProviders.tsx          ← Composes all providers, single entry point
│   ├── XpotFacade.tsx             ← Backward-compatible useXpotApp() hook
│   └── types.ts                   ← Shared types for context values
├── hooks/
│   ├── useXpotAuth.ts             ← Auth query, signOut, syncMutation, repName
│   ├── useXpotNavigation.ts      ← activeTab, pathname, setLocation
│   ├── useXpotOnline.ts          ← isOnline
│   ├── useXpotGeo.ts             ← geoState, loadCurrentLocation
│   ├── useXpotQueries.ts         ← All TanStack Query hooks (accounts, visits, etc.)
│   ├── useXpotActiveVisit.ts     ← activeVisit derived from queries
│   └── useXpotInvalidate.ts      ← invalidateXpotData helper
├── features/
│   ├── check-in/
│   │   ├── useCheckInState.ts    ← Form state: search, dropdown, selectedAccountId
│   │   ├── useCheckInMutations.ts ← checkIn, cancelVisit, checkOut mutations
│   │   └── useCheckInActions.ts  ← pickLocalAccount, pickGooglePlace, createNewCompany
│   ├── accounts/
│   │   ├── useAccountsState.ts   ← Lookup search, form, selectedPlace
│   │   └── useAccountsActions.ts ← applyPlaceToForm, createAccountFromForm
│   ├── sales/
│   │   ├── useSalesState.ts      ← Opportunity/task forms
│   │   └── useSalesMutations.ts  ← create/update mutations
│   └── visits/
│       └── useVisitNotes.ts      ← visitNoteForm, audio recording, save/upload mutations
├── XpotCheckIn.tsx
├── XpotAccounts.tsx
├── XpotSales.tsx
├── XpotVisits.tsx
├── XpotDashboard.tsx
└── usePlaceSearch.ts             ← Already extracted, keep as-is
```

### Why NOT Zustand

| Factor | Context + Hooks | Zustand |
|--------|----------------|---------|
| Server state | Already handled by TanStack Query | Would duplicate query layer |
| Local UI state | useState in feature hooks is simpler | Overkill for form inputs |
| Selective subscriptions | Not needed (consumers are tab-scoped) | N/A |
| Bundle size | 0 KB added | ~2 KB added |
| Learning curve | Zero — team already uses hooks | New dependency to learn |
| Migration cost | Pure refactor, no new deps | Requires store architecture decisions |

**Zustand is the right call if:** you have cross-tab state that updates at 60fps (real-time cursors, drag state), or if you need selector-based subscriptions to prevent re-renders in a shared component tree. This app doesn't have either.

### When to Consider Zustand Later

If the app evolves to need:
- Real-time collaborative features (WebSocket-driven state)
- Shared state across the *entire* app (not just the xpot section)
- Complex state machines with middleware (persist, devtools, immer)
- Selector-based performance optimization on deeply nested shared components

## Detailed Implementation Plan

### Step 1: Extract Query Hooks (Zero Breaking Changes)

Create `hooks/useXpotQueries.ts`:

```typescript
// hooks/useXpotQueries.ts
import { useQuery } from "@tanstack/react-query";
import type { DashboardResponse, SalesAccount, SalesVisit, SalesOpportunity, SalesTask, XpotMeResponse } from "../types";

export function useXpotMeQuery() {
  return useQuery<XpotMeResponse>({
    queryKey: ["/api/xpot/me"],
    retry: false,
    refetchOnMount: true,
  });
}

export function useXpotAccountsQuery(enabled: boolean) {
  return useQuery<SalesAccount[]>({
    queryKey: ["/api/xpot/accounts"],
    enabled,
  });
}

// ... same pattern for all queries
```

**Why first:** Queries are the backbone. Every other hook depends on query data. Extracting them first creates a clean import graph.

### Step 2: Extract Feature Hooks

Each feature hook encapsulates its form state, mutations, and actions:

```typescript
// features/check-in/useCheckInState.ts
import { useState, useMemo, useCallback } from "react";
// ... extracted from XpotContext lines 140-248
```

```typescript
// features/check-in/useCheckInMutations.ts
import { useMutation } from "@tanstack/react-query";
import { useXpotInvalidate } from "../../hooks/useXpotInvalidate";
// ... extracted from XpotContext lines 296-347
```

**Key principle:** Each hook takes its dependencies as parameters (query data, geo state), not from context. This makes them testable in isolation.

### Step 3: Create the Facade Hook (Backward Compatibility)

```typescript
// context/XpotFacade.tsx
import { useXpotAuth } from "../hooks/useXpotAuth";
import { useXpotNavigation } from "../hooks/useXpotNavigation";
import { useCheckInState } from "../features/check-in/useCheckInState";
// ... all imports

export function useXpotApp(): XpotAppContextValue {
  const auth = useXpotAuth();
  const nav = useXpotNavigation();
  const queries = useXpotQueries();
  const checkIn = useCheckInState(queries.accountsQuery.data);
  // ... compose all hooks

  return {
    ...auth,
    ...nav,
    ...queries,
    ...checkIn,
    // ... spread all
  };
}
```

**This is critical.** Existing consumers keep working with `useXpotApp()` unchanged. You can refactor the *internals* without touching any consumer.

### Step 4: Migrate Consumers One at a Time

Replace `useXpotApp()` with specific hooks in each consumer:

**Before (XpotDashboard.tsx):**
```typescript
const { dashboardQuery } = useXpotApp();
```

**After (XpotDashboard.tsx):**
```typescript
import { useXpotDashboardQuery } from "../hooks/useXpotQueries";
const dashboardQuery = useXpotDashboardQuery();
```

Migrate in this order (fewest dependencies first):
1. `XpotDashboard.tsx` — uses only `dashboardQuery`
2. `XpotVisits.tsx` — uses only `visitsQuery`
3. `XpotSales.tsx` — uses queries + forms + mutations
4. `XpotAccounts.tsx` — uses queries + forms + actions + geo
5. `XpotCheckIn.tsx` — uses the most (check-in state + active visit + notes + audio + geo)

### Step 5: Remove the Facade

After all consumers are migrated:
1. Delete `XpotContext.tsx`
2. Delete `context/XpotFacade.tsx`
3. Delete `context/types.ts` (move to shared types if needed)

## Incremental Migration Without Breaking Anything

```
Phase A: Extract hooks, keep facade     → 0 consumer changes, 0 risk
Phase B: Migrate XpotDashboard          → 1 consumer, trivial change
Phase C: Migrate XpotVisits             → 1 consumer, trivial change
Phase D: Migrate XpotSales              → 1 consumer, moderate change
Phase E: Migrate XpotAccounts           → 1 consumer, moderate change
Phase F: Migrate XpotCheckIn            → 1 consumer, largest change
Phase G: Remove facade                  → cleanup, delete dead code
```

Each phase is independently deployable and testable. No "big bang" needed.

## How Mutations and Queries Should Be Organized

### Queries: Centralized in `hooks/useXpotQueries.ts`

All TanStack Query hooks in one file. Reasons:
- Query keys are visible in one place (easy to audit for invalidation)
- `enabled` dependencies (like `xpotMeQuery.isSuccess`) are explicit
- Derived state (`activeVisit`) lives next to the queries it derives from

### Mutations: Co-located with Feature Hooks

Each feature owns its mutations:
- `features/check-in/useCheckInMutations.ts` → checkIn, checkOut, cancelVisit
- `features/accounts/useAccountsMutations.ts` → createAccount
- `features/sales/useSalesMutations.ts` → createOpportunity, createTask, updateTaskStatus
- `features/visits/useVisitNotes.ts` → saveNote, uploadAudio

**Pattern for each mutation hook:**

```typescript
export function useCheckInMutation() {
  const { toast } = useToast();
  const invalidateXpotData = useXpotInvalidate();

  return useMutation({
    mutationFn: async (input: { accountId: number; lat?: number; lng?: number }) => {
      const response = await apiRequest("POST", "/api/xpot/visits/check-in", input);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Checked in successfully" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });
}
```

### The `invalidateXpotData` Problem

Currently `invalidateXpotData` is defined inline in the provider and passed through context. In the new architecture, it becomes a standalone hook:

```typescript
// hooks/useXpotInvalidate.ts
import { queryClient } from "@/lib/queryClient";

export function useXpotInvalidate() {
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/admin/overview"] }),
    ]);
  };
}
```

**Even better:** Granular invalidation per mutation. Only invalidate the queries that mutation affects. This is an optimization to do *after* the refactor, not during.

## Potential Pitfalls

### Pitfall 1: Circular Dependencies Between Hooks

**What goes wrong:** `useCheckInState` needs `accountsQuery.data`, but `useCheckInMutations` needs `activeVisit` which comes from `useXpotActiveVisit` which needs `visitsQuery`.

**Why it happens:** Extracted hooks try to import each other.

**Prevention:** Pass query data as parameters, not from context. Each hook is a pure function of its inputs.

### Pitfall 2: The `checkingInRef` Race Condition

**What goes wrong:** `checkingInRef` in the current code prevents `activeVisit` from flickering to null during check-in. If the ref lives in the wrong hook, this breaks.

**Prevention:** Keep `checkingInRef` in `useXpotActiveVisit.ts` which owns the derived `activeVisitStable` logic.

### Pitfall 3: Audio Recording State Mismatch

**What goes wrong:** The current context shares recording state between the active visit (CheckIn tab) and past visits (Visits tab). But `XpotVisits.tsx` actually manages its own recording state independently.

**Prevention:** Keep audio recording in the `useVisitNotes` feature hook only. The `XpotVisits` component's local audio recording state stays local (it already is).

### Pitfall 4: Over-Extraction

**What goes wrong:** Creating 20 tiny hooks for every useState. The context was too big, but 20 files is too fragmented.

**Prevention:** One hook per meaningful concern, not per useState. The `useCheckInState` hook bundles 4 useState calls + useMemo + useCallback into one cohesive unit.

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| Pattern recommendation | HIGH | Based on actual consumer usage analysis + 2026 community consensus |
| Migration safety | HIGH | Facade pattern is proven for brownfield refactors |
| Not needing Zustand | HIGH | TanStack Query handles server state; local state is tab-scoped |
| Hook extraction boundaries | HIGH | Consumer usage map shows clean non-overlapping subsets |
| Mutation organization | MEDIUM | Optimal invalidation strategy depends on query dependency graph |

## Sources

- Context splitting patterns: OneUptime blog (Jan 2026), Feature-Sliced Design (Jan 2026)
- Context vs Zustand decision: RajeshRNair comparison (Mar 2026), OneUptime guide (Jan 2026)
- Codebase analysis: `XpotContext.tsx` (729 lines), 5 consumer components
- Consumer usage patterns: grep of `useXpotApp()` destructuring across all consumers
