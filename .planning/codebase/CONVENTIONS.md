# Coding Conventions

**Analysis Date:** 2026-03-30

## Naming Patterns

### Files

**Components:**
- PascalCase with `.tsx` extension (e.g., `Home.tsx`, `Navbar.tsx`, `AdminSidebar.tsx`)
- Admin components use PascalCase with descriptive names (e.g., `XpotSalesSection.tsx`)

**Hooks:**
- PascalCase with `.ts` extension starting with `use` (e.g., `useAuth.ts`, `useTranslation.ts`)

**Utilities:**
- camelCase with `.ts` extension (e.g., `utils.ts`, `auth-utils.ts`, `queryClient.ts`)

**Types:**
- PascalCase with `.ts` extension (e.g., `types.ts`, `schema.ts`)

### Functions

**General:**
- camelCase (e.g., `fetchUser()`, `logout()`, `signIn()`)

**React Hooks:**
- camelCase prefixed with `use` (e.g., `useAuth()`, `useTranslation()`, `useAdminAuth()`)

**Components:**
- PascalCase (e.g., `function Home()`, `function LeadFormModal()`)

### Variables

- camelCase for standard variables (e.g., `isLoading`, `user`, `queryClient`)
- Boolean variables use `is`, `has`, or `should` prefixes (e.g., `isAdmin`, `hasError`, `shouldRedirect`)
- UPPERCASE for constants (e.g., `DEFAULT_HOMEPAGE_CONTENT`, `DEFAULT_CHAT_MODEL`)

### Types

- PascalCase for interfaces, types, and schemas (e.g., `User`, `AdminSession`, `AuthContextType`)
- Interface names use `Type` suffix for context types (e.g., `AuthContextType`)

## Code Style

### Formatting

**Indentation:**
- 2 spaces used throughout codebase

**Toolchain:**
- No explicit ESLint or Prettier configuration found
- Relies on editor defaults and `npm run check` for TypeScript validation
- Tailwind CSS for utility-first styling

### TypeScript Configuration

**File:** `tsconfig.json`

**Strictness:**
- `"strict": true` enabled - full type checking
- `"noEmit": true` - type-checks only without emitting files
- `"incremental": true` - incremental compilation enabled

**Module Resolution:**
- `"moduleResolution": "bundler"` - modern bundler-style resolution
- `"allowImportingTsExtensions": true"` - allows import extensions

**Path Aliases:**
```json
"@/*": ["./client/src/*"],
"@shared/*": ["./shared/*"]
```

**Types:**
- `"types": ["node", "vite/client"]`

### Import Convention

**Order (within files):**
1. React imports
2. Third-party library imports (e.g., wouter, @tanstack/react-query, lucide-react)
3. Path alias imports (e.g., `@/components/...`, `@/hooks/...`)
4. Shared imports (e.g., `@shared/schema`)
5. Local utility imports

**Path Aliases:**
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`

**Examples:**
```typescript
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Star, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AboutSection } from "@/components/AboutSection";
import type { CompanySettings, BlogPost } from "@shared/schema";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";
```

## Styling Approach

**Primary Framework:**
- Tailwind CSS v3.4.17 with Tailwind CSS Animate plugin
- `@tailwindcss/typography` plugin for prose content

**Component Library:**
- shadcn/ui pattern built on Radix UI primitives
- Custom components in `client/src/components/ui/`

**Utility Function:**
```typescript
import { cn } from "@/lib/utils";
// usage: cn("base-class", condition && "conditional-class")
```

**Custom Keyframes & Animations:**
- Defined in `tailwind.config.ts`
- Includes: `accordion-down`, `accordion-up`, `dot-pulse`, `fade-in`, `fade-out`, `form-shake`

**Color System:**
- HSL color variables defined in CSS
- Custom colors: `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`
- Status colors: `online`, `away`, `busy`, `offline`
- Sidebar-specific colors for admin interface

## Code Organization Patterns

### Directory Structure

```
client/src/
├── pages/           # Route-level screens (Home, Services, Admin, etc.)
├── components/      # Reusable UI components
│   ├── ui/          # shadcn/ui primitives
│   └── admin/       # Admin-specific components
├── hooks/           # Custom React hooks
├── context/         # React Context providers
└── lib/             # Utilities and services

server/
├── routes.ts        # API endpoints
├── storage.ts       # Database interface
├── db.ts            # Database connection
└── integrations/    # External service integrations

shared/
├── schema.ts        # Drizzle + Zod schemas
└── routes.ts        # API route types
```

### Component Patterns

**Functional Components:**
```typescript
export default function Home() {
  const { t } = useTranslation();
  // component logic
  return (
    <div>...</div>
  );
}
```

**Context Providers:**
```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(...);
  return (
    <AuthContext.Provider value={{ ... }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Hook Pattern:**
```typescript
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

## Error Handling Patterns

### Client-Side

**Hooks with TanStack Query:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['/api/data'],
  queryFn: () => fetch('/api/data').then(r => r.json()),
});
```
- Errors handled implicitly via TanStack Query error states
- No explicit error boundaries in code

**Fetch with Error Throwing:**
```typescript
const response = await fetch("/api/auth/user", {
  credentials: "include",
});
if (response.status === 401) {
  return null;
}
if (!response.ok) {
  throw new Error(`${response.status}: ${response.statusText}`);
}
return response.json();
```

### Server-Side

**Error Responses:**
```typescript
return res.status(401).json({ message: 'Authentication required' });
return res.status(403).json({ message: 'Admin access required' });
return res.status(500).json({ message: 'Failed to verify admin status' });
```

**Try-Catch Blocks:**
```typescript
try {
  const data = await fetchData();
  return res.json(data);
} catch (error) {
  return res.status(500).json({
    message: (error as Error).message,
  });
}
```

**Zod Validation:**
- Input validation using Zod schemas defined in `shared/schema.ts`
- Errors returned as structured JSON responses

## Function Design

### Size Guidelines

- Components can be large but should remain readable with proper section comments
- No strict function length limits, but complex logic is extracted to utility functions

### Parameters

- Explicit typing for all function parameters
- Destructuring used for cleaner code

### Return Values

- Always typed in TypeScript
- Explicit return type annotations for async functions (e.g., `Promise<User | null>`)

## Comments

### Inline Comments

- Minimal inline comments
- Used primarily for explaining non-obvious logic (e.g., hash navigation delay)
- Complex CSS gradients often have section comments

### Data Test IDs

- Used for testing selectors: `data-testid="button-hero-form"`
- Used consistently on interactive elements

### Documentation

- No JSDoc/TSDoc annotations found in codebase
- TypeScript types serve as documentation

---

*Convention analysis: 2026-03-30*