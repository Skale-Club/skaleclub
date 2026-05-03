# Phase 30: Translation System Overhaul - Research

**Researched:** 2026-05-03
**Domain:** TypeScript i18n static dictionary, React translation hook
**Confidence:** HIGH — all findings from direct file reads; zero inference from training data

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRX-01 | Every `t()` call maps to an existing key in `translations.pt` | Missing keys inventory below; exact fixes documented |
| TRX-02 | All `t()` keys in 8 named components are defined with correct PT strings | Per-component audit below |
| TRX-03 | All "Back to X" variants consistently defined | 4 variants enumerated; 3 missing |
| TRX-04 | No visible admin string hardcoded without `t()` | Hardcoded string inventory with exact file:line |
| TRX-05 | All placeholder/label strings in admin forms use `t()` | Exact items listed in hardcoded strings section |
| TRX-06 | No dead keys in `translations.ts` | Unused keys identified via grep; list below |
| TRX-07 | No duplicate keys in `translations.ts` | Verified: no duplicates found |
| TRX-08 | TypeScript enforces `t()` accepts only `TranslationKey` | Exact code change documented |
| TRX-09 | `npm run check` passes after all changes | TS enforcement strategy is backwards-compatible |
| TRX-10 | Wrong 404 key fixed | Exact mismatch documented |
| TRX-11 | All PT strings are correct Brazilian Portuguese | Verified existing strings; new strings specified |
</phase_requirements>

---

## Translation System Architecture

**Confidence: HIGH** — read directly from source files.

### Files

| File | Role |
|------|------|
| `client/src/lib/translations.ts` | Static PT dictionary (321 keys); exports `TranslationKey = keyof typeof translations.pt` |
| `client/src/context/LanguageContext.tsx` | `LanguageProvider` + `LanguageContext`; stores `'en' \| 'pt'` in localStorage |
| `client/src/hooks/useTranslation.ts` | `useTranslation()` hook returning `{ t, language, setLanguage, isEnglish, isPortuguese, isTranslating }` |

### How `t()` Works (3-tier lookup)

```typescript
// Tier 1: in-memory runtime cache (Map<string, string>)
// Tier 2: static PT dict — translationCache.set + return immediately
// Tier 3: API batch (POST /api/translate, 50ms debounce) — used when key absent from PT dict
```

**Critical:** EN is pass-through — `t(text)` returns `text` unchanged when language is 'en'. Only PT triggers lookup. Any key absent from `translations.pt` falls through to the API (Tier 3), not a silent miss.

### Current `t()` Signature (the problem)

```typescript
// In useTranslation.ts line 117:
const t = useCallback((text: string): string => {
```

`text: string` accepts ANY string — no compile-time enforcement. Passing an undefined key compiles fine; it only fails at runtime by calling the API.

### `TranslationKey` Type

```typescript
// In translations.ts line 401:
export type TranslationKey = keyof typeof translations.pt;
```

The type exists but is NOT used in the `t()` parameter type. It is exported and therefore available to tighten `t()`.

---

## Complete Key Inventory

The dictionary at `client/src/lib/translations.ts` currently contains **321 keys** (lines 6–398). Rather than listing all 321 here, they are fully readable at that file. The sections are:

- Navbar (4 keys)
- Hero Section (4 keys)
- Trust Badges / Benefits (6 keys)
- Common (31 keys including 'Services', 'Title', 'Back to Home', etc.)
- Forms (14 keys)
- Booking (9 keys)
- Admin (9 keys)
- Admin — Forms section M3-02 (19 keys)
- Admin — Chat settings M3-03 (3 keys)
- Admin — Leads & Dashboard M3-04 (2 keys)
- Public /f/:slug not-found (2 keys, including 'Back to homepage')
- Messages (7 keys)
- Time (14 keys)
- Months (12 keys)
- Footer (3 keys)
- Contact Page (12 keys)
- About Us Page (8 keys)
- FAQ (3 keys)
- Lead Thank You Page (8 keys)
- Lead Form Modal (8 keys)
- 404 Page (2 keys: '404 Page Not Found', 'The page you are looking for does not exist.')
- Privacy Policy & Terms common (6 keys)
- Portfolio Page (10 keys)
- Admin Links Page Phase 12 (20 keys)
- Admin Links Page Uploaders Phase 12-02 (10 keys)
- Admin Links Page Theme Editor Phase 13-02 (6 keys)
- Admin Links Page Icon Picker Phase 13-01 (8 keys)
- Admin Links Page Live Preview Phase 13-03 (4 keys)
- Admin Brand Guidelines Phase 17 (9 keys)
- Admin Presentations Section Phase 19 (24 keys)
- Presentation Viewer Phase 20 (10 keys)

