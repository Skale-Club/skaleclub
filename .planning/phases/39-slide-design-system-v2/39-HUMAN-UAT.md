---
status: partial
phase: 39-slide-design-system-v2
source: [39-VERIFICATION.md]
started: 2026-05-15T00:00:00.000Z
updated: 2026-05-15T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. New layout — image-left renders split view
expected: Slide with `layout:"image-left"` and `style.bgImageUrl` set shows image panel on left (~40%) and text on right (~60%)
result: [pending]

### 2. New layout — image-right renders split view
expected: Slide with `layout:"image-right"` and `style.bgImageUrl` set shows text on left (~60%) and image panel on right (~40%)
result: [pending]

### 3. New layout — full-bleed-image covers full slide
expected: Slide with `layout:"full-bleed-image"` and `style.bgImageUrl` set shows full-screen background image with dark scrim and centered text overlay
result: [pending]

### 4. New layout — quote shows large pull-quote with attribution
expected: Slide with `layout:"quote"`, heading, and attribution shows large quoted text with attribution below
result: [pending]

### 5. bgColor overrides default zinc-950 background
expected: Slide with `style.bgColor:"#1a1a2e"` shows that custom background color instead of the default dark zinc
result: [pending]

### 6. bgVideoUrl plays muted looped video
expected: Slide with `style.bgVideoUrl` set to a public video URL shows autoplay muted loop video as background
result: [pending]

### 7. Backward compatibility — pre-Phase 39 slides render unchanged
expected: Existing presentations created before Phase 39 (with no style field) still render all 8 original layouts correctly without modification
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
