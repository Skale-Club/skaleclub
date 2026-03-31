# Plano: Renomear "Accounts" para "Leads"

## Escopo

Renomear o módulo "Accounts" (Sales Accounts) para "Leads" em todo o codebase, incluindo nomes de arquivos, schemas, tipos, rotas API, variáveis, funções e strings de UI.

---

## Etapas

### 1. Renomear arquivos (3 arquivos)

| Arquivo atual | Novo nome |
|---|---|
| `client/src/pages/xpot/XpotAccounts.tsx` | `XpotLeads.tsx` |
| `client/src/pages/xpot/hooks/useAccounts.ts` | `useLeads.ts` |
| `server/routes/xpot/accounts.ts` | `leads.ts` |

### 2. Criar migration SQL para renomear tabelas/colunas/enum no banco

Nova migration para renomear:
- Enum: `sales_account_status` → `sales_lead_status`
- Tabela: `sales_accounts` → `sales_leads`
- Tabela: `sales_account_locations` → `sales_lead_locations`
- Tabela: `sales_account_contacts` → `sales_lead_contacts`
- Colunas `account_id` → `lead_id` em: `sales_lead_locations`, `sales_lead_contacts`, `sales_visits`, `sales_opportunities_local`, `sales_tasks`
- Índices: renomear todos os 8 índices

### 3. Atualizar schema Drizzle (`shared/schema/sales.ts`)

- `salesAccountStatusEnum` → `salesLeadStatusEnum`
- `salesAccounts` → `salesLeads`
- `salesAccountLocations` → `salesLeadLocations`
- `salesAccountContacts` → `salesLeadContacts`
- `accountId` → `leadId` em todas as tabelas
- `insertSalesAccountSchema` → `insertSalesLeadSchema`
- `insertSalesAccountLocationSchema` → `insertSalesLeadLocationSchema`
- `insertSalesAccountContactSchema` → `insertSalesLeadContactSchema`
- Tipos: `SalesAccount` → `SalesLead`, `InsertSalesAccount` → `InsertSalesLead`, etc.

### 4. Atualizar `shared/xpot.ts`

- Imports renomeados
- `xpotAccountCreateSchema` → `xpotLeadCreateSchema`
- `xpotAccountUpdateSchema` → `xpotLeadUpdateSchema`
- `xpotAccountContactCreateSchema` → `xpotLeadContactCreateSchema`
- Tipos renomeados

### 5. Atualizar `server/storage.ts`

- Imports renomeados
- Tipos renomeados
- Métodos: `listSalesAccounts` → `listSalesLeads`, `getSalesAccount` → `getSalesLead`, etc. (9 métodos)
- Todas as referências a `salesAccounts.*` → `salesLeads.*`
- `accountId` → `leadId` em query filters
- Entity type string `"sales_account"` → `"sales_lead"`
- SQL inline no `ensureSalesSchema` (CREATE TYPE, CREATE TABLE, FKs, índices)

### 6. Atualizar `server/routes/xpot/leads.ts` (renomeado de accounts.ts)

- `createAccountsRouter` → `createLeadsRouter`
- Rotas: `/accounts` → `/leads`
- Variáveis: `account` → `lead`, `accounts` → `leads`
- Imports renomeados

### 7. Atualizar `server/routes/xpot/index.ts`

- Import: `./accounts.js` → `./leads.js`
- `createAccountsRouter` → `createLeadsRouter`

### 8. Atualizar `server/routes/xpot/helpers.ts`

- `syncAccountToGhl` → `syncLeadToGhl`
- Todas as referências a `account` → `lead`
- Entity type strings `"sales_account"` → `"sales_lead"`
- Mensagens de erro: "Account not found" → "Lead not found", etc.

### 9. Atualizar demais arquivos server

- `server/routes/xpot/visits.ts` — `accountId` → `leadId`, `getSalesAccount` → `getSalesLead`, etc.
- `server/routes/xpot/auth.ts` — `getSalesAccount` → `getSalesLead`
- `server/routes/xpot/dashboard.ts` — `listSalesAccounts` → `listSalesLeads`, `assignedAccounts` → `assignedLeads`
- `server/routes/xpot/opportunities.ts` — `getSalesAccount` → `getSalesLead`
- `server/routes/xpot/sync.ts` — `syncAccountToGhl` → `syncLeadToGhl`, imports
- `server/routes/xpot/admin.ts` — `listSalesAccounts` → `listSalesLeads`

### 10. Atualizar `client/src/pages/xpot/types.ts`

- `SalesAccount` → `SalesLead`
- `SalesAccountLocation` → `SalesLeadLocation`
- `SalesAccountPayload` → `SalesLeadPayload`
- `accountId` → `leadId`
- `assignedAccounts` → `assignedLeads`

### 11. Atualizar `client/src/pages/xpot/hooks/useLeads.ts` (renomeado de useAccounts.ts)

- `useAccounts` → `useLeads`
- Todas as variáveis internas: `accountLookupSearch` → `leadLookupSearch`, `accountForm` → `leadForm`, `selectedAccountPlace` → `selectedLeadPlace`, `filteredAccountsForList` → `filteredLeadsForList`, `accountPlaceQuery` → `leadPlaceQuery`
- Funções: `applyPlaceToAccountForm` → `applyPlaceToLeadForm`, `createAccountFromForm` → `createLeadFromForm`
- Query keys: `"/api/xpot/accounts"` → `"/api/xpot/leads"`
- API paths atualizados
- `createAccountMutation` → `createLeadMutation`, `deleteAccountMutation` → `deleteLeadMutation`

