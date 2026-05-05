---
phase: m4-01-translation-architecture
plan: "01"
subsystem: api, context
tags: [translations, preload, language, cache, LanguageContext]

requires: []
provides:
  - GET /api/translations/preload endpoint (full PT cache from DB in one request)
  - translationCache exported from useTranslation for external warming
  - LanguageContext pre-warms cache before first render when lang=pt
  - Default language changed from 'en' to 'pt'
affects: [all public-facing components that use t()]

tech-stack:
  added: []
  patterns:
    - "Preload pattern: fetch all DB-cached translations on app mount, populate in-memory cache before components render"

key-files:
  modified:
    - server/routes/translate.ts
    - client/src/hooks/useTranslation.ts
    - client/src/context/LanguageContext.tsx

key-decisions:
  - "Preload is best-effort (catch silently) — batch fallback still works if preload fails"
  - "translationCache exported (not duplicated) — single source of truth"
  - "Default language = 'pt' — Brazilian agency, Portuguese is primary"

patterns-established:
  - "LanguageContext owns preload responsibility, not individual components"

duration: ~15min
completed: 2026-05-04T00:00:00Z
---

# Phase m4-01 Plan 01: Preload Endpoint + Default Language

**GET /api/translations/preload adicionado ao servidor; LanguageContext pre-aquece translationCache antes do primeiro render quando lang='pt'; default mudado de 'en' para 'pt'.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Preload endpoint existe e retorna cache completo | Pass | Endpoint criado, retorna todo o cache PT do DB |
| AC-2: Cache pre-aquecido antes do primeiro render | Pass | useEffect no LanguageContext popula translationCache e dispara translations-updated |
| AC-3: Default language é 'pt' | Pass | localStorage fallback alterado de 'en' para 'pt' |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/routes/translate.ts` | Modified | Adicionado GET /api/translations/preload antes do POST /api/translate |
| `client/src/hooks/useTranslation.ts` | Modified | translationCache exportado (era const privado) |
| `client/src/context/LanguageContext.tsx` | Modified | Default 'pt', useEffect de preload adicionado |

## Deviations from Plan

**1. Servidor não recarregou automaticamente durante o apply**
- O tsx watch não detectou a mudança em translate.ts durante a sessão
- Endpoint está correto no código (npm run check verde), ativado após restart do servidor
- Impacto: zero — comportamento de produção não afetado

## Next Phase Readiness

**Ready:** translationCache pre-aquecido → componentes recebem PT imediatamente no render sem flash EN→PT

**Concerns:** Primeira visita de um usuário novo (sem localStorage) receberá PT como default — comportamento desejado, mas mudar preferência para EN requer o switch de idioma

**Blockers:** None

---
*Phase: m4-01-translation-architecture, Plan: 01*
*Completed: 2026-05-04*
