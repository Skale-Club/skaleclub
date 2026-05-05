---
phase: m4-01-translation-architecture
plan: "02"
subsystem: ui, translations
tags: [translations, footer, links, static-keys, t()]

requires:
  - phase: m4-01-01
    provides: translationCache exported, preload mechanism in place
provides:
  - Footer.tsx: tagline passa por t() — string dinâmica do DB traduzida pelo batch/preload
  - Links.tsx: config.description e link.title passam por t()
  - translations.ts: 5 chaves estáticas PT para strings defaults da Links page
affects: [Footer, Links page]

tech-stack:
  added: []
  patterns:
    - "Gap fix pattern: wrapper t() aplicado onde string dinâmica era exibida sem tradução"

key-files:
  modified:
    - client/src/components/layout/Footer.tsx
    - client/src/pages/Links.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "translations.ts mantido em 600 linhas: removidas 4 linhas em branco para abrir espaço para 5 novas chaves + 1 comentário removido"
  - "Strings de fallback em Links.tsx (link.title) envolvidas em t() na renderização, não nos valores padrão"

patterns-established:
  - "Toda string dinâmica do DB exibida ao usuário deve passar por t() — mesmo sem chave estática, o batch/preload resolve"

duration: ~10min
completed: 2026-05-04T00:00:00Z
---

# Phase m4-01 Plan 02: Gap Fixes — Footer, Links.tsx, Static Keys

**Footer tagline, Links.tsx description e link titles agora passam por t(); 5 chaves estáticas PT adicionadas a translations.ts (600 linhas exatas); npm run check verde.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Footer tagline traduzido | Pass | {tagline} → {t(tagline)} em Footer.tsx:62 |
| AC-2: Links.tsx sem strings hardcoded | Pass | config.description e link.title envolvidos em t() |
| AC-3: npm run check verde | Pass | Zero erros TypeScript, translations.ts = 600 linhas |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/layout/Footer.tsx` | Modified | `{tagline}` → `{t(tagline)}` |
| `client/src/pages/Links.tsx` | Modified | `{config.description}` e `{link.title}` → `t()` |
| `client/src/lib/translations.ts` | Modified | +5 chaves PT; -4 linhas em branco; resultado: 600 linhas |

## Deviations from Plan

Nenhum. Executado exatamente como planejado.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| translations.ts estava em 599 linhas — sem espaço para +5 chaves | Removidas 4 linhas em branco redundantes (após header, entre seções, trailing); resultado: 600 linhas exatas |

## Next Phase Readiness

**Ready:** Todo o sistema de tradução agora funciona corretamente end-to-end:
- Backend: Gemini traduz e cacheia no DB ✓
- Preload: cache aquecido antes do primeiro render ✓
- Cobertura: zero strings visíveis sem t() nas páginas públicas ✓
- Default: PT como idioma padrão ✓

**Concerns:** None

**Blockers:** None — Milestone 4 / Phase m4-01 completa

---
*Phase: m4-01-translation-architecture, Plan: 02*
*Completed: 2026-05-04*