### 12. Atualizar `client/src/pages/xpot/hooks/useCheckIn.ts`

- `findMatchingAccount` → `findMatchingLead`
- `useAccounts` → `useLeads`
- `selectedAccountId` → `selectedLeadId`
- `selectedAccount` → `selectedLead`
- `filteredAccountsForCheckIn` → `filteredLeadsForCheckIn`
- `pickLocalAccountForCheckIn` → `pickLocalLeadForCheckIn`
- `pickGooglePlaceForCheckIn` → `pickGooglePlaceForCheckIn`
- `createNewCompanyFromSearch` → `createNewCompanyFromSearch` (manter, não é account-specific)
- Tipos atualizados

### 13. Atualizar `client/src/pages/xpot/hooks/useSales.ts`

- `accountId` → `leadId` em forms e payloads

### 14. Atualizar `client/src/pages/xpot/hooks/useXpotQueries.ts`

- `accountsSynced` → `leadsSynced`
- Imports atualizados

### 15. Atualizar `client/src/pages/xpot/hooks/useXpotShared.ts`

- Query key: `"/api/xpot/accounts"` → `"/api/xpot/leads"`

### 16. Atualizar `client/src/pages/xpot/XpotLeads.tsx` (renomeado de XpotAccounts.tsx)

- Componente: `XpotAccounts` → `XpotLeads`
- Todas as variáveis e funções destruídas do hook
- `leadPendingDelete` type: `SalesAccount` → `SalesLead`
- Inputs e bindings atualizados

### 17. Atualizar `client/src/pages/xpot/XpotCheckIn.tsx`

- Imports e uso de `useLeads` em vez de `useAccounts`
- `selectedAccountId` → `selectedLeadId`
- `selectedAccount` → `selectedLead`
- `filteredAccountsForCheckIn` → `filteredLeadsForCheckIn`
- `findMatchingAccount` → `findMatchingLead`
- `pickLocalAccountForCheckIn` → `pickLocalLeadForCheckIn`

### 18. Atualizar `client/src/pages/xpot/XpotVisits.tsx`

- `visit.account?.name` → `visit.lead?.name`
- `visit.accountId` → `visit.leadId`

### 19. Atualizar `client/src/pages/xpot/XpotSales.tsx`

- `useAccounts` → `useLeads`
- `accountsQuery` → `leadsQuery`
- `opportunityForm.accountId` → `opportunityForm.leadId`
- `opportunity.account?.name` → `opportunity.lead?.name`
- `opportunity.accountId` → `opportunity.leadId`

### 20. Atualizar `client/src/pages/xpot/XpotDashboard.tsx`

- `visit.account?.name` → `visit.lead?.name`
- `visit.accountId` → `visit.leadId`

### 21. Atualizar `client/src/pages/XpotApp.tsx`

- Import: `XpotAccounts` → `XpotLeads`
- `activeTab === "accounts"` → `activeTab === "leads"`
- `activeVisit.account?.name` → `activeVisit.lead?.name`
- `activeVisit.accountId` → `activeVisit.leadId`

### 22. Atualizar `client/src/pages/xpot/utils.ts`

- Tab id: `"accounts"` → `"leads"`
- `findMatchingAccount` → `findMatchingLead`
- Tipos atualizados

### 23. Atualizar `client/src/components/admin/XpotSalesSection.tsx`

- `accounts: number` → `leads: number`
- Key: `"accounts"` → `"leads"`

### 24. Atualizar migrations SQL existentes (documentação histórica)

- `migrations/0024_create_sales_schema.sql` — atualizar nomes
- `supabase/migrations/20260323130000_field_sales_platform.sql` — atualizar nomes

### 25. Verificação final

- `npm run check` para garantir que não há erros de TypeScript
- Busca por "Account" restante no codebase para confirmar que tudo foi coberto

---

## Arquivos afetados (~25 arquivos de produção)

1. `shared/schema/sales.ts`
2. `shared/xpot.ts`
3. `server/storage.ts`
4. `server/routes/xpot/accounts.ts` → `leads.ts`
5. `server/routes/xpot/index.ts`
6. `server/routes/xpot/helpers.ts`
7. `server/routes/xpot/visits.ts`
8. `server/routes/xpot/auth.ts`
9. `server/routes/xpot/dashboard.ts`
10. `server/routes/xpot/opportunities.ts`
11. `server/routes/xpot/sync.ts`
12. `server/routes/xpot/admin.ts`
13. `client/src/pages/xpot/XpotAccounts.tsx` → `XpotLeads.tsx`
14. `client/src/pages/xpot/hooks/useAccounts.ts` → `useLeads.ts`
15. `client/src/pages/xpot/hooks/useCheckIn.ts`
16. `client/src/pages/xpot/hooks/useSales.ts`
17. `client/src/pages/xpot/hooks/useXpotQueries.ts`
18. `client/src/pages/xpot/hooks/useXpotShared.ts`
19. `client/src/pages/xpot/XpotCheckIn.tsx`
20. `client/src/pages/xpot/XpotVisits.tsx`
21. `client/src/pages/xpot/XpotSales.tsx`
22. `client/src/pages/xpot/XpotDashboard.tsx`
23. `client/src/pages/xpot/types.ts`
24. `client/src/pages/xpot/utils.ts`
25. `client/src/pages/XpotApp.tsx`
26. `client/src/components/admin/XpotSalesSection.tsx`
27. `migrations/0024_create_sales_schema.sql`
28. `supabase/migrations/20260323130000_field_sales_platform.sql`