---

## Missing Keys

**Confidence: HIGH** — found by reading each component file and cross-referencing `translations.ts`.

### PresentationsSection.tsx — 3 missing keys

| Key string used in `t()` | Correct PT translation | Notes |
|--------------------------|------------------------|-------|
| `'Create'` | `'Criar'` | Dialog footer submit button |
| `'Search presentations...'` | `'Pesquisar apresentações...'` | Search input placeholder |
| `'Failed to create presentation'` | `'Falha ao criar apresentação'` | Toast on createMutation error |

**Confirmed present** (these look missing but ARE defined): 'New Presentation', 'Title', 'Slug', 'Back to presentations', 'Delete presentation?', 'Failed to delete presentation', 'Presentation created', 'Slides saved', 'Failed to save slides', 'Slug saved', 'Failed to save slug', 'No presentations yet', 'Create your first presentation to get started.', 'slides', 'Slide preview', 'JSON — paste Claude Code output here', 'Invalid JSON', 'Link copied', 'Copy failed', 'Open presentation', 'Click to rename', 'No slides yet', 'Presentation slug', 'Edit slug', 'Open Editor', 'Preview', 'Cancel', 'Delete'.

### not-found.tsx — 2 wrong keys (see Broken/Wrong Keys section)

The file uses:
- `t('Page Not Found')` — NOT in dictionary (dictionary has `'404 Page Not Found'`)
- `t('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.')` — NOT in dictionary (dictionary has different string)

### "Back to X" variants — 3 variants missing from dictionary

| Key string | Status | PT translation |
|------------|--------|----------------|
| `'Back to Home'` | DEFINED (`'Voltar ao Início'`) | — |
| `'Back to homepage'` | DEFINED (`'Voltar à página inicial'`) | — |
| `'Back to presentations'` | DEFINED (`'Voltar às apresentações'`) | — |
| `'Back to website'` | DEFINED (`'Voltar ao site'`) | — |

**Verdict on TRX-03:** All 4 "Back to X" variants ARE already defined. No missing keys here. The inconsistency is stylistic, not functional.

### BrandGuidelinesSection.tsx — 1 potential missing key

`t('## Brand Identity\n\n**Primary Color:** #1C53A3...')` — this is a long multiline placeholder string. It is NOT in the dictionary. Because it is just a textarea placeholder used only in the admin (EN interface), its translation is low priority. However it will trigger an API call when PT is active.

| Key string | PT translation |
|------------|----------------|
| `'## Brand Identity\n\n**Primary Color:** #1C53A3\n**Accent Color:** #FFFF01\n**Fonts:** Outfit (headings), Inter (body)\n\n## Tone of Voice\n\n- Professional yet approachable\n- Action-oriented language\n\n## Always Include\n- Company name: Skale Club\n\n## Never Include\n- Competitor mentions'` | `'## Identidade da Marca\n\n**Cor Primária:** #1C53A3\n**Cor de Destaque:** #FFFF01\n**Fontes:** Outfit (títulos), Inter (corpo)\n\n## Tom de Voz\n\n- Profissional e acessível\n- Linguagem orientada à ação\n\n## Sempre Incluir\n- Nome da empresa: Skale Club\n\n## Nunca Incluir\n- Menções a concorrentes'` |

### PrivacyPolicy.tsx + TermsOfService.tsx — LARGE missing key set

These files use `t()` extensively for legal text (100+ keys). NONE of those keys are in the dictionary. Examples:
- `t('1. Introduction')`, `t('2. Information We Collect')`, etc. (section titles)
- `t('Personal Information You Provide')`, `t('Contact Information:')`, etc. (body copy)
- `t('By using our services, you agree...')` (paragraphs)
- Many more TermsOfService section titles and paragraphs

These are currently falling through to the API translator (Tier 3). They should be added to the static dictionary for TRX-01 compliance.

**Scope note:** There are approximately 100–120 keys across PrivacyPolicy.tsx and TermsOfService.tsx that are missing from the dictionary. Full enumeration requires reading those files carefully during implementation.

---

## Hardcoded Strings

**Confidence: HIGH** — found by reading each component file.

All items below are visible user-facing strings rendered without `t()`.

### EstimatesSection.tsx

