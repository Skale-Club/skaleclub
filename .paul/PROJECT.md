# Xpot — Hardening & Scale

## Vision
Deixar o Xpot seguro, tipado, coerente entre front/back, com fluxo operacional confiável, métricas corretas e pronto para crescer sem regressão.

## Problem
O núcleo operacional do Xpot (check-in, leads, sync, métricas) tem:
- Autorização inconsistente: reps acessam dados fora do seu escopo
- Drift de tipos entre schema/zod/typescript
- N+1 queries em listagens e dashboard
- Sync GHL sem controle de escopo nem retry
- Acoplamento circular nos hooks do frontend
- UI com artefatos de encoding e estados incompletos

## Scope
**In:** middleware, leads, visits, sync, sales, types, hooks, páginas Xpot
**Out:** outros módulos do app (booking, admin não-Xpot, GHL pipeline config)

## Success Criteria
- `npm run check` verde, sem erros
- Nenhuma rota sensível sem validação de escopo
- Lead edit persistindo core + location corretamente
- Sync restrito por escopo e auditável
- Dashboard com métricas coerentes
- Fluxos críticos validados ponta a ponta

## Stack
- Backend: Express + Drizzle ORM + PostgreSQL + Supabase Storage
- Frontend: React + React Query + Wouter + Tailwind
- Integração: GoHighLevel API
