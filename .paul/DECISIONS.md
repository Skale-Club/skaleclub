# Product Decisions — Xpot

*Fechado em: 2026-04-06*

---

## 1. Ownership de lead

**Decisão:** Lead pertence ao rep que criou. Manager e admin veem todos os leads, com filtro por rep individual.

**Regras:**
- Rep: vê e edita apenas os próprios leads e visitas
- Manager: vê todos os leads e visitas; pode filtrar por rep
- Admin: acesso total

---

## 2. Sync para GHL

**Decisão:** Manual. O rep controla o que vai para o GHL via botão explícito.

**Regras:**
- Prospects **nunca** são sincronizados automaticamente
- Leads e visitas só vão para o GHL quando o rep clicar em "Enviar para GHL"
- Check-out não dispara sync automático
- Falha de sync → gravada em `sales_sync_events`, visível para o rep

---

## 3. Modo offline

**Decisão:** Online-only. Sem fila offline.

**Regras:**
- Se offline: bloquear check-in, check-out e sync com mensagem clara
- Navegação e consulta de dados já carregados: permitidos
- Mensagem: "Sem conexão. Conecte-se para continuar."
- Revisar essa decisão se virar dor real para os reps no campo