| File:line | Hardcoded string | Key to use | PT translation |
|-----------|-----------------|------------|----------------|
| `EstimatesSection.tsx:234` | `'Edit Estimate'` / `'New Estimate'` (DialogTitle) | `'Edit Estimate'` / `'New Estimate'` | `'Editar Orçamento'` / `'Novo Orçamento'` |
| `EstimatesSection.tsx:249` | `'Company name'` (Label) | `'Company name'` | `'Nome da empresa'` |
| `EstimatesSection.tsx:258` | `'Contact name'` (Label) | `'Contact name'` | `'Nome do contato'` |
| `EstimatesSection.tsx:268` | `'At least one of company or contact name is required.'` | `'At least one of company or contact name is required.'` | `'Pelo menos um entre nome da empresa ou do contato é obrigatório.'` |
| `EstimatesSection.tsx:271` | `'Note (optional)'` (Label) | `'Note (optional)'` | `'Nota (opcional)'` |
| `EstimatesSection.tsx:281` | `'Access code (optional)'` (Label) | `'Access code (optional)'` | `'Código de acesso (opcional)'` |
| `EstimatesSection.tsx:289` | `'Leave blank to disable gate'` | `'Leave blank to disable gate'` | `'Deixe em branco para desativar a proteção'` |
| `EstimatesSection.tsx:298` | `'Services'` (section header span) | `'Services'` | ALREADY IN DICT as `'Serviços'` — just wrap with `t()` |
| `EstimatesSection.tsx:304` | `'Add from catalog'` | `'Add from catalog'` | `'Adicionar do catálogo'` |
| `EstimatesSection.tsx:311` | `'Add custom row'` | `'Add custom row'` | `'Adicionar linha personalizada'` |
| `EstimatesSection.tsx:364` | `'Cancel'` (Button) | `'Cancel'` | ALREADY IN DICT |
| `EstimatesSection.tsx:367` | `'Save Changes'` / `'Create Estimate'` | `'Save Changes'` / `'Create Estimate'` | `'Salvar Alterações'` / `'Criar Orçamento'` |
| `EstimatesSection.tsx:464` | `'Estimate created'` (toast) | `'Estimate created'` | `'Orçamento criado'` |
| `EstimatesSection.tsx:467` | `'Failed to create estimate'` | `'Failed to create estimate'` | `'Falha ao criar orçamento'` |
| `EstimatesSection.tsx:483` | `'Estimate updated'` | `'Estimate updated'` | `'Orçamento atualizado'` |
| `EstimatesSection.tsx:486` | `'Failed to update estimate'` | `'Failed to update estimate'` | `'Falha ao atualizar orçamento'` |
| `EstimatesSection.tsx:497` | `'Estimate deleted'` | `'Estimate deleted'` | `'Orçamento excluído'` |
| `EstimatesSection.tsx:501` | `'Failed to delete estimate'` | `'Failed to delete estimate'` | `'Falha ao excluir orçamento'` |
| `EstimatesSection.tsx:518` | `'Access code updated'` | `'Access code updated'` | `'Código de acesso atualizado'` |
| `EstimatesSection.tsx:521` | `'Failed to update access code'` | `'Failed to update access code'` | `'Falha ao atualizar o código de acesso'` |
| `EstimatesSection.tsx:557` | `'Slug updated'` | `'Slug updated'` | `'Slug atualizado'` |
| `EstimatesSection.tsx:560` | `'Failed to update slug'` | `'Failed to update slug'` | `'Falha ao atualizar o slug'` |
| `EstimatesSection.tsx:602` | `'Estimates'` (SectionHeader title) | `'Estimates'` | `'Orçamentos'` |
| `EstimatesSection.tsx:603` | `'Create and manage client proposals...'` | `'Create and manage client proposals — each generates a shareable link'` | `'Crie e gerencie propostas para clientes — cada uma gera um link compartilhável'` |
| `EstimatesSection.tsx:638` | `'New Estimate'` (Button) | `'New Estimate'` | `'Novo Orçamento'` |
| `EstimatesSection.tsx:648` | `'No estimates yet'` | `'No estimates yet'` | `'Nenhum orçamento ainda'` |
| `EstimatesSection.tsx:651` | `'Create your first estimate...'` | `'Create your first estimate to generate a shareable proposal link.'` | `'Crie seu primeiro orçamento para gerar um link de proposta compartilhável.'` |
| `EstimatesSection.tsx:810` | `'Delete estimate?'` (AlertDialogTitle) | `'Delete estimate?'` | `'Excluir orçamento?'` |
| `EstimatesSection.tsx:812` | `'This will permanently remove the estimate...'` | dynamic string with name — keep as template or add generic key | Keep as template |
| `EstimatesSection.tsx:816` | `'Cancel'` | ALREADY IN DICT | |
| `EstimatesSection.tsx:820` | `'Delete'` | ALREADY IN DICT | |
| `EstimatesSection.tsx:853` | `'Password Protection'` (DialogTitle) | `'Password Protection'` | `'Proteção por Senha'` |
| `EstimatesSection.tsx:867` | `'Access code (optional)'` | same key as above | |
| `EstimatesSection.tsx:875` | `'Leave blank to remove password protection'` | `'Leave blank to remove password protection'` | `'Deixe em branco para remover a proteção por senha'` |
| `EstimatesSection.tsx:878` | `'Cancel'` | ALREADY IN DICT | |
| `EstimatesSection.tsx:881` | `'Save'` | ALREADY IN DICT | |

