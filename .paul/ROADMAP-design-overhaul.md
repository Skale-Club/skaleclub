# Design System + Structural Refactor — Milestone 2

**Goal:** Admin e site com design coeso + codebase refatorado. Tokens consistentes, dark mode escuro/desaturado, zero borda preta/branca sólida, padrões de layout padronizados, arquivos >600 linhas quebrados em subcomponentes/módulos.
**Phases:** 0 of 9 complete
**Status:** 📝 Draft

---

## Vision

Hoje o app tem dois problemas acumulados:

**Design fragmentado:**
- 20+ arquivos com `border-slate-200`, `border-gray-300` hardcoded
- Dark theme usa slate-800/900 (azulado, não realmente "dark")
- Cada section do admin tem sua própria escala de padding/spacing
- Cards de tamanhos inconsistentes em grids (ver Links Page)
- Empty states sem padrão
- Shadcn defaults vazam por toda parte

**Arquivos monolíticos:**
- `server/routes.ts` — 3490 linhas (todos os endpoints num arquivo)
- `IntegrationsSection.tsx` — 1693 linhas
- `server/storage.ts` — 1599 linhas
- `LeadsSection.tsx` — 1274 linhas
- `BlogSection.tsx` — 1090 linhas
- `ChatSection.tsx` — 966 linhas
- `PortfolioSection.tsx` — 738 linhas

Isso dificulta review, navegação, testes, e aumenta risco de regressão.

**Estado alvo:**
- Design system único, tokens enxutos, dark mode preto/carvão (não azulado), padrões replicáveis
- Nenhum arquivo acima de ~600 linhas — sections quebradas em subcomponentes, backend em módulos por feature
- Manutenção fácil, navegação por feature, cada arquivo tem uma responsabilidade

---

## Problem

1. **Bordas inconsistentes** — mistura de token semantic (`border`), cor hardcoded (`border-slate-200`), e bordas implícitas dos shadcn defaults
2. **Dark mode fraco** — slate-900 (`222 47% 11%`) ainda é azulado, não neutro; cards em slate-800 têm contraste baixo
3. **Layouts assimétricos** — Links Page com card pequeno + card grande + card isolado embaixo = visual bagunçado
4. **Padding arbitrário** — `p-4`, `p-5`, `p-6`, `p-8` misturados sem lógica
5. **Empty states variados** — alguns com dashed border, outros com icon+texto, outros vazios
6. **Typography escala perdida** — títulos de section variam (`text-2xl`, `text-xl`, `text-lg font-semibold`)
7. **Cores de status/ação inconsistentes** — `bg-blue-500`, `bg-primary`, `bg-[#406EF1]`, `bg-[#1C53A3]` todas como "primary"

---

## Scope

**In:**
- `client/src/index.css` (tokens)
- `client/src/components/ui/` (componentes base shadcn)
- `client/src/components/admin/` (todas as sections)
- `client/src/pages/Admin.tsx` e sidebar
- Audit e fix em páginas públicas que compartilham componentes

**Out:**
- Redesign visual do site público (Portfolio page, Home hero — já foram ajustados recentemente)
- Novos recursos/features
- Schema de banco
- Backend

---

## Success Criteria

**Design:**
- [ ] Zero ocorrência de `border-(slate|gray|zinc|neutral|stone|black|white)-\d+` em components customizados
- [ ] Dark mode: background base `#0a0a0a`–`#121212` (neutro, não azulado)
- [ ] Cards de admin em dark têm contraste WCAG ≥ 3:1 contra background
- [ ] Padding scale documentada: `p-4` (compact), `p-6` (default), `p-8` (hero)
- [ ] Todas as sections do admin usam mesmo padrão de header/container
- [ ] Todas as empty states seguem componente compartilhado `<EmptyState />`
- [ ] Links Page com layout simétrico ou intencionalmente assimétrico

**Estrutura:**
- [ ] Nenhum arquivo React `.tsx` acima de 600 linhas
- [ ] `server/routes.ts` quebrado em módulos por feature (`routes/leads.ts`, `routes/portfolio.ts`, etc.)
- [ ] `server/storage.ts` quebrado por domínio (`storage/leads.ts`, `storage/portfolio.ts`, etc.)
- [ ] Nenhuma regressão: todas as rotas continuam funcionando (smoke test)
- [ ] `npm run check` verde após cada fase

**Processo:**
- [ ] Regras salvas em memória para manutenção futura

---

## Stack

- Tailwind CSS + shadcn/ui + Radix UI primitives
- HSL tokens com alpha em CSS vars
- Sem mudança de framework

---

