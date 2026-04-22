---
status: partial
phase: 20-public-viewer
source: [20-VERIFICATION.md]
started: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Route isolation — no Navbar/Footer/ChatWidget on /p/:slug
expected: Navigate to `/p/{any-slug}` in the browser. No site navigation bar, footer, or chat widget should be visible. The page should be a fully isolated fullscreen viewer.
result: [pending]

### 2. Scroll-snap and framer-motion animations
expected: Each slide fills the full viewport height. Scrolling snaps to the next slide. Each slide has a framer-motion entrance animation (slides in from below). All 8 layout variants render without blank or broken sections: cover, section-break, title-body, bullets, stats, two-column, image-focus, closing.
result: [pending]

### 3. Language switcher — bilingual field switching without scroll reset
expected: Appending `?lang=pt-BR` to the URL switches all slide text to Portuguese fields (headingPt, bodyPt, bulletsPt). Appending `?lang=en` (or no param) shows English. Switching does NOT reload the page or reset the scroll position.
result: [pending]

### 4. Access code gate flow
expected: For a presentation with an accessCode set, the viewer shows a code-entry form before any slides are visible. Entering the wrong code shows an inline error without navigating away. Entering the correct code reveals the slide deck.
result: [pending]

### 5. View count increment in admin
expected: After visiting `/p/{slug}` (with correct access code if gated), reload the admin Presentations list. The view count badge for that presentation should have incremented by 1.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