**Note:** EstimatesSection does NOT call `useTranslation()` at all. All of the above are completely untranlated. The hook must be added to both `EstimatesSection` and `EstimateDialogForm`.

### DashboardSection.tsx

DashboardSection does NOT call `useTranslation()`. It has extensive hardcoded strings:

| Hardcoded string | Key | PT |
|-----------------|-----|----|
| `'Total Leads'` | `'Total Leads'` | `'Total de Leads'` |
| `'Leads (7 Days)'` | `'Leads (7 Days)'` | `'Leads (7 Dias)'` |
| `'Hot Leads'` | `'Hot Leads'` | `'Leads Quentes'` |
| `'Open Chats'` | `'Open Chats'` | `'Chats Abertos'` |
| `'Complete Forms'` | `'Complete Forms'` | `'Formulários Completos'` |
| `'In Progress'` | `'In Progress'` | `'Em Andamento'` |
| `'Abandoned'` | `'Abandoned'` | `'Abandonados'` |
| `'Chat Response'` | `'Chat Response'` | `'Resposta do Chat'` |
| `'high priority contacts'` (helper text) | `'High priority contacts'` | `'Contatos de alta prioridade'` |
| `'Last 24h activity'` | `'Last 24h activity'` | `'Atividade nas últimas 24h'` |
| `'Needs follow-up'` | `'Needs follow-up'` | `'Precisa de acompanhamento'` |
| `'Lead Funnel'` (h3) | `'Lead Funnel'` | `'Funil de Leads'` |
| `'Completion'` (Badge) | dynamic string with `%` — not translatable as-is | — |
| `'Lead Sources'` | `'Lead Sources'` | `'Fontes de Leads'` |
| `'Form:'` (in lead sources) | already in dict as `'Form:'` | — |
| `'Chat:'` | `'Chat:'` | `'Chat:'` |
| `'Qualification'` | `'Qualification'` | `'Qualificação'` |
| `'Hot:'` | `'Hot:'` | `'Quente:'` |
| `'Complete:'` | `'Complete:'` | `'Completo:'` |
| `'Recent Leads'` (h3) | `'Recent Leads'` | `'Leads Recentes'` |
| `'View all'` | `'View all'` | `'Ver todos'` |
| `'No leads yet.'` | `'No leads yet.'` | `'Nenhum lead ainda.'` |
| `'Brand Profile'` (h3) | `'Brand Profile'` | `'Perfil da Marca'` |
| `'Company name'` (profile check label) | `'Company name'` | `'Nome da empresa'` |
| `'Primary email'` | `'Primary email'` | `'E-mail principal'` |
| `'Main logo'` | `'Main logo'` | `'Logo principal'` |
| `'Hero content'` | `'Hero content'` | `'Conteúdo do banner'` |
| `'Complete Company Profile'` (Button) | `'Complete Company Profile'` | `'Completar Perfil da Empresa'` |
| `'Integrations'` (h3) | `'Integrations'` | `'Integrações'` |
| `'Manage'` | `'Manage'` | `'Gerenciar'` |
| `'Quick Actions'` (h3) | `'Quick Actions'` | `'Ações Rápidas'` |
| `'Edit Website'` | `'Edit Website'` | `'Editar Site'` |
| `'Publish Content'` | `'Publish Content'` | `'Publicar Conteúdo'` |
| `'Review Conversations'` | `'Review Conversations'` | `'Revisar Conversas'` |
| `'Qualify Leads'` | `'Qualify Leads'` | `'Qualificar Leads'` |
| `'New'` `'Contacted'` `'Qualified'` `'Converted'` `'Discarded'` (funnelStages labels) | separate keys each | see below |
| `'All forms'` (SelectItem) | already `'All forms'`? | check below |
| `'Form'` (SelectValue placeholder) | `'Form'` | `'Formulário'` — already in dict |
| `'Enabled'` `'Disabled'` `'Configured'` `'Disconnected'` (integration status) | `'Enabled'` etc. | `'Habilitado'` `'Desabilitado'` `'Configurado'` `'Desconectado'` |