## Phase Summary

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 1 | Token Refactor (cores, bordas, dark theme) | 🟡 Partial | — |
| 2 | Shadcn UI Base Audit | 📝 Draft | 1 |
| 3 | Border Sweep (remoção de hardcoded) | 📝 Draft | 1, 2 |
| 4 | Shared Admin Patterns (EmptyState, SectionHeader, Card) | 📝 Draft | 2 |
| 5 | Backend Split — `server/routes.ts` + `storage.ts` | 📝 Draft | — |
| 6 | Section Refactor — Alta Prioridade (design + split arquivo) | 📝 Draft | 4 |
| 7 | Section Refactor — Média Prioridade | 📝 Draft | 4 |
| 8 | Section Refactor — Baixa Prioridade | 📝 Draft | 4 |
| 9 | Final Audit & Memory Rules | 📝 Draft | 1-8 |

Cada Section Refactor (Phase 6/7/8) agora **inclui split de arquivos >600 linhas em subcomponentes**, além do design.

---

## Phase Details

### Phase 1: Token Refactor

**Focus:** Refundar tokens CSS em `index.css` — cores mais neutras, bordas alpha, dark mode realmente escuro.

**Tasks:**
- [ ] 1.1 **Dark theme background**: `--background` de `222 47% 11%` (slate-900 azulado) → `0 0% 7%` (carvão neutro)
- [ ] 1.2 **Dark theme card**: `--card` de `217 33% 17%` (slate-800) → `0 0% 11%` (cinza escuro neutro)
- [ ] 1.3 **Dark theme muted**: reduzir saturação
- [ ] 1.4 **Dark theme sidebar**: matching com card
- [ ] 1.5 **Border token**: já em alpha (feito), confirmar que funciona light + dark
- [ ] 1.6 **Input token**: alpha similar ao border
- [ ] 1.7 **Primary color**: unificar em um único hex (tem `#406EF1`, `#1C53A3`, `bg-primary`, `bg-blue-500` espalhados)
- [ ] 1.8 **Ring/focus**: suavizar, evitar azul estridente no dark

**Critério de pronto:** Abrir cada section em dark mode → parece um app moderno (Linear, Vercel), não azulado.

---

### Phase 2: Shadcn UI Base Audit

**Focus:** Garantir que todos os componentes em `components/ui/` usam tokens, sem bordas/cores hardcoded.

**Tasks:**
- [ ] 2.1 `Input` — remover `border-input` harsh, usar token
- [ ] 2.2 `Textarea` — idem
- [ ] 2.3 `Select` — idem
- [ ] 2.4 `Card` — auditar `border border-border`
- [ ] 2.5 `Dialog` — backdrop e content
- [ ] 2.6 `Table` — separadores de linha com alpha
- [ ] 2.7 `Separator` — alpha hairline
- [ ] 2.8 `Button` outline variant — border token
- [ ] 2.9 `Badge` — variantes consistentes
- [ ] 2.10 `Tabs` — underline de active tab suave

**Critério de pronto:** Qualquer uso de componente base herda visual correto sem override.

---

### Phase 3: Border Sweep

**Focus:** Auditar cada borda do app caso a caso. Decidir entre: **converter** (sólida → token delicado), **manter** (já está no token), ou **remover** (borda não agrega, só polui).

**Árvore de decisão para cada borda encontrada:**

1. **A borda serve pra separar dois conteúdos visualmente distintos?**
   - Sim → **manter** a borda, trocar para token delicado
   - Não → pular para 2

2. **O elemento já tem background/shadow que o distingue do entorno?**
   - Sim → **remover** a borda (background + shadow já fazem o trabalho)
   - Não → **manter** com token delicado

3. **A borda é ornamental (visual decorativo)?**
   - Sim → avaliar caso a caso, geralmente **remover** (design moderno usa espaço negativo)
   - Não → manter

**Exemplos de conversão:**
- `border border-slate-200` em card sobre bg diferente → `border` (token delicado)
- `border-b border-slate-200` separando header de body → `border-b` (token)
- `border border-slate-200` em card que já tem `shadow-sm` e bg-card sobre bg-section → **remover** (shadow + bg já separam)
- `border-2 border-black` → ❌ nunca
- `divide-y divide-slate-200` em lista → `divide-y divide-border` (token)
- Input com `border border-slate-300` → `border` (token, já é suficiente)

**Tasks:**
- [ ] 3.1 Grep completo — listar todos os matches de borda hardcoded
- [ ] 3.2 Passar por cada arquivo aplicando a árvore de decisão
- [ ] 3.3 Audit específico de `divide-y`, `divide-x`
- [ ] 3.4 Commit atômico por pasta/feature, explicar no commit quais foram convertidas vs removidas

**Critério de pronto:** 
- 0 matches de cor sólida hardcoded em borda
- Cada borda restante tem justificativa (separação visual real)
- Visual mais limpo que antes, sem perder hierarquia

---

### Phase 4: Shared Admin Patterns

**Focus:** Criar componentes compartilhados que encapsulam os padrões repetidos no admin.

