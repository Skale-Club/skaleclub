---
phase: 30
slug: translation-system-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-03
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc`) via `npm run check` |
| **Config file** | `tsconfig.json` (root) |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

No Jest/Vitest test infrastructure detected for the client. After TRX-08 (type tightening in Plan 30-01), `npm run check` becomes the exhaustive automated test: any `t()` call referencing a missing key is a compile error.

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd:verify-work`:** Full suite must be green + manual PT browser review
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 30-01 | 1 | TRX-06, TRX-07, TRX-10 | compile + grep | `grep -c "Page Not Found" client/src/lib/translations.ts && npm run check` | ✅ | ⬜ pending |
| 30-01-02 | 30-01 | 1 | TRX-08, TRX-09 | compile | `npm run check` | ✅ | ⬜ pending |
| 30-01-03 | 30-01 | 1 | TRX-10, TRX-09 | compile + grep | `grep "Page Not Found" client/src/pages/not-found.tsx && npm run check` | ✅ | ⬜ pending |
| 30-02-01 | 30-02 | 2 | TRX-01, TRX-02 | compile + grep | `grep -c "Create" client/src/lib/translations.ts && npm run check` | ✅ | ⬜ pending |
| 30-02-02 | 30-02 | 2 | TRX-04, TRX-05 | compile + grep | `grep "useTranslation" client/src/components/admin/LeadsSection.tsx && npm run check` | ✅ | ⬜ pending |
| 30-02-03 | 30-02 | 2 | TRX-03, TRX-04, TRX-05 | compile + grep | `grep "Back to" client/src/lib/translations.ts | wc -l && npm run check` | ✅ | ⬜ pending |
| 30-03-01 | 30-03 | 2 | TRX-01, TRX-04 | compile + grep | `grep "useTranslation" client/src/components/admin/DashboardSection.tsx && npm run check` | ✅ | ⬜ pending |
| 30-03-02 | 30-03 | 2 | TRX-01, TRX-04, TRX-05 | compile + grep | `grep -c "t('" client/src/components/admin/DashboardSection.tsx` | ✅ | ⬜ pending |
| 30-03-03 | 30-03 | 2 | TRX-01, TRX-04, TRX-05 | compile + grep | `grep "useTranslation" client/src/components/admin/EstimatesSection.tsx && npm run check` | ✅ | ⬜ pending |
| 30-04-01 | 30-04 | 3 | TRX-01, TRX-11 | compile + grep | `grep -c "Política de Privacidade" client/src/lib/translations.ts && npm run check` | ✅ | ⬜ pending |
| 30-04-02 | 30-04 | 3 | TRX-01, TRX-11 | compile + grep | `grep -c "Termos de Serviço" client/src/lib/translations.ts && npm run check` | ✅ | ⬜ pending |
| 30-04-03 | 30-04 | 3 | TRX-01, TRX-06, TRX-09 | compile + grep | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test files needed. TypeScript compiler is the test harness for this phase. Wave 0 is complete by default.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PT strings are correct Brazilian Portuguese | TRX-11 | Linguistic correctness cannot be verified by compiler | Switch site to PT, browse each page: Home, Services, Contact, About, FAQ, Portfolio, PrivacyPolicy, TermsOfService, Admin Dashboard, Estimates, Leads, Presentations, Links. Verify all visible text is correct PT-BR. |
| No hardcoded admin strings visible | TRX-04 | Compiler only catches t() calls — raw strings bypass type checking | Open each admin section in PT mode; verify all labels, placeholders, and headers display in Portuguese |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
