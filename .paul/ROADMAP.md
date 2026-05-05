# Xpot Hardening — Milestone 1

**Goal:** App de visitas confiável, seguro e que alimenta o GHL sem falhas
**Phases:** 6 of 6 complete
**Status:** ✅ Done

---

## Contexto de produto

Xpot é um **app de visitas de campo**. O rep:
1. Encontra um prospect/lead
2. Faz check-in (valida geo)
3. Executa a visita (notas, voz, outcome)
4. Faz check-out
5. Dado vai para o GHL

Gestão de pipeline, oportunidades, tasks e CRM é trabalho do GHL. O Xpot só precisa ser confiável no que é seu.

---

## Phase Summary

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 1 | Product Decisions (3 perguntas) | ✅ Complete | — |
| 2 | Auth & Scope | ✅ Complete | 1 |
| 3 | Types & TypeScript | ✅ Complete | — |
| 4 | Lead + Visit Model | ✅ Complete | 3 |
| 5 | GHL Push Reliability | ✅ Complete | 2, 4 |
| 6 | UX & Polish | ✅ Complete | 4 |

---

## Phase Details

---

### Phase 1: Product Decisions

**Focus:** 3 perguntas rápidas para fechar o modelo antes de mexer no código
**Status:** Not started

**Tasks:**
- [ ] 1.1 **Ownership**: lead pertence só ao rep que criou, ou manager/admin pode ver todos?
- [ ] 1.2 **Sync para GHL**: automático em toda ação (atual), ou manual via botão do rep?
- [ ] 1.3 **Offline**: aceitar online-only e mostrar erro claro, ou precisamos de fila real?

**Entrega:** `DECISIONS.md` com as 3 respostas e rationale.

---

### Phase 2: Auth & Scope

**Focus:** Rep não acessa dados de outros reps. Simples assim.
**Status:** Not started
**Depends on:** Phase 1

**Tasks:**
- [ ] 2.1 Reestruturar `middleware.ts` com níveis claros: `requireAuth` → `requireXpotRep` → `requireManager`
- [ ] 2.2 `GET /leads` — rep só vê seus próprios leads
- [ ] 2.3 `PATCH /leads/:id` — só dono (ou admin)
- [ ] 2.4 `DELETE /leads/:id` — só dono (ou admin)
- [ ] 2.5 `GET /visits` — rep só vê suas visitas
- [ ] 2.6 `POST /visits/:id/check-out` — só o rep que fez o check-in
- [ ] 2.7 `POST /sync/flush` — conforme decisão 1.2
- [ ] 2.8 Testar: rep A não acessa nada do rep B → 403

**Critério de pronto:** Escopo isolado por rep. Sem vazamento de dados.

---

### Phase 3: Types & TypeScript

**Focus:** Zerar drift entre schema, zod e TypeScript
**Status:** Not started
**Depends on:** —

**Tasks:**
- [ ] 3.1 Padronizar `lat`/`lng` — número em todo lugar (schema + storage + hooks)
- [ ] 3.2 Criar `SocialUrl = { platform: string; url: string }` canônico em `shared/schema/sales.ts`
- [ ] 3.3 Fechar `visitStatus` como enum Zod, não string solta
- [ ] 3.4 Corrigir erros de tipo em `useLeads.ts`
- [ ] 3.5 Corrigir erros de tipo em `useCheckIn.ts`
- [ ] 3.6 Corrigir erros em `visits.ts` (backend)
- [ ] 3.7 Corrigir erros em `storage.ts`
- [ ] 3.8 `npm run check` → verde sem supressões

**Critério de pronto:** `npm run check` verde.

---

### Phase 4: Lead + Visit Model

**Focus:** Lead edit e visit persistem corretamente. Endereço é entidade separada.
**Status:** Not started
**Depends on:** Phase 3

**Tasks:**
- [ ] 4.1 `PATCH /leads/:id` só atualiza campos core do lead (name, phone, email, website, industry, socialUrls)
- [ ] 4.2 Criar `PATCH /leads/:id/location` — atualiza primary location separadamente
- [ ] 4.3 `storage.upsertPrimaryLocation(leadId, data)` — update se existe, insert se não
- [ ] 4.4 Atualizar `EditLeadDialog.tsx` para usar as rotas separadas
- [ ] 4.5 Garantir que check-in snapshot o estado atual do lead (nome + endereço no momento da visita)
- [ ] 4.6 Testar: editar nome do lead não toca no endereço
- [ ] 4.7 Testar: editar endereço persiste e aparece no próximo load

