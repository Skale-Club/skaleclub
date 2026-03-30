# Code Quality Improvement Plan

## Overview
This document outlines the plan to improve code quality by addressing type safety issues, reducing technical debt, and improving maintainability.

## Issues Summary

| Category | Count | Severity |
|----------|-------|----------|
| `: any` type annotations | 51 | Medium |
| `as any` type casts | 9 | Medium-High |
| Console.log statements | 147 | Low |

---

## Phase 1: Eliminate `as any` Type Casts (High Priority)

### Task 1.1: Fix AuthContext.tsx
**File:** `client/src/context/AuthContext.tsx`
**Line:** 32

**Current Code:**
```typescript
const env = (import.meta as any).env?.VITE_CANONICAL_ORIGIN as string | undefined;
```

**Fixed Code:**
```typescript
const env = import.meta.env.VITE_CANONICAL_ORIGIN as string | undefined;
```

**Note:** Vite's `import.meta.env` is properly typed in `vite-env.d.ts`

---

### Task 1.2: Fix ServicesSection.tsx
**File:** `client/src/components/ServicesSection.tsx`
**Lines:** 158, 171

**Current Code:**
```typescript
const displayMode = explicitMode || (section as any)?.mode || 'steps';
const rawItems = (section as any)?.cards || (section as any)?.steps || [];
```

**Fixed Code:**
```typescript
// Define proper type for section
type ServicesSection = {
  mode?: 'steps' | 'cards';
  cards?: ServiceCard[];
  steps?: ServiceStep[];
};

const displayMode = explicitMode || (section as ServicesSection)?.mode || 'steps';
const rawItems = (section as ServicesSection)?.cards || (section as ServicesSection)?.steps || [];
```

---

### Task 1.3: Fix Footer.tsx
**File:** `client/src/components/layout/Footer.tsx`
**Lines:** 64-67

**Current Code:**
```typescript
{companySettings && (companySettings as any).socialLinks && Array.isArray((companySettings as any).socialLinks) && (companySettings as any).socialLinks.length > 0 && (
```

**Fixed Code:**
```typescript
// Add socialLinks to CompanySettingsData type in shared/types.ts
// Then use:
{companySettings?.socialLinks && Array.isArray(companySettings.socialLinks) && companySettings.socialLinks.length > 0 && (
```

---

### Task 1.4: Fix LeadsSection.tsx
**File:** `client/src/components/admin/LeadsSection.tsx`
**Lines:** 209, 420, 494

**Current Code:**
```typescript
const direct = (lead as any)?.[fieldId];
{formatDate((lead.updatedAt as any) || (lead.createdAt as any))}
```

**Fixed Code:**
```typescript
// Use type assertion with proper type
const direct = (lead as Record<string, unknown>)?.[fieldId];
{formatDate(String(lead.updatedAt || lead.createdAt))}
```

---

### Task 1.5: Fix DashboardSection.tsx
**File:** `client/src/components/admin/DashboardSection.tsx`
**Line:** 453

**Current Code:**
```typescript
onClick={() => onNavigate('website' as any)}
```

**Fixed Code:**
```typescript
// The AdminSection type is correct, 'website' is valid
onClick={() => onNavigate('website')}
```

**Note:** The error was about 'hero' not being in AdminSection. 'website' is valid.

---

### Task 1.6: Fix BlogSection.tsx
**File:** `client/src/components/admin/BlogSection.tsx`
**Line:** 346

**Current Code:**
```typescript
tags: (post as any).tags || '',
```

**Fixed Code:**
```typescript
// Either add tags to BlogPost type or use optional property
tags: (post as BlogPost & { tags?: string }).tags || '',
```

---

## Phase 2: Replace `: any` Annotations with Proper Types (Medium Priority)

### Task 2.1: Create Error Type Utility
**File:** `client/src/lib/error-utils.ts` (new file)

```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}
```

### Task 2.2: Update Error Handlers
Replace all `onError: (error: any)` with proper typed handlers:

**Before:**
```typescript
onError: (error: any) => {
  toast({ title: 'Error', description: error.message });
}
```

**After:**
```typescript
import { getErrorMessage } from '@/lib/error-utils';

onError: (error: unknown) => {
  toast({ title: 'Error', description: getErrorMessage(error) });
}
```

### Task 2.3: Type API Response Objects
**Files:** Multiple in `client/src/components/admin/`

For places like:
```typescript
const result: any = await response.json();
```

Replace with:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const result = await response.json() as ApiResponse<ExpectedDataType>;
```

---

## Phase 3: Clean Up Console Statements (Low Priority)

### Task 3.1: Create Logging Utility
**File:** `server/lib/logger.ts` (enhance existing)

```typescript
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  debug: (...args: unknown[]) => isDev && console.log('[DEBUG]', ...args),
};
```

### Task 3.2: Replace Console Calls in Production Code

**Files to update:**
- `server/routes.ts` - Replace debug logs with logger
- `server/integrations/ghl.ts` - Keep error logs, remove debug logs
- `server/integrations/twilio.ts` - Keep error logs

**Guidelines:**
- Keep `console.error` for error tracking (will be captured by logging infrastructure)
- Remove `console.log` debug statements or wrap in `if (isDev)`
- Keep console statements in scripts (they're meant to be verbose)

---

## Phase 4: Schema Type Improvements

### Task 4.1: Fix PortfolioService Features Type
**File:** `shared/schema.ts`

**Current Code:**
```typescript
features: jsonb("features").$type<string[]>().default([]),
```

**Issue:** The `$type<string[]>()` doesn't properly serialize/deserialize arrays

**Solution Option A:** Keep current but add runtime validation
```typescript
// In storage layer
function parseFeatures(features: unknown): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  if (typeof features === 'object') return Object.values(features);
  return [];
}
```

**Solution Option B:** Use a transform
```typescript
features: jsonb("features").$type<string[]>().default([]).transform({
  // Add transform logic if needed
}),
```

---

## Implementation Order

1. **Week 1:** Phase 1 (eliminate `as any`)
2. **Week 2:** Phase 2 (proper error types)
3. **Week 3:** Phase 3 (logging cleanup)
4. **Week 4:** Phase 4 (schema improvements)

## Verification

After each phase:
1. Run `npm run check` - no new errors
2. Run `npm run build` - successful build
3. Manual testing of affected features
4. Code review

## Metrics for Success

- [ ] Zero `as any` casts in client code
- [ ] Less than 10 `: any` annotations (down from 51)
- [ ] All console.log wrapped in dev checks or removed from production code
- [ ] TypeScript strict mode passes without errors