Funnel stage labels in DashboardSection (hardcoded in the `funnelStages` array):
- `'New'` → `'Novo'`
- `'Contacted'` → `'Contatado'`
- `'Qualified'` → `'Qualificado'`
- `'Converted'` → `'Convertido'`
- `'Discarded'` → `'Descartado'`

Integration status labels:
- `'Enabled'` → `'Habilitado'`
- `'Disabled'` → `'Desabilitado'`
- `'Configured'` → `'Configurado'`
- `'Disconnected'` → `'Desconectado'`

**Scope clarification:** The admin panel is primarily used by the site owner in English. DashboardSection has no `useTranslation()` import at all. TRX-04/TRX-05 requirements focus on the 8 named components. DashboardSection's UI strings are not in the TRX-04 list but some strings (like 'Contacted') match the pre-researched audit findings.

### LeadsSection.tsx

LeadsSection does NOT call `useTranslation()`. It has hardcoded strings but since it doesn't use `t()` at all there is nothing to "fix" from a missing-key standpoint. However TRX-04 requires wrapping these. Key hardcoded visible strings:

| String | Key | PT |
|--------|-----|----|
| `'All status'` | `'All status'` | `'Todos os status'` |
| `'Contacted'` (statusOptions label) | `'Contacted'` | `'Contatado'` |
| `'Total'`, `'Hot'`, `'Warm'`, `'Cold'`, `'In Progress'` (stat labels) | — | see dashboard keys above |
| `'Leads'` (SectionHeader title) | `'Leads'` | `'Leads'` |
| `'All captured leads...'` (SectionHeader description) | `'All captured leads with ratings and follow-up status'` | `'Todos os leads capturados com classificações e status de acompanhamento'` |

### SEOSection.tsx

SEOSection does NOT call `useTranslation()`. The `'Contact'` slug label is in `PAGE_SLUG_FIELDS`:

```typescript
{ key: 'contact', label: 'Contact', ... }
```

This label is hardcoded as a string, not wrapped in `t()`. The key `'Contact'` already exists in the dictionary (`'Contato'`). This is TRX-05 scope.

### NewFormDialog.tsx

NewFormDialog does NOT call `useTranslation()`. The `placeholder="e.g. Contact Us"` at line 123 is hardcoded.

| String | Key | PT |
|--------|-----|----|
| `'e.g. Contact Us'` (placeholder) | `'e.g. Contact Us'` | `'ex. Fale Conosco'` |

The dialog title/description strings match the existing dictionary keys exactly (`'New Form'`, `'Name the form and pick a URL slug...'`). But since there's no `t()` call, they are hardcoded English.

### LinksSection.tsx

LinksSection DOES use `useTranslation()`. The issues are:

| File:line | String | Key | Status |
|-----------|--------|-----|--------|
| `LinksSection.tsx:152` | `placeholder="My Portfolio"` | `'My Portfolio'` | NOT in dictionary |
| `LinksSection.tsx:141` | `<Label>Visible</Label>` | `'Visible'` | ALREADY IN DICT |
| `LinksSection.tsx:150` | `<Label>Link Title</Label>` | `'Link Title'` | ALREADY IN DICT |
| `LinksSection.tsx:157` | `<Label>Destination URL</Label>` | `'Destination URL'` | ALREADY IN DICT |

Missing key:
- `'My Portfolio'` → `'Meu Portfólio'`

The `Label` elements use hardcoded strings but those keys exist in the dictionary — they just need to be wrapped with `t()`.

---

## Broken/Wrong Keys

**Confidence: HIGH** — read directly from file.

### not-found.tsx — 2 broken keys

The file uses `t('Page Not Found')` and `t('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.')`.

The dictionary defines:
```typescript
'404 Page Not Found': '404 Página Não Encontrada',
'The page you are looking for does not exist.': 'A página que você procura não existe.',
```

**The mismatch is complete** — the keys used in the component match nothing in the dictionary. Both t() calls fall through to the API.

**Fix:** Update `not-found.tsx` to use the correct keys that ARE defined:
- Change `t('Page Not Found')` → `t('404 Page Not Found')` and update the h2 display accordingly, OR
- Add `'Page Not Found'` as a new key with the correct PT string

The current h2 text is `{t('Page Not Found')}` but the existing dictionary key is `'404 Page Not Found'` (which includes the "404 " prefix that appears separately in the h1). The correct fix is to add a new key `'Page Not Found'` → `'Página Não Encontrada'` to the dictionary (matching what the component actually renders).

