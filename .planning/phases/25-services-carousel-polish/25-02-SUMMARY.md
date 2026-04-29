# Plan 25-02 Summary

**Status:** Complete
**Date:** 2026-04-29
**Commit:** `1423e5e`

## What changed

- `client/src/components/home/ServiceDetailModal.tsx` — full rewrite of the component body.
- `client/src/components/home/ServicesSection.tsx` — single-prop addition.

### Tasks delivered

1. **shadcn Dialog migration** — replaced the hand-rolled `fixed inset-0 z-50 ... bg-black/60 backdrop-blur-sm` overlay with `<Dialog open={isOpen} onOpenChange={...}><DialogContent>...</DialogContent></Dialog>`. The DialogContent class is `w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-0 border-0 [&>button]:hidden` — `p-0` cancels Radix's default `p-6`, `border-0` strips its default border, `[&>button]:hidden` hides Radix's default X so the existing slate-100 X is the only close affordance shown.
2. **Browser back button → close** — `useEffect` pushes `{ __serviceModal: true }` history sentinel on open, listens for `popstate` to call `onClose`. Cleanup pops the sentinel if the modal closed for any other reason (ESC, X, backdrop) so the history stack stays clean.
3. **Carousel pause on modal open** — `ServicesSection` passes `paused={isModalOpen}` to the services-mode `ServicesCarousel`. Steps-mode carousel left untouched (no modal there).

## Free wins from Radix Dialog

- Body scroll lock (vertical) — automatic
- ESC-to-close — automatic
- Click-on-backdrop closes — automatic
- Focus trap + return-focus on close — automatic
- ARIA dialog/modal roles + `aria-labelledby` plumbing — automatic
- Open/close animations — automatic

## Verification

- `npm run check` exits 0
- `grep -c "from '@/components/ui/dialog'" ServiceDetailModal.tsx` → 1
- `grep -c "history.pushState" ServiceDetailModal.tsx` → 1
- `grep -c "popstate" ServiceDetailModal.tsx` → 2 (addEventListener + removeEventListener)
- `grep -c "[&>button]:hidden" ServiceDetailModal.tsx` → 1
- `grep -c "paused={isModalOpen}" ServicesSection.tsx` → 1
- `grep -c "fixed inset-0 z-50 flex items-center justify-center" ServiceDetailModal.tsx` → 0 (old wrapper deleted)
- All 6 `t(service.X)` calls preserved

## Manual UAT pending

Run `npm run dev`, open `/`:
- Click a service card → modal opens (combined verification of Plan 25-01 click-threshold + Plan 25-02 wiring)
- Vertical scroll attempts on body → blocked
- Carousel auto-scroll behind backdrop → frozen
- ESC / backdrop click / X button / browser back → all close
- Reopen and verify focus returns to the triggering card after close
