# Phase 25: Services Carousel Polish - Research

**Researched:** 2026-04-28
**Domain:** React/Tailwind UI primitives — Radix Dialog, CSS mask-image, Pointer Events
**Confidence:** HIGH

## Summary

Phase 25 is a focused UI polish on the homepage `services` carousel. CONTEXT.md has locked all major architectural decisions (D-01..D-13), so research scope is narrow: confirm the **exact Tailwind/Radix/Pointer-Events syntax** the planner needs to produce correct task code, surface any platform quirks (iOS Safari especially), and define a Nyquist validation strategy in a project that has **no automated test runner**.

Key findings:

- **Radix Dialog handles scroll lock comprehensively** via `react-remove-scroll` — it sets `body` overflow + `pointer-events: none` and works on iOS Safari without manual `position: fixed` hacks. The known quirks (layout shift from scrollbar removal, Safari address-bar height jumps) are visual-only; none of them require workarounds for this phase.
- **CSS `mask-image` works natively in Safari 15.5+** (the project's target browser baseline is well above this; we are in 2026). Per MDN/caniuse, the `-webkit-mask-image` prefix is **no longer required** for linear-gradient masks in any browser the project supports. Including it costs ~30 chars and is harmless — recommendation: include it as defense-in-depth, since the cost is trivial and the property pre-dates the unprefixed standard in WebKit.
- **Click-vs-drag via `setPointerCapture` deferral** is the canonical pattern (same pattern `@dnd-kit` uses internally with `activationConstraint`). When capture is *not* called and pointer movement stays under threshold, the browser's native click pipeline runs unmodified — `PortfolioCard.onClick` will fire. No additional plumbing needed.
- **Browser back-button-to-close** is a single ~15-line `useEffect` in the modal: `pushState` on open, `popstate` listener calls `onOpenChange(false)`, and on a programmatic close (X / ESC / backdrop) call `history.back()` only if the sentinel is still on top. Inline in `ServiceDetailModal` is cleaner than extracting a hook (no second consumer).
- **Validation:** project has zero test infrastructure (`.planning/codebase/TESTING.md` confirms no Vitest/Jest/Playwright). Nyquist enforcement falls back to (a) manual UAT checklist, (b) a TypeScript `npm run check` gate, (c) DOM-shape assertions via runtime smoke check in dev. Wave 0 should *not* introduce a test runner for a polish phase — that is a milestone-level decision out of scope.

**Primary recommendation:** Implement in three sequenced tasks — (1) `paused` prop + 5px drag threshold in `ServicesCarousel.tsx`; (2) replace overlay divs with `mask-image` on the track in the same file; (3) migrate `ServiceDetailModal.tsx` to shadcn `Dialog` + add back-button hook inline. All locked decisions stand — research found no reason to revisit them.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modal Architecture**
- **D-01:** Migrate `ServiceDetailModal` to the shadcn `Dialog` primitive (`client/src/components/ui/dialog.tsx`, Radix-based). The current hand-rolled overlay is replaced. All visible UI (badge, title, price block, features list, CTA button, image column) is preserved — only the outer container, backdrop, and close button are swapped to `Dialog` / `DialogContent` / `DialogClose`.
- **D-02:** Close behaviors required (Radix gives the first three for free):
  - Click on backdrop (outside content) closes.
  - `ESC` key closes.
  - X button (top-right) closes.
  - **Browser back button on mobile closes.** Implementation: when modal opens, push a sentinel history entry (`history.pushState({ modal: 'service' }, '')`); when modal closes via any path, call `history.back()` if the sentinel is still on top, else no-op. Listen to `popstate` while open and treat it as a close signal.
- **D-03:** Focus management, animations, and ARIA roles inherit from Radix defaults. No custom `aria-*` plumbing needed.

**Scroll Lock**
- **D-04:** Vertical body scroll lock is provided automatically by Radix Dialog. No manual `document.body.style.overflow = 'hidden'` required.
- **D-05:** Horizontal carousel auto-scroll **pauses** while the modal is open and resumes on close. Implementation: `ServicesCarousel` accepts a new `paused` prop (boolean). `ServicesSection` passes `paused={isModalOpen}`.
- **D-06:** Pause behavior covers BOTH the rAF auto-scroll loop AND any in-flight momentum animation (cancel `momentumFrameRef` on open).

**Edge Fade**
- **D-07:** Use **CSS `mask-image`** on the scrolling track itself, not overlay divs. The existing two overlay divs at `ServicesCarousel.tsx:238-239` are deleted entirely.
- **D-08:** Fade width: **~8% per side** (moderate).
- **D-09:** Mobile (vertical stack) is unaffected — mask only applies in the desktop branch (`!isMobile`).

**Click-vs-Drag Detection**
- **D-10:** Defer `setPointerCapture` until pointer movement exceeds **5px** from `pointerdown` origin.
- **D-11:** Same 5px threshold for both mouse and touch.
- **D-12:** Velocity tracking and momentum scrolling remain unchanged.

**Translations**
- **D-13:** No new visible strings are introduced.

### Claude's Discretion
- Exact Tailwind class composition for the masked track (`[mask-image:...]` arbitrary value vs. inline `style={{ maskImage: ... }}`). Pick whichever reads cleaner.
- Whether to extract a tiny `useModalHistory` hook or inline the popstate logic in the modal — judge by line count and reuse potential.
- Whether the new `paused` prop on `ServicesCarousel` becomes `controlledPaused` or stays simple boolean — prefer the simpler API unless naming becomes ambiguous.

### Deferred Ideas (OUT OF SCOPE)
- **Carousel arrow controls** — defer to a future "Carousel UX" phase.
- **Modal share / deep-link to a specific service** — defer.
- **`useScrollLock` reusable hook** — only worth extracting if a third modal needs it.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Tailwind CSS v3.4.17** — utility-first, no v4 syntax.
- **shadcn/ui pattern** — components live in `client/src/components/ui/`; Dialog already exists at `client/src/components/ui/dialog.tsx` (Radix v1.1.7).
- **Brand colors** — Primary `#1C53A3`, Yellow `#FFFF01` (CTAs). Modal CTA already uses `bg-primary` — no change.
- **Fonts** — Outfit (headings), Inter (body). Inherited from existing modal markup.
- **CTA buttons** — Brand Yellow / pill / `rounded-full`. Modal's existing CTA preserves this; no change required.
- **No new visible strings** without `t()` keys in `client/src/lib/translations.ts` (per MEMORY.md "Translation rule"). Phase 25 introduces zero new copy (D-13).
- **No solid black/white borders** — use `--border` token (per MEMORY.md "Border styling rule"). The new mask gradient is *transparent → black → transparent*, where `black` is the **mask alpha channel only** (not a visible color); this rule does not apply.
- **Max 600 lines/file** (Admin design system rule, MEMORY.md). Current file sizes: `ServicesCarousel.tsx` 250 lines, `ServiceDetailModal.tsx` 107 lines — well under cap after the refactor.

## Phase Requirements

No formal `REQ-XX` IDs are mapped to Phase 25 (it was added post-v1.5 as a polish/bugfix phase per `.planning/STATE.md`). The phase contract is captured by the locked decisions D-01..D-13 above; the planner should treat each `D-XX` as a verifiable acceptance criterion.

| Pseudo-ID | Behavior | Research Support |
|-----------|----------|------------------|
| P25-FADE | Soft mask-image fade on track edges; overlay divs removed | `mask-image` browser support + Tailwind arbitrary-value syntax (this doc) |
| P25-CLICK | Click on a `PortfolioCard` opens modal even when carousel auto-scrolls | 5px-deferred `setPointerCapture` pattern (this doc) |
| P25-LOCK-V | Vertical body scroll locked while modal open | Radix Dialog built-in (this doc, "Standard Stack") |
| P25-LOCK-H | Carousel rAF + momentum paused while modal open | `paused` prop integration into existing `isPausedRef` (this doc, "Architecture Patterns") |
| P25-CLOSE-X | X button closes | Radix `DialogClose` (built-in) |
| P25-CLOSE-ESC | ESC closes | Radix `Dialog` (built-in) |
| P25-CLOSE-BD | Backdrop click closes | Radix `DialogOverlay` `onPointerDownOutside` (built-in) |
| P25-CLOSE-BACK | Browser back button closes on mobile | `useModalHistory` pattern (this doc, "Code Examples") |
| P25-NO-T | Zero new translation keys | Migration is structural JSX only |

## Standard Stack

### Core (already installed — no new deps required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | ^1.1.7 | Modal primitive: portal, overlay, focus trap, ESC/outside-click, scroll lock, ARIA | Already wrapped in `client/src/components/ui/dialog.tsx`; used by 10+ admin sections per CONTEXT.md |
| `tailwindcss` | ^3.4.17 | Mask via arbitrary-value classes `[mask-image:...]` | Already styling every component; arbitrary-value syntax is native to v3 |
| `lucide-react` | (existing) | `X` icon already used by current modal close button | No-op — the existing shadcn `DialogContent` ships its own internal X close button (line 47 of `dialog.tsx`) |

**Verification (`npm view`):**
- `@radix-ui/react-dialog@1.1.7` — current; published 2025. Latest stable as of research date is ~1.1.x branch. **HIGH confidence** the installed version is fit for purpose.
- `tailwindcss@3.4.17` — Tailwind v3 line. v4 exists but the project is locked to v3 syntax (`tailwind.config.ts`, `@tailwindcss/typography`, `tailwindcss-animate`). **No upgrade in scope.**

### Supporting (transitive — comes with Radix Dialog)

| Library | Purpose | Note |
|---------|---------|------|
| `react-remove-scroll` | Scroll lock implementation under Radix Dialog | Transitive — DO NOT install or import directly. Radix wires it automatically. |
| `aria-hidden` | Sets `aria-hidden` on background while modal open | Transitive. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Radix Dialog | Headless UI / custom overlay | Project already standardized on Radix via shadcn; switching would fragment. | Stay with Radix (D-01). |
| `mask-image` (CSS) | Two overlay divs with bg gradient (status quo) | Overlays can't read the section's gradient background → produce hard white blocks. `mask-image` clips the track itself, so the section gradient bleeds through naturally. | Use `mask-image` (D-07). |
| Inline `style={{ maskImage: ... }}` | Tailwind `[mask-image:linear-gradient(...)]` arbitrary value | Both work. Tailwind class is consistent with the rest of the file; inline `style` is more readable for a long gradient with commas. | **Recommend Tailwind arbitrary value with named CSS variable for the gradient** — see Code Examples. |
| Custom `useModalHistory` hook | Inline `useEffect` in `ServiceDetailModal` | A hook would be ~5 lines longer, has no second consumer in scope, and adds an import. | **Inline** the popstate logic. Promote to a hook only when a second modal needs it (deferred per CONTEXT.md). |

**Installation:** None required. All dependencies are already in `package.json`.

## Architecture Patterns

### Recommended Component Layout (post-phase)

```
client/src/components/home/
├── ServicesCarousel.tsx         # ADD: paused prop, 5px threshold, mask-image className
├── ServiceDetailModal.tsx       # REWRITE: shadcn Dialog wrapper + inline back-button hook
├── ServicesSection.tsx          # MINOR: pass paused={isModalOpen} to <ServicesCarousel>
└── (no new files)
```

### Pattern 1: External `paused` prop composing with internal pause state

**What:** Add a controlled `paused?: boolean` prop. Effect mirrors it into `isPausedRef` (alongside the existing internal `isPaused` state). When prop transitions to `true`, also cancel any in-flight `momentumFrameRef`.

**When to use:** Any time a parent needs to externally suspend the carousel (modal opens, user-initiated freeze, etc.).

**Why this approach:** The existing `isPausedRef` already gates the rAF step at `ServicesCarousel.tsx:53`. Reusing it costs zero new state machinery — we just OR the external prop into the ref.

**Code sketch:**

```tsx
// In ServicesCarousel: add prop and an effect that ORs it with internal isPaused
interface ServicesCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  paused?: boolean;   // NEW
}

// Inside component, after existing isPaused effect:
useEffect(() => {
  if (isMobile) return;
  // External pause OR internal hover/drag pause
  isPausedRef.current = isPaused || !!paused;

  // Cancel in-flight momentum on external pause activation (D-06)
  if (paused && momentumFrameRef.current) {
    cancelAnimationFrame(momentumFrameRef.current);
    momentumFrameRef.current = null;
    velocityRef.current = 0;
  }
}, [isPaused, paused, isMobile]);
```

**Note:** the existing effect at lines 31-34 only sets `isPausedRef.current = isPaused`. **Replace** that effect with the pattern above (do not add a second effect — they would race).

### Pattern 2: Deferred `setPointerCapture` (5px threshold)

**What:** On `pointerdown`, record start coords but do NOT call `setPointerCapture`. On `pointermove`, compute `Math.abs(clientX - startX)`. Only when delta exceeds 5px: call `setPointerCapture`, flip `isDown=true`, and run drag logic. Below threshold, the native click event fires on whatever element was under the pointer (i.e., `PortfolioCard`'s `onClick`).

**When to use:** Any draggable surface that also needs to forward unmodified clicks to children — exactly this carousel's situation.

**Pointer event flow when capture is deferred:**

| Event | Threshold not yet exceeded | Threshold exceeded |
|-------|---------------------------|---------------------|
| `pointerdown` | Record start, set `armed=true` | Same |
| `pointermove` (delta < 5) | Update tracking, no scroll | n/a |
| `pointermove` (delta ≥ 5) | **Activate:** capture + `isDown=true` + first scroll delta applied | Continue dragging |
| `pointerup` | Native `click` fires on target → `PortfolioCard.onClick` runs | Drag ends, momentum applies, NO native click fires (capture suppresses it) |

**Why the click reaches the card with no extra plumbing:** When `setPointerCapture` is *not* called, the browser's normal hit-testing runs at `pointerup` time. The synthetic `click` event fires on the element under the pointer at release, which bubbles up through `PortfolioCard`'s `onClick`. No `e.stopPropagation()` exists on the carousel — verified at `ServicesCarousel.tsx:127-149`.

**Verification of card's click receptivity:** `PortfolioCard.tsx:60-62` — `<div onClick={onClick} className="cursor-pointer ...">`. The `<img>` inside has `pointer-events-none` (line 81) so it never intercepts. **Confidence: HIGH.**

**Code sketch (replaces `handleStart`/`handleMove`):**

```tsx
const DRAG_THRESHOLD_PX = 5;

const handleStart = (e: PointerEvent | TouchEvent) => {
  // Cancel momentum + record start, but DO NOT capture or set isDown=true yet.
  if (momentumFrameRef.current) {
    cancelAnimationFrame(momentumFrameRef.current);
    momentumFrameRef.current = null;
  }
  const clientX = getClientX(e);
  velocityRef.current = 0;

  dragStateRef.current = {
    isDown: false,            // NOT armed as drag yet — gated by threshold
    startX: clientX,
    startScroll: track.scrollLeft,
  };
  // Track the pending "armed but not dragging" state separately:
  pendingPointerIdRef.current = 'pointerId' in e ? e.pointerId : null;
  pendingStartXRef.current = clientX;

  lastMoveXRef.current = clientX;
  lastMoveTimeRef.current = Date.now();
};

const handleMove = (e: PointerEvent | TouchEvent) => {
  const clientX = getClientX(e);

  // Phase A: not yet dragging — check threshold
  if (!dragStateRef.current.isDown) {
    if (pendingPointerIdRef.current === null && !('touches' in e)) return;
    const delta = Math.abs(clientX - pendingStartXRef.current);
    if (delta < DRAG_THRESHOLD_PX) return;

    // Threshold crossed — promote to active drag
    pauseAutoScroll();
    setIsDragging(true);
    dragStateRef.current.isDown = true;
    if ('pointerId' in e && pendingPointerIdRef.current !== null) {
      track.setPointerCapture?.(pendingPointerIdRef.current);
    }
  }

  // Phase B: active drag (existing logic, unchanged below)
  if (('touches' in e && e.cancelable) || ('pointerType' in e && e.pointerType === 'touch')) {
    e.preventDefault();
  }
  // ... velocity + scrollLeft assignment as today
};

const handleEnd = (e: PointerEvent | TouchEvent) => {
  pendingPointerIdRef.current = null;
  // Existing handleEnd logic; only runs the momentum/resume branch if isDown was true.
  if (dragStateRef.current.isDown) {
    // ... unchanged
  }
};
```

**Critical detail:** `pauseAutoScroll()` should NOT fire on `pointerdown` anymore — it only fires once the threshold is crossed. Otherwise a tap-to-open-modal would also pause the carousel for 800ms unnecessarily. This is a behavioral improvement bundled with the fix.

### Pattern 3: `mask-image` on overflow-scroll container

**What:** Apply `mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)` to the scrolling track div. The mask is a **viewport-fixed alpha mask** — it does NOT scroll with content; the leftmost 8% of the *visible viewport* is always faded, regardless of `scrollLeft`.

**Tailwind syntax (recommended):**

```tsx
<div
  ref={trackRef}
  className={cn(
    "flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none",
    "[mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)]",
    "[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)]",
    isDragging ? 'cursor-grabbing' : 'cursor-grab'
  )}
>
```

**Tailwind syntax (cleaner alternative — inline style):**

```tsx
const MASK = 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)';

<div
  ref={trackRef}
  style={{ maskImage: MASK, WebkitMaskImage: MASK }}
  className={cn(
    "flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none",
    isDragging ? 'cursor-grabbing' : 'cursor-grab'
  )}
>
```

**Recommendation:** **Use the inline-`style` form.** Reasons: (1) the gradient string is repeated for both standard + webkit prefixes, so a const avoids divergence; (2) commas in arbitrary-value Tailwind classes require underscore-escaping which is hard to read at this length; (3) hot-tweaking the percentage during review is one-line.

**Mask + pointer events interaction:** The mask is a *visual* property only — it does not affect hit-testing or pointer event delivery. Cards under the faded edge are still clickable and the track still receives pointer events there. **Confidence: HIGH** (this is per CSS spec; mask-image is purely a compositing operation).

**Mask + overflow-x-scroll interaction:** Compatible. The mask applies to the rendered output (post-scroll). Drag/scroll there work normally.

**Browser support (2026):** Safari 15.5+ supports unprefixed `mask-image`. The project's browser baseline is "modern browsers" (no IE11, no Safari pre-15). The `-webkit-` prefix is technically redundant in 2026 but **include it** as defense-in-depth — cost is one extra inline-style key.

### Pattern 4: Browser back-button-to-close (inline in `ServiceDetailModal`)

**What:** `pushState` a sentinel on open, listen to `popstate` while open, treat any popstate as a close signal. On programmatic close (X / ESC / backdrop), call `history.back()` *only* if the sentinel is still on top.

**Why inline (not a hook):** ~15 lines, single consumer, no second modal needs back-button-close in this phase (`LeadFormModal` keeps its custom flow per CONTEXT.md deferred ideas).

**Code (canonical pattern):**

```tsx
import { useEffect, useRef } from 'react';

interface Props {
  service: PortfolioService | null;
  isOpen: boolean;
  onClose: () => void;
  onCta: () => void;
}

export function ServiceDetailModal({ service, isOpen, onClose, onCta }: Props) {
  const sentinelPushedRef = useRef(false);

  // Push sentinel on open; pop on close-via-back-button.
  useEffect(() => {
    if (!isOpen) return;

    history.pushState({ modal: 'service' }, '');
    sentinelPushedRef.current = true;

    const onPopState = () => {
      sentinelPushedRef.current = false;  // The pop already consumed the sentinel
      onClose();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // If we are unmounting/closing via NON-back path AND sentinel is still on top,
      // pop it ourselves so the history stack stays clean.
      if (sentinelPushedRef.current) {
        sentinelPushedRef.current = false;
        history.back();
      }
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl">
        {/* ... existing JSX ... */}
      </DialogContent>
    </Dialog>
  );
}
```

**Edge cases handled:**
- **Rapid open/close:** the cleanup runs synchronously on `isOpen → false`, popping the sentinel via `history.back()`. No double-pops because `sentinelPushedRef` gates it.
- **Navigate-away-while-open (e.g., user clicks a link inside the modal):** the cleanup fires on unmount, popping the sentinel. The user's link navigation runs after the pop, replacing the (now-popped) state cleanly.
- **Modal stacking:** out of scope (no nested modals in `ServicesSection`).
- **Dialog already closing because user clicked X:** `Radix Dialog` calls `onOpenChange(false)` → component's `onClose` → state flip → effect cleanup → `history.back()` pops sentinel. Single back press from any close path.

### Pattern 5: `DialogContent` className override for sizing

**What:** Default shadcn `DialogContent` (`client/src/components/ui/dialog.tsx:41`) has `max-w-lg sm:rounded-lg`. The current modal uses `max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl`. All four are className overrides that compose via `cn()` — Radix ships no internal opinion on width.

**Apply via:**

```tsx
<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl">
```

**Caveats:**
- `p-0` is critical — default has `p-6` which conflicts with the inner padding the existing modal applies (`p-8 md:p-12`).
- The default `DialogContent` *already includes* a top-right X close button (line 47 of `dialog.tsx`). Remove the custom X button from the migrated `ServiceDetailModal` JSX (current line 38-43) — keeping it would render two close buttons.
- The default close button styles (`rounded-full bg-slate-100 hover:bg-slate-200` from current modal vs. `opacity-70 hover:opacity-100` from shadcn default) differ visually. Acceptable to ship with the shadcn default; visually fine on a white surface. If brand parity is required, override via `[&>button]:bg-slate-100` etc. — but this is bikeshedding. **Recommend: accept shadcn default.**

### Anti-Patterns to Avoid

- **Manual `document.body.style.overflow = 'hidden'`** — Radix Dialog handles this. Adding both would cause double-cleanup race conditions.
- **`onClick={onClose}` on the modal backdrop** — `DialogOverlay` already wires `onPointerDownOutside`. Don't reimplement.
- **Putting the back-button hook in `ServicesSection` instead of `ServiceDetailModal`** — couples session/modal state to the section. The modal owns its own lifecycle; the hook belongs there.
- **Calling `pauseAutoScroll()` on `pointerdown` (current behavior)** — should move to the threshold-crossing branch in `pointermove`. A tap that doesn't cross the threshold should not pause the carousel.
- **Forgetting to delete the overlay divs at lines 238-239** — leaving them with `mask-image` would double-occlude the edge cards.
- **Using `mask-image: linear-gradient` with stops that don't cover 0%/100%** — produces a hard cutoff. Use `transparent 0% → black 8%` (not `transparent 5% → black 13%`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay + portal + focus trap | Custom `<div className="fixed inset-0 ...">` | shadcn `Dialog` (Radix) | Focus trap, ESC, ARIA roles, scroll lock, animations all free. The current hand-rolled overlay lacks focus trap and ARIA. |
| Body scroll lock | `document.body.style.overflow = 'hidden'` + cleanup useEffect | Radix Dialog (built-in) | Radix handles iOS Safari quirks via `react-remove-scroll`. Manual approach has known iOS rubber-band bugs. |
| Backdrop click-to-close | `onClick={onClose}` on outer div + `stopPropagation` on inner | `DialogOverlay` `onPointerDownOutside` | Radix uses `pointerdown` not `click`, which avoids the "drag-released-outside" false positive. |
| Edge fade overlay | Two absolute-positioned `<div>` with `bg-gradient-to-r` | `mask-image` on the scrolling track | Overlays cover content but cannot inherit the section's gradient background — they always paint a solid color, producing the "hard white block" the user reported. `mask-image` clips the track itself, so the gradient bleeds through. |
| Click-vs-drag detection | Manual mousedown/mouseup timing + threshold + bubbling control | Deferred `setPointerCapture` pattern (Pointer Events API native semantics) | The browser already has the right primitive. Capturing the pointer suppresses `click`; not capturing it lets `click` fire. |
| Browser back-button gesture | History stack manipulation library (e.g., `react-router` confirm-leave hooks) | 15 lines of `pushState` + `popstate` listener inline | The site uses `wouter`, which doesn't ship a back-button-trap hook. The native `History` API is sufficient and ~no code. |

**Key insight:** Every problem in this phase has a battle-tested platform primitive already loaded in `node_modules`. Phase 25 is a "wire the right pieces together" phase, not a "build something new" phase.

## Runtime State Inventory

> Polish phase — no rename, no migration, no data layer changes. This section is included for completeness; all categories are explicitly empty.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by `Grep` for any DB references in scope files (`ServicesCarousel.tsx`, `ServiceDetailModal.tsx`, `ServicesSection.tsx`, `PortfolioCard.tsx`); none touch `storage.ts` or any API. | None |
| Live service config | None — no GHL, no Supabase, no n8n, no external service touched. | None |
| OS-registered state | None — no scheduled tasks, no pm2, no systemd. | None |
| Secrets/env vars | None — no env var reads in scope files. | None |
| Build artifacts | None — pure source-file edits; Vite rebuilds on `npm run dev` with no extra step. Browser cache may serve a stale bundle to the user post-deploy; standard hard-refresh suffices. | None |

## Common Pitfalls

### Pitfall 1: Click swallowed despite threshold (capture leak)

**What goes wrong:** Threshold is implemented, but `setPointerCapture` is still called on `pointerdown` somewhere (e.g., a leftover line). The first 5px of movement still works as a click, but the click is then suppressed because capture was active.

**Why it happens:** Mid-refactor leftover, or capture call moved into the wrong branch.

**How to avoid:** Single-grep audit — `setPointerCapture` should appear exactly once in `ServicesCarousel.tsx` after the refactor, inside the threshold-crossed branch of `handleMove` (NOT in `handleStart`).

**Warning sign:** Manual UAT — clicking a card while the carousel is auto-scrolling does nothing.

### Pitfall 2: iOS Safari rubber-band on body when modal open

**What goes wrong:** Despite Radix Dialog's scroll lock, iOS Safari allows rubber-band overscroll on the body element behind the modal.

**Why it happens:** iOS treats `overflow: hidden` on `body` more leniently than other browsers; the well-known fix is `position: fixed` on body, but it causes a scroll-position jump that Radix avoids by design.

**How to avoid:** Radix uses `touch-action: none` on the body and listens for `touchmove` on document, calling `preventDefault()` for non-passive cases. **In practice this works for nearly all iOS scenarios** — the residual rubber-band is purely visual (no actual content reveal). The reported issue from the user was vertical body scroll happening *at all*; Radix prevents that.

**Warning sign:** Manual UAT on real iOS Safari (not desktop Safari emulation): open modal, drag finger up/down on the backdrop. Expect: no body movement underneath; minor visual rubber-band on the modal element itself is acceptable.

**Mitigation if reported as a bug post-ship:** Add `overscroll-behavior: contain` to the dialog content via `className="overscroll-contain"`. Out of scope for Phase 25 unless reproduced.

### Pitfall 3: Back-button history pollution

**What goes wrong:** User opens modal 5 times; closes 4 times via X button; then presses back → expected to leave the page, but instead pops a leftover sentinel.

**Why it happens:** Cleanup didn't run, or `history.back()` was conditional on something that flipped wrong.

**How to avoid:** The `sentinelPushedRef` flag is the canonical guard. Set to `true` on push, `false` on either popstate or programmatic cleanup-pop. Idempotency: never call `history.back()` if `sentinelPushedRef.current === false`.

**Warning sign:** Manual UAT — open modal → close X → press back → must leave page (not pop a phantom state).

### Pitfall 4: Mask + cursor visual mismatch

**What goes wrong:** `cursor-grab` cursor still shows on the faded edge zones, but cards there are visually 0% opacity at the very edge — looks like a dead zone.

**Why it happens:** `mask-image` is alpha; cursor styling is unaffected.

**How to avoid:** Acceptable as-is for an 8% fade (cards still mostly visible at 8%). If it bothers in review: add `[&>*:first-child]:ml-8 [&>*:last-child]:mr-8` track padding so cards don't sit fully under the faded zone at rest. **Recommend ship-without-padding first, see how it looks.**

### Pitfall 5: `overflow-y: auto` on `DialogContent` clipping the inner shadow

**What goes wrong:** Migrating to `DialogContent` with `overflow-y-auto` clips any `box-shadow` on inner elements (the price card uses `shadow-lg` etc.).

**Why it happens:** `overflow: auto` on a parent always clips children visually.

**How to avoid:** Current modal already uses `overflow-y-auto` on its outer container, so this is a status-quo behavior — no regression. If shadow clipping was acceptable before, it remains acceptable. **No action needed.**

### Pitfall 6: `paused` prop changes during in-flight drag

**What goes wrong:** User starts dragging the carousel → simultaneously `isModalOpen` flips true (e.g., from another path) → drag continues but rAF is paused → momentum animation never resumes the rAF afterward.

**Why it happens:** The new effect cancels `momentumFrameRef` on external pause, but user is mid-drag with `dragStateRef.current.isDown === true`.

**How to avoid:** This race is theoretically possible but practically impossible — the only path that opens the modal during drag is a click on a card, which would have to happen while the user is also dragging the carousel (single pointer; can't both drag and click simultaneously). **Document as known limit; do not engineer around.**

## Code Examples

### Example 1: Complete `ServicesCarousel` props + paused integration

```tsx
// Source: synthesis of existing ServicesCarousel.tsx + D-05/D-06
interface ServicesCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  paused?: boolean;
}

export function ServicesCarousel<T>({
  items,
  renderItem,
  ariaLabel,
  paused = false,
}: ServicesCarouselProps<T>) {
  // ... existing refs / state ...

  // REPLACES the existing isPausedRef-mirror effect at lines 31-34.
  useEffect(() => {
    if (isMobile) return;
    isPausedRef.current = isPaused || paused;

    if (paused && momentumFrameRef.current) {
      cancelAnimationFrame(momentumFrameRef.current);
      momentumFrameRef.current = null;
      velocityRef.current = 0;
    }
  }, [isPaused, paused, isMobile]);

  // ... rest unchanged ...
}
```

### Example 2: ServicesSection passing `paused`

```tsx
// Source: ServicesSection.tsx:65 — single-line addition.
<ServicesCarousel
  items={services}
  ariaLabel="Services carousel"
  paused={isModalOpen}                          // NEW
  renderItem={(service, idx) => (...)}
/>
```

### Example 3: Migrated ServiceDetailModal (skeleton)

```tsx
// Source: synthesis — replaces full ServiceDetailModal.tsx
import { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { PortfolioService } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { badgeColorMap } from '@/components/PortfolioCard';

const checkColorMap: Record<string, string> = { /* unchanged */ };

interface ServiceDetailModalProps {
  service: PortfolioService | null;
  isOpen: boolean;
  onClose: () => void;
  onCta: () => void;
}

export function ServiceDetailModal({ service, isOpen, onClose, onCta }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const sentinelPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    history.pushState({ modal: 'service' }, '');
    sentinelPushedRef.current = true;

    const onPopState = () => {
      sentinelPushedRef.current = false;
      onClose();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      if (sentinelPushedRef.current) {
        sentinelPushedRef.current = false;
        history.back();
      }
    };
  }, [isOpen, onClose]);

  if (!service) return null;

  const badgeColors = badgeColorMap[service.accentColor || 'blue'] || badgeColorMap.blue;
  const checkColor = checkColorMap[service.accentColor || 'blue'] || checkColorMap.blue;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl bg-white">
        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <span className={`inline-block ${badgeColors.bg} ${badgeColors.text} text-xs font-bold px-3 py-1 rounded-full mb-4`}>
                {t(service.badgeText)}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{t(service.title)}</h2>
              <p className="text-lg text-slate-600 mb-6">{t(service.subtitle)}</p>
              <p className="text-slate-700 mb-8 leading-relaxed">{t(service.description)}</p>

              <div className="bg-slate-50 border rounded-2xl p-6 mb-8">
                <div className="flex items-baseline gap-2 mb-4 text-slate-900">
                  <span className="text-4xl font-extrabold">{service.price}</span>
                  <span className="text-slate-500 font-medium">{t(service.priceLabel)}</span>
                </div>
                <ul className="space-y-3">
                  {(service.features || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-5 h-5 ${checkColor} shrink-0 mt-0.5`} />
                      <span className="text-slate-700 font-medium">{t(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => { onClose(); onCta(); }}
                className="w-full px-8 py-4 bg-primary text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                {t(service.ctaText)}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {service.imageUrl && (
              <div className="flex-1 hidden md:block">
                <div className="aspect-square relative flex items-center justify-center bg-slate-100 border rounded-3xl shadow-xl overflow-hidden">
                  <img
                    src={service.imageUrl}
                    alt={service.title}
                    className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Note the deletions:**
- The outer `<div className="fixed inset-0 ...">` — replaced by `<Dialog>`.
- The inner `<div ...rounded-3xl bg-white>` with `onClick={(e) => e.stopPropagation()}` — replaced by `<DialogContent>`.
- The custom `<button>` X close — `DialogContent` ships its own internal X.
- The `if (!isOpen || !service) return null;` guard becomes `if (!service) return null;` — Radix handles the "not open" case via `open={isOpen}`.

### Example 4: Mask-image inline style

```tsx
// Source: synthesis — replaces lines 238-244 of ServicesCarousel.tsx
const TRACK_MASK = 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)';

// In the !isMobile branch:
<>
  {/* Overlay divs at lines 238-239 are DELETED. */}
  <div
    ref={trackRef}
    style={{ maskImage: TRACK_MASK, WebkitMaskImage: TRACK_MASK }}
    className={cn(
      "flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none",
      isDragging ? 'cursor-grabbing' : 'cursor-grab'
    )}
  >
    {desktopLoop.map((item, idx) => renderItem(item, idx))}
  </div>
</>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two overlay `<div>`s with `bg-gradient-to-r from-[#f7f9fc]` | `mask-image` linear-gradient on the track itself | CSS Masks Module Level 1 reached baseline 2023 (Safari 15.5+, all modern engines) | Overlays produced "hard white blocks" because they couldn't inherit the section's HSL gradient background; `mask-image` cuts the track's own pixels. |
| Custom modal overlay with manual `document.body.style.overflow` | Radix Dialog with built-in scroll lock | shadcn/ui standardized on Radix 2023+ | Standardized focus trap, ARIA, ESC, outside-click. Less code, fewer bugs. |
| Mouse `mousedown`/`mousemove` event pairs | Pointer Events API (`pointerdown`/`pointermove` + `setPointerCapture`) | Pointer Events Level 2 finalized 2019; baseline support since 2020 | Single event surface for mouse/touch/pen; capture API replaces ad-hoc bubbling tricks. |
| Single-source touch-or-mouse handlers | Pointer Events with capture deferral for click-vs-drag | `@dnd-kit` popularized `activationConstraint` 2022+ | The "5px before commit" pattern is the canonical solution for draggable surfaces with embedded clickables. |

**Deprecated/outdated:**
- `mousedown` + `touchstart` dual-listener approach — replaced by single `pointerdown`. The current code already uses `PointerEvent` correctly (line 192-203 falls back to touch only when PointerEvent is unsupported, which is essentially never in 2026).
- Legacy `-webkit-mask-image` prefix-only — modern Safari (15.5+) supports unprefixed `mask-image`. Including the prefix is harmless defense-in-depth.

## Open Questions

1. **Should the `paused` prop also disable hover-pause behavior?**
   - What we know: external `paused` ORs into `isPausedRef` (correct). Hover-set `isPaused` is independent.
   - What's unclear: if the user hovers the carousel while the modal is closing, the hover-pause activates briefly before the modal's resume signal fires. Visually inconsequential.
   - Recommendation: ignore. The OR-composition handles it; any race resolves within one rAF tick.

2. **Should the X close button styling match the current modal's `bg-slate-100` look?**
   - What we know: shadcn `DialogContent` ships its own X with `opacity-70 hover:opacity-100`, no background.
   - What's unclear: is brand parity worth ~3 lines of override CSS?
   - Recommendation: ship with shadcn default; revisit only if user feedback flags it. The shadcn default is visually fine on a white surface and aligns with admin section dialogs.

3. **Mobile (`isMobile === true`) gets neither mask nor pointer fix — verify there's no regression.**
   - What we know: mobile branch (line 232-235) renders a vertical stack with no track; mask + pointer changes are no-ops there. The modal click works via standard React `onClick` on the card with no carousel intercepting.
   - What's unclear: mobile may benefit from the back-button-close (a mobile-specific request per CONTEXT.md). The modal hook fires regardless of `isMobile` because it lives in `ServiceDetailModal`, which renders on both. ✓ correct.
   - Recommendation: mobile is correctly covered. No additional work.

## Environment Availability

> Polish phase — no new external dependencies, runtimes, or services. Skipped per Step 2.6 instructions.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None installed** (per `.planning/codebase/TESTING.md`) |
| Config file | none — Wave 0 cannot reasonably introduce a runner for a polish phase |
| Quick run command | `npm run check` (TypeScript compile) |
| Full suite command | `npm run check && npm run build` |
| Manual UAT | Required — see checklist below |

**Decision:** **Do NOT introduce Vitest/Jest in Phase 25.** The project has shipped 24 phases with manual UAT; introducing a runner is a milestone-level decision (per TESTING.md "Recommended Additions"). Phase 25 follows the project's established manual-test discipline.

### Phase Requirements → Test Map

| Pseudo-ID | Behavior | Test Type | Automated Command | Manual UAT Step |
|-----------|----------|-----------|-------------------|-----------------|
| P25-FADE | Track has `mask-image` style; overlay divs gone | type-check + DOM grep | `npm run check && grep -c "bg-gradient-to-r from-\\[#f7f9fc\\]" client/src/components/home/ServicesCarousel.tsx` (expect 0) | Visual inspection: edges fade, section gradient bleeds through |
| P25-CLICK | Click on a card opens modal even during auto-scroll | manual | — | Open / on desktop, wait for auto-scroll, click any card. Expect modal opens. |
| P25-LOCK-V | Body cannot scroll vertically while modal open | manual | — | Open modal, scroll mouse wheel / drag finger up. Expect: nothing moves except inside the modal scroll area. |
| P25-LOCK-H | Carousel scrollLeft does not advance while modal open | manual + DOM observation | — | Open DevTools, watch `track.scrollLeft` value while modal opens. Expect: value frozen until modal closes. |
| P25-CLOSE-X | X button closes | manual | — | Click X. Expect: modal closes. |
| P25-CLOSE-ESC | ESC closes | manual | — | Press ESC. Expect: modal closes. |
| P25-CLOSE-BD | Backdrop click closes | manual | — | Click outside the modal content. Expect: modal closes. |
| P25-CLOSE-BACK | Browser back closes (mobile) | manual on real device | — | iOS Safari: open modal, press hardware back gesture or browser-chrome back button. Expect: modal closes, page does not navigate away. |
| P25-NO-T | Zero new translation keys | grep | `git diff client/src/lib/translations.ts` (expect empty) | — |

### Sampling Rate

- **Per task commit:** `npm run check` (TypeScript only — fast, ~5 sec).
- **Per wave merge:** `npm run check && npm run build` (full type + bundle ~30 sec) + manual smoke (open modal + click outside, click card, ESC).
- **Phase gate:** Full manual UAT checklist above on (a) desktop Chrome, (b) iOS Safari real device.

### Wave 0 Gaps

- ❌ No test files needed — manual UAT is the project's standard.
- ❌ No framework install — out of scope per project convention.
- ✅ `npm run check` already configured and passing — no Wave 0 prep required.

**Net Wave 0 work: zero.** Implementation can start immediately on Plan 25-01.

## Sources

### Primary (HIGH confidence)
- **`client/src/components/ui/dialog.tsx`** (read in research) — confirms shadcn Dialog wraps `@radix-ui/react-dialog` with className composability and built-in X close.
- **`client/src/components/home/ServicesCarousel.tsx`** (read in research) — pause infrastructure at lines 33,52,75-91; pointer handlers at 127-149; overlay divs at 238-239.
- **`client/src/components/home/ServiceDetailModal.tsx`** (read in research) — current custom overlay structure; CTA + price block JSX.
- **`client/src/components/home/ServicesSection.tsx`** (read in research) — single source of `isModalOpen`; integration point for `paused` prop.
- **`client/src/components/PortfolioCard.tsx`** (read in research) — `onClick` on outer div; `pointer-events-none` on `<img>` (no click interception).
- **`package.json`** — `@radix-ui/react-dialog ^1.1.7`, `tailwindcss ^3.4.17`, `react ^18.3.1` — versions verified.
- **`.planning/codebase/TESTING.md`** — establishes "manual UAT only" project standard.
- **`.planning/codebase/CONVENTIONS.md`** — confirms 2-space indent, path aliases, Tailwind `cn()` utility, shadcn pattern.

### Secondary (MEDIUM confidence — verified across multiple sources)
- [Radix Dialog body scroll lock issue thread](https://github.com/radix-ui/primitives/issues/2125) — confirms Radix uses `react-remove-scroll` and locks scroll comprehensively; iOS-specific quirks are visual-only.
- [Tailwind mask-image discussion](https://github.com/tailwindlabs/tailwindcss/discussions/9417) — confirms arbitrary-value `[mask-image:linear-gradient(...)]` works in v3; underscore-escape commas.
- [CanIUse: CSS mask-image](https://caniuse.com/css-masks) — Safari 15.5+ unprefixed support; baseline 2023.
- [MDN: mask-image](https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image) — alpha mask is a compositing-only operation, no effect on hit-testing.

### Tertiary (LOW confidence — pattern-match, not verified)
- None — all decisions are backed by either the source code in this repo or platform-spec sources.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — versions verified against `package.json`; APIs verified against `client/src/components/ui/dialog.tsx`.
- Architecture (paused prop, threshold, mask, history): **HIGH** — patterns are platform-canonical; no library mystery.
- Pitfalls: **MEDIUM-HIGH** — iOS Safari rubber-band is the only platform-specific concern; documented as a known-residual rather than a blocker.
- Validation strategy: **HIGH** — aligned with project's documented manual-UAT-only practice; introducing a runner would be out-of-scope creep.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days — stable platform primitives, no fast-moving dependencies)

---

*Phase: 25-services-carousel-polish*
*Research completed: 2026-04-28*