Similarly for the paragraph: add `'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'` → `'A página que você procura pode ter sido removida, teve seu nome alterado ou está temporariamente indisponível.'`

The old keys `'404 Page Not Found'` and `'The page you are looking for does not exist.'` would become unused after this fix and should be removed (TRX-06).

---

## Unused Keys

**Confidence: HIGH for identified items; MEDIUM for completeness** — determined by reading the files listed as using t() and cross-referencing.

The following keys are defined in `translations.ts` but have no confirmed `t()` call referencing them anywhere in the active codebase. These are candidates for removal (TRX-06).

### Confirmed Unused (component was audited, key not found)

| Key | Reason unused |
|-----|---------------|
| `'404 Page Not Found'` | `not-found.tsx` uses `t('Page Not Found')` — different key |
| `'The page you are looking for does not exist.'` | `not-found.tsx` uses different string |
| `'Schedule Free Consultation'` | Hero section uses `'Schedule a Free Call'` (also in dict) — verify which is used |
| `'Select Service'` | Booking flow keys — no active Booking pages found using these |
| `'Select Date'` | Same — likely unused booking flow |
| `'Select Time'` | Same |
| `'Your Information'` | Same |
| `'Booking Summary'` | Same |
| `'Total'` | Possibly booking only |
| `'Subtotal'` | Same |
| `'Tax'` | Same |
| `'Confirm Booking'` | Same |
| `'Booking Confirmed'` | Same |
| `'Thank you for your booking!'` | Same |
| `'Open tool'` | Not confirmed used in Portfolio.tsx audit |
| `'Open tool in new tab'` | Same |
| `'Live preview coming in Phase 13'` | Phase 13 placeholder — now superseded |
| `'We help companies achieve unprecedented growth...'` | Not found in component reads |

**Important:** The unused key audit is not fully exhaustive. The planner should run a grep for each key listed above to confirm before deleting. The pattern to check is: `grep -r "'KEY_STRING'" client/src` (with escaped apostrophes where needed). Some keys above may appear in files not read during this research session.

### Definitive grep-confirmation needed for

All keys in the Booking section (11 keys) — no active Booking page was audited. If no active booking flow exists, all are unused.

---

## TypeScript Enforcement Strategy

**Confidence: HIGH** — the fix is a one-line change to `useTranslation.ts`.

### Current (permissive)

```typescript
// useTranslation.ts line 117
const t = useCallback((text: string): string => {
```

### Fix (strict)

```typescript
import { translations as staticTranslations, type TranslationKey } from '@/lib/translations';

const t = useCallback((text: TranslationKey): string => {
```

**Exact steps:**

1. Import `TranslationKey` from `translations.ts` in `useTranslation.ts` (it is already exported from that file).
2. Change the parameter type of `t` from `string` to `TranslationKey`.
3. Update the internal lookup line:
   ```typescript
   // Before:
   const staticValue = staticTranslations.pt[text as keyof typeof staticTranslations.pt];
   // After (cast no longer needed):
   const staticValue = staticTranslations.pt[text];
   ```

**Why this works:** `TranslationKey = keyof typeof translations.pt` is a string literal union of all 321 PT keys. The EN pass-through `if (language === 'en' || !text) return text;` still works because TypeScript treats a `TranslationKey` as assignable to `string` for return purposes.

**Side effect:** Any component calling `t('some undefined key')` will produce a TS compile error: `Argument of type '"some undefined key"' is not assignable to parameter of type 'TranslationKey'`. This is the desired behavior (TRX-08).

**Cascading fix requirement:** After tightening the type, every call site with a missing key will break `npm run check`. The planner MUST ensure all missing keys are added to `translations.ts` BEFORE or IN THE SAME PLAN as the type tightening. The safest order: add keys first, then tighten type, then add `t()` wrappers.

---

## Implementation Order

Low-risk-first ordering for the planner:

### Step 1 (lowest risk): Add all missing/new PT keys to `translations.ts`

Add these to `translations.ts` without touching any component. `npm run check` passes trivially. Keys to add:
- `'Create'` → `'Criar'`
- `'Search presentations...'` → `'Pesquisar apresentações...'`
- `'Failed to create presentation'` → `'Falha ao criar apresentação'`
- `'Page Not Found'` → `'Página Não Encontrada'`
- `'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'` → `'A página que você procura pode ter sido removida, teve seu nome alterado ou está temporariamente indisponível.'`
- `'My Portfolio'` → `'Meu Portfólio'`
- All EstimatesSection keys (~20 new keys)
- All DashboardSection + LeadsSection UI keys (~25 new keys)
- The long BrandGuidelinesSection placeholder (~1 key)
- PrivacyPolicy.tsx + TermsOfService.tsx keys (~100–120 new keys)
- SEOSection/NewFormDialog keys (~2 new keys)