**Tasks:**
- [ ] 4.1 `<AdminSectionHeader title description action />` — substitui os `<div>` copiados em cada section
- [ ] 4.2 `<AdminCard>` wrapper com padding/border/radius padrão (`p-6 rounded-2xl border bg-card`)
- [ ] 4.3 `<EmptyState icon title description action />` — unifica todas as variações
- [ ] 4.4 `<FormGrid cols={1|2|3}>` — grid de campos consistente
- [ ] 4.5 Documentar padding/spacing scale em comentário no `index.css`

**Critério de pronto:** Refatorar uma section (ex: Dashboard) usando só os novos componentes.

---

### Phase 5: Backend Split

**Focus:** Quebrar `server/routes.ts` (3490 linhas) e `server/storage.ts` (1599 linhas) em módulos por feature. Zero mudança funcional.

**Tasks:**
- [ ] 5.1 Criar estrutura `server/routes/` por domínio:
  - `routes/auth.ts`, `routes/leads.ts`, `routes/portfolio.ts`, `routes/chat.ts`, `routes/integrations.ts`, `routes/blog.ts`, `routes/seo.ts`, `routes/xpot.ts`, `routes/translate.ts`, `routes/uploads.ts`
- [ ] 5.2 `server/routes.ts` vira só um orchestrator (`registerAllRoutes(app)`) que chama `registerLeadsRoutes(app)`, etc.
- [ ] 5.3 Criar estrutura `server/storage/` por domínio matching as routes
- [ ] 5.4 `server/storage.ts` vira agregador exportando `DatabaseStorage` composto
- [ ] 5.5 Smoke test — abrir cada página que chama cada endpoint, garantir que funciona
- [ ] 5.6 `npm run check` verde

**Critério de pronto:** Cada arquivo novo < 400 linhas. Nenhuma regressão funcional.

---

### Phase 6: Section Refactors — Alta Prioridade

**Focus:** Sections mais bagunçadas/visíveis. **Cada uma = design fix + split em subcomponentes.**

**Tasks:**
- [ ] 6.1 **Links Page** — simetrizar grid, padronizar cards, unificar spacing
- [ ] 6.2 **Dashboard** (482 lin) — aplicar `AdminCard`, `SectionHeader`; split se necessário
- [ ] 6.3 **Leads** (1274 lin) — dividir em `LeadsSection` + `LeadsTable` + `LeadsFilters` + `LeadDetail` + `LeadStatusBadge`. Design: tabela com linhas suaves, empty state
- [ ] 6.4 **Chat** (966 lin) — dividir em `ChatSection` + `ChatInbox` + `ChatThread` + `ChatComposer` + `ChatProviderPicker`. Design: separadores hairline

**Critério de pronto:** Cada section < 400 linhas no arquivo raiz. Visual coerente. Empty states padrão.

---

### Phase 7: Section Refactors — Média Prioridade

**Tasks:**
- [ ] 7.1 **Integrations** (1693 lin) — dividir por provider: `IntegrationsSection` + `AIProviderCard` + `GHLCard` + `TwilioCard` etc. Design: cards uniformes
- [ ] 7.2 **Website** (Hero/Badges tabs) — tabs consistentes
- [ ] 7.3 **SEO** (433 lin) — formulários alinhados
- [ ] 7.4 **FAQ** (325 lin) — lista/CRUD padrão
- [ ] 7.5 **Portfolio** (738 lin) — split em `PortfolioSection` + `PortfolioCard` (admin) + `PortfolioForm`. Design já está bom, só audit.

**Critério de pronto:** Consistente com Phase 6.

---

### Phase 8: Section Refactors — Baixa Prioridade

**Tasks:**
- [ ] 8.1 **Company Settings** (375 lin) — form grande precisa tabs
- [ ] 8.2 **Twilio** (483 lin) — padrão integration
- [ ] 8.3 **VCards** (550 lin) — split se passar de 400 pós-design
- [ ] 8.4 **Xpot Sales** — idem
- [ ] 8.5 **Blog** (1090 lin) — split em `BlogSection` + `BlogList` + `BlogEditor` + `BlogForm`

**Critério de pronto:** Todo admin segue mesmo padrão visual + arquivos < 600 linhas.

---

### Phase 9: Final Audit & Memory Rules

**Focus:** Validação final + salvar regras permanentes para manter o padrão.

**Tasks:**
- [ ] 9.1 Rodar grep global — confirmar 0 `border-(slate|gray|zinc|neutral|stone)-\d+` em `client/src/**/*.tsx`
- [ ] 9.2 Rodar `wc -l` — confirmar nenhum arquivo > 600 linhas
- [ ] 9.3 Smoke test visual em light + dark theme em cada admin section
- [ ] 9.4 Atualizar `CLAUDE.md` com novos padrões
- [ ] 9.5 Salvar memory rules: arquivo máximo 600 lin, padrão de admin section, token de borda, padrão de empty state
- [ ] 9.6 Commit final e PR unificando milestone

**Critério de pronto:** Milestone entregue. Memória atualizada para manutenção futura.

---

*Draft: 2026-04-14*
