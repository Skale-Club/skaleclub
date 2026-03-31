# Xpot App Redesign Plan

## 1. Objective
Redesign the Xpot application (Login + Main App Shell + Dashboard/Tabs) to transition from its current fragmented aesthetic to a **unified, cohesive Dark Theme** with a **Minimalist & Professional** design. The goal is to clean up excessive custom Tailwind classes (raw hex colors, hardcoded borders, random opacities) and leverage standard `shadcn/ui` CSS variables for a maintainable, modern, and sleek user interface.

## 2. Global Strategy
*   **Theming**: 
    *   Enforce a global dark theme context.
    *   Drop hardcoded colors like `bg-[#06090f]`, `border-white/10`, `bg-white/5`.
    *   Adopt standard shadcn variables: `bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`.
*   **Layout & Spacing**:
    *   Increase whitespace to let elements "breathe".
    *   Simplify borders and shadows. Rely on subtle boundaries (`border-border` with standard `rounded-xl` or `rounded-2xl` radii).
*   **Typography**:
    *   Ensure distinct hierarchy between headers, primary text, and secondary/muted text.

## 3. Component-Specific Changes

### 3.1. Login Page (`XpotLogin.tsx`)
*   **Current State**: Light theme (`bg-slate-100`), starkly contrasting the main app.
*   **Redesign**:
    *   Transition to Dark Theme (`bg-background`).
    *   Simplify the card: use `bg-card`, `border-border`.
    *   Update inputs to standard shadcn inputs without heavy slate overrides.
    *   Ensure buttons use standard `primary` and `outline` variants suitable for dark mode.

### 3.2. App Shell (`XpotApp.tsx`)
*   **Current State**: Hardcoded `#06090f` background, complex gradients, hardcoded bottom nav.
*   **Redesign**:
    *   Use `bg-background text-foreground` for the root wrapper.
    *   **Header**: Clean up the status display. Make it elegant with standard muted text for roles.
    *   **Active Status Card**: Replace the custom gradient (`from-primary/15 to-cyan-500/10`) with a cleaner, subtle `bg-primary/10` or `bg-card` with an accented border.
    *   **Bottom Nav**: Use `bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border`. Simplify active state styling to just use `text-primary` without complex background tints.

### 3.3. Dashboard (`XpotDashboard.tsx`)
*   **Current State**: Custom `border-white/10 bg-white/5` cards.
*   **Redesign**:
    *   Standardize using shadcn's `<Card>` defaults.
    *   For metric cards: standard `Card` with `p-4`, utilizing `text-muted-foreground` for labels and `text-2xl font-bold text-foreground` for values.
    *   Recent Visits list: Use cleaner separators instead of full bordered boxes, or extremely subtle secondary backgrounds (`bg-secondary/50`).

### 3.4. Accounts & Other Views (`XpotAccounts.tsx`, etc.)
*   **Current State**: Heavy use of `border-white/10`, `bg-white/5`, `bg-black/20`.
*   **Redesign**:
    *   Replace `bg-white/5` with `bg-card`.
    *   Replace `bg-black/20` with `bg-secondary` or `bg-muted/50`.
    *   Inputs: Standard `bg-background` or `bg-muted/30` with `border-border`.
    *   Buttons: Standard `variant="outline"` or `variant="default"`.

## 4. Implementation Steps
1.  **Refactor `XpotLogin.tsx`**: Apply dark mode structure.
2.  **Refactor `XpotApp.tsx`**: Update root layouts, header, status card, and bottom navigation.
3.  **Refactor `XpotDashboard.tsx`**: Standardize metric cards and recent items.
4.  **Refactor Sub-views** (`XpotAccounts.tsx`, `XpotCheckIn.tsx`, `XpotSales.tsx`, `XpotVisits.tsx`): Strip out hardcoded opacity borders and backgrounds in favor of semantic UI tokens.

Please review this plan. If you approve, I will proceed to execute the redesign.