### Step 2: Remove dead keys from `translations.ts`

Remove the 2 confirmed wrong 404 keys and any other confirmed-unused keys. This reduces dictionary size and keeps TRX-06 clean.

### Step 3: Fix not-found.tsx key references

Change the two `t()` call strings to match what's now in the dictionary. One file change, zero risk.

### Step 4: Tighten `t()` TypeScript type

Change `(text: string)` to `(text: TranslationKey)`. After Step 1, `npm run check` should now pass cleanly.

### Step 5: Wrap hardcoded strings in EstimatesSection + DashboardSection + LeadsSection + SEOSection + NewFormDialog + LinksSection

Add `useTranslation()` imports and wrap each hardcoded string. These are the most laborious steps but all keys are already in the dictionary by this point.

---

## Common Pitfalls

### Pitfall 1: Adding the type tightening before all keys are in the dictionary

**What goes wrong:** `npm run check` fails with 50+ type errors across all components that currently call `t()` with strings not yet in the dictionary.
**Prevention:** Always add keys to `translations.ts` first, verify `npm run check` still passes, THEN tighten the `t()` type.

### Pitfall 2: Forgetting to add `useTranslation()` import to components that don't currently use it

**What goes wrong:** EstimatesSection, DashboardSection, LeadsSection, SEOSection, NewFormDialog all have ZERO `t()` usage. The planner must add the import and destructure `{ t }` at the component level.
**How to avoid:** For each component in TRX-04 scope, the plan task must include both: (a) adding the import, and (b) wrapping the strings.

### Pitfall 3: Keys with special characters or apostrophes

**What goes wrong:** Template literal keys with `\n` or keys containing `'` break if not written correctly.
**Prevention:** Use double-quoted keys in `translations.ts` for strings containing apostrophes (e.g., `"Don't close this window..."` is already pattern-matched in the file).

### Pitfall 4: DashboardSection funnelStages array — labels ARE hardcoded data, not JSX

**What goes wrong:** The `funnelStages` array is defined as module-level data; calling `t()` there requires the component to pass `t` into the data structure or define the array inside the component (to access the hook).
**How to avoid:** Move `funnelStages` inside the component function body, after `useTranslation()` is called, and wrap each label with `t()`.

### Pitfall 5: PrivacyPolicy/TermsOfService keys contain punctuation-heavy legal text

**What goes wrong:** Typos in key strings mean the lookup fails silently (API fallback fires).
**Prevention:** Copy-paste keys exactly from the component file rather than retyping them. Use the exact string as the key.

---

## Code Examples

### Correct key addition pattern

```typescript
// Source: client/src/lib/translations.ts (existing pattern)
// In the translations.pt object, add to the appropriate section comment:

// Admin — Estimates Section (Phase 30)
'Create': 'Criar',
'Search presentations...': 'Pesquisar apresentações...',
'Failed to create presentation': 'Falha ao criar apresentação',
'Estimates': 'Orçamentos',
// ... etc
```

### Correct `t()` type tightening

```typescript
// Source: client/src/hooks/useTranslation.ts (change line 117)
// BEFORE:
const t = useCallback((text: string): string => {

// AFTER:
const t = useCallback((text: TranslationKey): string => {
```

### Correct import addition for TranslationKey

```typescript
// Source: client/src/hooks/useTranslation.ts (line 3)
// BEFORE:
import { translations as staticTranslations } from '@/lib/translations';

// AFTER:
import { translations as staticTranslations, type TranslationKey } from '@/lib/translations';
```

### Adding `useTranslation` to a component that lacks it