**Critério de pronto:** Lead core e location têm operações explícitas e independentes.

---

### Phase 5: GHL Push Reliability

**Focus:** Cada visita concluída chega no GHL. Sem falha silenciosa.
**Status:** Not started
**Depends on:** Phases 2, 4

**Tasks:**
- [ ] 5.1 Garantir que check-out sempre tenta push para GHL (contact + nota de visita)
- [ ] 5.2 Se GHL não está configurado → logar aviso, não quebrar o check-out
- [ ] 5.3 Se GHL retorna erro → gravar `sales_sync_events` com status `failed` + mensagem
- [ ] 5.4 Expor `GET /sync/status` — rep vê últimos eventos e se algum falhou
- [ ] 5.5 Botão "Retry" no dashboard para re-syncrar visitas com falha
- [ ] 5.6 Prospects nunca são auto-syncados (já implementado — confirmar e fixar)
- [ ] 5.7 Testar: check-out com GHL ativo → evento `synced` gravado
- [ ] 5.8 Testar: check-out sem GHL configurado → check-out conclui normalmente, sem erro na UI

**Critério de pronto:** Visita concluída → dado no GHL. Falha → visível, não silenciosa.

---

### Phase 6: UX & Polish

**Focus:** Interface que não parece beta. Fluxo principal sem tropeço.
**Status:** Not started
**Depends on:** Phase 4

**Tasks:**
- [ ] 6.1 Corrigir encoding quebrado em `XpotDashboard.tsx`, `XpotSales.tsx`, `ConfirmSlider.tsx`
- [ ] 6.2 Empty states completos: Prospects, Leads, Visits, Dashboard sem dados
- [ ] 6.3 Mensagens de erro úteis nos toasts (não só "Something went wrong")
- [ ] 6.4 Loading states consistentes (sem flash de conteúdo vazio)
- [ ] 6.5 Confirmação antes de deletar lead ou cancelar visita
- [ ] 6.6 Indicador claro quando sync falhou (badge no dashboard, não só log)
- [ ] 6.7 Checar fluxo completo: login → prospect → check-in → visita → check-out → histórico

**Critério de pronto:** Fluxo principal sem artefatos, erros ou estados confusos.

---

*Updated: 2026-04-06*

---

# Milestone 4 — Bilingual Public Site

**Goal:** Todo conteúdo editável do site público tem campo PT nativo — sem depender de IA, sem fallbacks frágeis.
**Status:** 🚧 In Progress
**Phases:** 0 of 3 complete

## Current Milestone

**Scope revision (2026-05-04):** Investigação revelou que o backend de tradução (Gemini via `/api/translate`) funciona corretamente e as traduções estão cacheadas no DB. Os problemas são arquiteturais no frontend: (1) sem preload do cache na inicialização, causando flash EN→PT; (2) default language = 'en'; (3) gaps de cobertura em Footer e Links.tsx.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| m4-01 | Translation Architecture Fix | 2 | ✅ Complete | 2026-05-04 |
| m4-02 | (retired — scope absorbed into m4-01) | - | - | - |
| m4-03 | (retired — scope absorbed into m4-01) | - | - | - |

---

### Phase m4-01: Translation Architecture Fix

**Focus:**
- Plan 01: Adicionar `GET /api/translations/preload` que retorna todo o cache PT do DB. `LanguageContext` pre-aquece o `translationCache` antes do primeiro render quando lang='pt'. Mudar default de 'en' para 'pt'.
- Plan 02: Corrigir gaps de cobertura: Footer `{tagline}` → `{t(tagline)}`, Links.tsx 5 strings hardcoded → `t()`, adicionar chaves estáticas faltando em `translations.ts`.

**Critério de pronto:** Zero flash EN→PT no site público. Zero strings em inglês com lang=PT. `npm run check` verde.

Plans: 2/2 (defined during /paul:plan)

---

*Updated: 2026-05-04*
