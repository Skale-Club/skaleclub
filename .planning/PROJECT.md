# Skale Club — Web Platform

## What This Is

A client-facing marketing + CRM platform for Skale Club. Started as Xpot tech debt cleanup, now evolving into a full client acquisition system with multi-form lead capture, estimates/proposals, and automation.

## Core Value

Convert leads into clients — from first contact (form/WhatsApp) to receiving a personalized proposal with pricing, all within the Skale Club platform.

## Current Milestone: v1.2 Estimates System

**Goal:** Criar um sistema de proposals personalizadas — links enviados ao cliente com serviços, preços e visualização oficial da Skale Club.

**Target features:**
- Aba "Estimates" no admin: criar, listar, editar estimates com slug personalizado por cliente
- Selector de serviços do `portfolio_services` + serviço customizado por cliente + override de preço
- Página pública `/e/:slug` com scroll-snap (fullscreen sections): capa → apresentação Skale Club → 1 seção por serviço → aceitação final
- Criação manual pelo admin (cria + envia link via WhatsApp)
- Criação automática via form (lead preenche form → estimate gerado + disparo email/SMS)

## Requirements

### Validated (v1.0 — Xpot Tech Debt)

- ✓ **DEBT-01**: Route file splitting — v1.0 (1,042 lines → 13 focused files)
- ✓ **DEBT-02**: Schema organization — v1.0 (1,004 lines → 6 domain files + barrel)
- ✓ **DEBT-03**: Context refactoring — v1.0 (729 lines → 8 focused hooks + GeoContext)
- ✓ **DEBT-04**: Error handling standardization — v1.0 (crash bug fixed, ZodError handling added)

### Validated (v1.1 — Multi-Forms)

- ✓ **FORM-01**: Multiple independent forms with own questions, thresholds, GHL mappings
- ✓ **FORM-02**: Admin forms list/editor — create, duplicate, archive, set-default
- ✓ **FORM-03**: Public `/f/:slug` route per form
- ✓ **FORM-04**: Chat AI qualification by form slug
- ✓ **FORM-05**: Leads + dashboard scoped by form

### Active (v1.2 — Estimates)

- [ ] **EST-01** through **EST-XX** — to be defined in REQUIREMENTS.md

### Deferred

- [ ] **OPT-01**: Granular query invalidation per mutation (deferred from v1.0)
- [ ] **OPT-02**: Add `AppError` class for typed error throws (optional)

### Out of Scope

- Digital signature (DocuSign-style) — viewer only for now
- Estimate status tracking (sent/viewed/accepted) — not in v1.2
- PDF export — not in v1.2
- Main app (non-Xpot) route/schema refactors

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt, 64 files changed
- v1.1 shipped 2026-04-15: Multi-forms (forms table, /f/:slug, chat form selector, leads scoping)
- Codebase: TypeScript/React + Express + Drizzle ORM + Supabase
- `portfolio_services` table exists: id, slug, title, subtitle, description, price (text), features[], imageUrl, iconName, ctaText, order, isActive
- Deployed to Vercel serverless + Supabase DB (session pooler port 5432 for migrations)
- Twilio SMS + email capabilities already wired

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Surgical refactoring, not deep refactor | Minimize risk, preserve existing behavior | ✅ v1.0 |
| Barrel re-export pattern | Enable zero-consumer-change migration | ✅ v1.0 |
| GeoContext for shared geoState | useState-per-call creates isolated state | ✅ v1.0 |
| `/f/:slug` route (not `?form=` param) | Cleaner shareable URL | ✅ v1.1 |
| `hasMultipleForms` gate | Single-form workspaces see no UI change | ✅ v1.1 |
| Soft-delete for forms with leads | Default form always protected | ✅ v1.1 |
| Supabase session pooler (port 5432) for migrations | Avoids SQLSTATE 42P05 on transaction pooler | ✅ v1.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-19 — v1.2 Estimates System started*