```typescript
// Example: EstimatesSection.tsx
import { useTranslation } from '@/hooks/useTranslation';

export function EstimatesSection() {
  const { toast } = useToast();
  const { t } = useTranslation();  // ADD THIS LINE
  // ...
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) via `npm run check` |
| Config file | `tsconfig.json` (root) |
| Quick run command | `npm run check` |
| Full suite command | `npm run check` |

No Jest/Vitest test infrastructure detected for the client. The primary automated validation for this phase is TypeScript compilation. After TRX-08 (type tightening), `npm run check` becomes the exhaustive test: any missing key is a compile error.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRX-01 | Every `t()` call resolves to a PT key | compile | `npm run check` | ✅ |
| TRX-02 | 8 named components have correct keys | compile | `npm run check` | ✅ |
| TRX-03 | "Back to X" variants defined | compile | `npm run check` | ✅ |
| TRX-04 | No hardcoded admin strings | manual review | `npm run check` (partial) | ✅ |
| TRX-05 | Placeholder/label strings use `t()` | manual review | `npm run check` (partial) | ✅ |
| TRX-06 | No dead keys | manual / grep | `grep -r "'KEY'" client/src` per key | ✅ |
| TRX-07 | No duplicate keys | manual / grep | Grep for duplicate key strings in translations.ts | ✅ |
| TRX-08 | `t()` rejects non-keys at compile time | compile | `npm run check` | ✅ |
| TRX-09 | `npm run check` passes | compile | `npm run check` | ✅ |
| TRX-10 | 404 page key fixed | manual + compile | `npm run check` (verifies key exists) | ✅ |
| TRX-11 | PT strings are correct Brazilian Portuguese | manual review | — | N/A |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green + manual PT browser review before `/gsd:verify-work`

### Wave 0 Gaps

None — no new test infrastructure needed. TypeScript itself is the test harness for this phase.

---

## Project Constraints (from CLAUDE.md)

- **Translation rule:** Always add PT static translations to `client/src/lib/translations.ts` when introducing new `t()` strings
- **Border styling:** Never solid black/white borders; use hairline `--border` token via `border` class
- **Admin design system:** Use global SectionHeader via Admin.tsx, AdminCard/EmptyState/FormGrid primitives, neutral charcoal dark theme, max 600 lines/file
- **Tech stack:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS — no new dependencies needed for this phase
- **File size limit:** Max 600 lines per file — `translations.ts` will grow significantly; verify it stays readable (currently ~400 lines; with ~150 new keys will be ~550–600 lines)

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is code/config changes only)

---

## Open Questions

1. **PrivacyPolicy.tsx + TermsOfService.tsx key count**
   - What we know: These files use ~100–120 `t()` calls with long legal text strings not in the dictionary
   - What's unclear: Exact count; whether any strings are shared between the two files
   - Recommendation: Read both files in full during the planning/implementation step; add all keys in a single plan task dedicated to these two files

2. **Booking section keys — are they live or dead?**
   - What we know: 11 booking-flow keys exist in the dictionary; no active booking pages were found using `useTranslation()` in this audit
   - What's unclear: Whether any booking component still calls `t()` with these keys
   - Recommendation: Run `grep -r "Confirm Booking\|Select Service\|Select Date\|Select Time\|Your Information\|Booking Summary\|Booking Confirmed" client/src` before removing; if zero hits, delete all 11

3. **DashboardSection translation scope — admin-only vs public**
   - What we know: TRX-04 requirement names DashboardSection explicitly
   - What's unclear: Whether the intent is full translation of all dashboard strings (performance metrics, funnel labels) or only the strings in the pre-researched audit (Contacted, Total Contacts, This Week, This Month)
   - Recommendation: Treat the explicit pre-researched audit list as the minimum; add the remaining obvious UI strings in the same pass since `useTranslation()` will be imported anyway

---

## Sources

### Primary (HIGH confidence)

- Direct file reads: `client/src/lib/translations.ts` (full content)
- Direct file reads: `client/src/hooks/useTranslation.ts` (full content)
- Direct file reads: `client/src/context/LanguageContext.tsx` (full content)
- Direct file reads: `PresentationsSection.tsx`, `DashboardSection.tsx`, `EstimatesSection.tsx`, `LeadsSection.tsx`, `SEOSection.tsx`, `NewFormDialog.tsx`, `LinksSection.tsx`, `not-found.tsx` (full content)
- Grep: all `t()` calls across `client/src/**/*.tsx`
- Direct reads: `.planning/REQUIREMENTS.md` v1.7 section, `STATE.md`, `ROADMAP.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)

None — all findings sourced from direct reads.

---

## Metadata

**Confidence breakdown:**
- Translation system architecture: HIGH — read from source
- Missing keys: HIGH — cross-referenced t() calls against dictionary
- Hardcoded strings: HIGH — read from component files; EstimatesSection and DashboardSection confirmed as having zero `useTranslation()` usage
- TypeScript enforcement strategy: HIGH — the type already exists, change is mechanical
- Unused keys: MEDIUM — identified pattern but exhaustive confirmation requires per-key grep

**Research date:** 2026-05-03
**Valid until:** This research is based on static file reads; remains valid until files change. Re-verify before planning if files have been edited.
