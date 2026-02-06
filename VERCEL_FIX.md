# 🔧 Correção de Erros 500 no Vercel

## Problema Identificado

Suas variáveis de ambiente estão no Vercel, mas **faltam 2 variáveis críticas** que estão causando os erros 500:

## ❌ Variáveis Faltando no Vercel

### 1. `SESSION_SECRET` (CRÍTICO)
**Erro causado:** Sessões não podem ser criadas, causando falha em todas as requisições autenticadas

**Como adicionar:**
1. No Vercel, vá em **Settings → Environment Variables**
2. Adicione: `SESSION_SECRET`
3. Valor: Gere um string aleatório seguro (veja exemplos abaixo)

**Gerar valor seguro:**
```bash
# Windows PowerShell
Add-Type -AssemblyName System.Web
[System.Web.Security.Membership]::GeneratePassword(32,0)

# Ou use: https://randomkeygen.com/
# Use "Fort Knox Passwords" ou "CodeIgniter Encryption Keys"
```

Exemplo: `A7xK9mP2nR5vB8qC1wD4eF6gH3jL0tN7sM9pQ2rU5vX8y`

### 2. `ADMIN_EMAIL` (CRÍTICO)  
**Erro causado:** Sistema não consegue identificar qual usuário é administrador

**Como adicionar:**
1. No Vercel: **Settings → Environment Variables**
2. Adicione: `ADMIN_EMAIL`
3. Valor: O email que você usa para login no Supabase

Exemplo: `seu-email@exemplo.com`

## ✅ Variáveis Já Configuradas (OK)

Estas já estão corretas:
- ✓ `POSTGRES_URL` - Conexão com banco de dados
- ✓ `SUPABASE_URL` - URL do projeto Supabase
- ✓ `SUPABASE_ANON_KEY` - Chave pública
- ✓ `SUPABASE_SERVICE_ROLE_KEY` - Chave privada (admin)

## 📋 Passo a Passo para Corrigir

### Opção 1: Via Dashboard do Vercel (Recomendado)

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables

2. **Adicione SESSION_SECRET:**
   - Nome: `SESSION_SECRET`
   - Valor: (gere um usando os comandos acima)
   - Environments: ☑ Production ☑ Preview ☑ Development

3. **Adicione ADMIN_EMAIL:**
   - Nome: `ADMIN_EMAIL`
   - Valor: `seu-email@dominio.com`
   - Environments: ☑ Production ☑ Preview ☑ Development

4. **Clique em "Save"**

5. **Redeploy:** 
   - Vá em "Deployments" 
   - No último deployment, clique nos "..." 
   - Clique em "Redeploy"

### Opção 2: Via Vercel CLI

```bash
# Instalar Vercel CLI (se ainda não tem)
npm i -g vercel

# Login
vercel login

# Adicionar variáveis
vercel env add SESSION_SECRET
# Cole o valor quando solicitado

vercel env add ADMIN_EMAIL  
# Digite seu email quando solicitado

# Redeploy
vercel --prod
```

## 🧪 Como Verificar Se Funcionou

Após adicionar as variáveis e fazer redeploy:

1. Abra o console do navegador em: `https://seu-projeto.vercel.app`
2. Os erros 500 devem desaparecer
3. Você deve ver as chamadas API retornando 200

**Endpoints que devem funcionar:**
- ✓ `/api/supabase-config` → 200
- ✓ `/api/admin/session` → 200  
- ✓ `/api/company-settings` → 200
- ✓ `/api/categories` → 200
- ✓ `/api/services` → 200

## ⚠️ Dica Importante

**Sempre adicione variáveis de ambiente em todos os ambientes:**
- ☑ **Production** (site ao vivo)
- ☑ **Preview** (branches de teste)
- ☑ **Development** (desenvolvimento local via `vercel dev`)

## 🔒 Segurança

✅ **Suas variáveis Supabase e Postgres estão seguras** - elas estão marcadas como "Sensitive" no Vercel

❌ **Nunca:**
- Commite `.env` para o Git
- Exponha `SERVICE_ROLE_KEY` no frontend
- Compartilhe `SESSION_SECRET` publicamente

## 📞 Após Adicionar

Quando adicionar as variáveis e fazer redeploy, me avise para verificarmos se os erros foram corrigidos!

## Resumo Rápido

```env
# ADICIONE NO VERCEL:
SESSION_SECRET=<gere-um-valor-aleatorio-seguro>
ADMIN_EMAIL=seu-email@dominio.com

# JÁ TEM (não precisa mexer):
✓ POSTGRES_URL
✓ SUPABASE_URL
✓ SUPABASE_ANON_KEY
✓ SUPABASE_SERVICE_ROLE_KEY
```
