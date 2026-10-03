# Skale NFC — PWA em skale.club/nfc

Plano de execução. Criado em 2026-10-03.

## Objetivo

Um app de celular (PWA instalável) em `skale.club/nfc`, só para admin, que substitui o NFC Tools no dia a dia da Skale: bater o NFC ou escanear o QR de uma plaquinha, editar o link e deixar ativo na hora.

## Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Aparelhos | Android é o principal (lê e grava NFC pelo app). iPhone também é usado: lá o app não grava chip, então entrega o link pronto para copiar e colar no NFC Tools. |
| Link para copiar | Aparece sempre na tela de gravação, no Android também. |
| Plaquinhas do cliente | Ficam registradas num log simples (cliente, link, data), sem código público e sem analytics. |
| Cliente para ativar | Continua obrigatório; o app deixa escolher um existente ou criar pelo nome no mesmo passo. |
| Idioma do app | pt-BR fixo, como o Review Link (sem `t()`). |
| Login | Loga uma vez e o aparelho fica confiável por 180 dias, renovados a cada uso. Sem pedir senha de novo nesse período. |
| Face ID | Passkey do aparelho (Face ID no iPhone, digital ou rosto no Android). Entra sem senha quando a sessão acabar. Bloqueio por biometria ao abrir o app é opcional e vem desligado. |

## Os dois tipos de plaquinha

O app classifica tudo o que lê (chip, QR ou código digitado) e abre uma tela diferente para cada tipo.

| | Plaquinha Skale | Plaquinha do cliente (link direto) |
| --- | --- | --- |
| O que está no chip/QR | `skale.club/n/CÓDIGO` ou `/q/CÓDIGO` | o link do próprio cliente |
| Trocar o link | no sistema, sem tocar no chip | regravando o chip |
| Analytics | sim | não |
| Registro | tabela `smart_tags` | log `smart_tag_direct_writes` |
| Cor na tela | azul (`#5173D6`) | esmeralda |
| Selo | "Tag Skale" | "Link direto do cliente" |

Chip vazio abre a escolha entre os dois caminhos.

## Limites da plataforma

- Web NFC só existe no Chrome para Android. Safari e qualquer navegador no iPhone não leem nem gravam chip por página web.
- No iPhone o app funciona com câmera (QR), código digitado e edição de link. Para gravar, mostra o link com botão de copiar e o passo a passo do NFC Tools, e depois um "Marcar como gravado".
- No iPhone, encostar uma tag Skale ainda sem destino abre a página "tag inativa", que passa a ter o atalho "Configurar" direto para o app.

## Etapas

### 1. Regras compartilhadas — feito

- `shared/nfcApp.ts`: `classifyScan` (Skale, direto, texto, vazio), `normalizeUrlInput`, `guessDestinationType`, `decidePhoneWrite`.
- `shared/nfcApp.test.ts`: testes das quatro funções.

### 2. Banco e servidor — escrito, falta registrar

- Migration `supabase/migrations/20261003120000_smart_tag_direct_writes.sql` e tabela no `shared/schema/smartTags.ts`.
- `server/lib/smartTags/mobile.ts`:
  - `quickActivateTag`: link + cliente + ativação numa transação, com histórico e as mesmas regras do admin.
  - `recordPhoneWrite`: marca o chip como `verified` só se a URL lida de volta for exatamente a esperada; sem leitura de volta fica `programmed`.
  - `recordDirectWrite` e `listDirectWrites`.
- `server/routes/smartTagsMobile.ts`:
  - `POST /api/admin/smart-tags/:id/quick-activate`
  - `POST /api/admin/smart-tags/:id/nfc-written`
  - `GET` e `POST /api/admin/smart-tag-direct-writes`
- Falta:
  - registrar as rotas em `server/routes.ts`;
  - incluir as rotas novas no teste de "anônimo recebe 401";
  - `publicHandler.ts`: atalho "Configurar" passa a apontar para `/nfc/t/CÓDIGO` (ajustar o teste).

### 3. Rota `/nfc` e PWA

- `shared/reservedSlugs.ts`: reservar `nfc`.
- `server/seo/routes.ts` e `shared/coreSeo.ts`: `/nfc` responde 200 e fica noindex. `/nfc-guide`, `/nfc-order` e `/nfc-keychains` não são afetados (o match é por segmento).
- `client/public/sw.js`: `/nfc` fora do cache.
- `client/public/nfc.webmanifest`: escopo `/nfc/`, início em `/nfc/home`, standalone, tema navy.
- `client/src/App.tsx` e `AdminShell.tsx`: `/nfc` e `/nfc/*` entram no shell autenticado; `/nfc/login` usa a tela de login existente para não sair do app instalado.
- `AdminLogin.tsx`: aceitar `next=/nfc...`.
- `client/src/lib/attribution.ts`: ignorar `/nfc` como já ignora `/admin`.

### 4. Login persistente e Face ID

Hoje a sessão do admin dura 7 dias fixos, contados do login, e depois pede senha (ou Google) de novo. Para o app isso muda em duas frentes.

**Aparelho confiável**

- O login feito dentro do app marca a sessão como "aparelho confiável": cookie de 180 dias, renovado a cada uso. Usando o app pelo menos uma vez a cada seis meses, ele nunca pede login.
- Vale só para sessões criadas pelo app. O painel admin no computador continua com os 7 dias atuais.
- `server/auth/supabaseAuth.ts`: `POST /api/auth/trust-device` (exige sessão admin) estende a sessão e grava o nome do aparelho; um middleware renova o prazo das sessões confiáveis.
- Tela "Aparelhos" no app: lista os aparelhos confiáveis e permite revogar qualquer um (celular perdido ou trocado).

**Face ID (passkey)**

- Depois do primeiro login, o app oferece "Ativar Face ID neste aparelho". Isso cria uma passkey: Face ID no iPhone, digital ou rosto no Android. No iPhone ela sincroniza pelo iCloud.
- Quando a sessão acabar (ou após sair), a tela de login mostra "Entrar com Face ID" como botão principal; senha e Google ficam como alternativa.
- Entrar com Face ID já cria a sessão de aparelho confiável.
- Bloqueio do app: opção "Pedir Face ID ao abrir", desligada por padrão, para não incomodar. Ligada, pede biometria ao abrir o app depois de um tempo parado.
- Implementação:
  - dependências novas: `@simplewebauthn/server` e `@simplewebauthn/browser`;
  - tabela `admin_passkeys` (usuário, credencial, chave pública, contador, nome do aparelho, último uso) em migration própria;
  - `server/routes/passkeys.ts`: opções e verificação de cadastro (exigem sessão admin), opções e verificação de login (públicas, com rate limit), listar e revogar;
  - só usuários admin podem cadastrar ou entrar por passkey;
  - `rpID` `skale.club`, que cobre produção e staging; `localhost` em desenvolvimento.

**Limites**

- No iPhone, o app instalado na tela de início tem armazenamento separado do Safari: o primeiro login precisa ser feito dentro do app instalado.
- Sessão longa em celular é uma troca consciente de segurança por conveniência. As proteções são: cookie `httpOnly` e `secure`, lista de aparelhos com revogação e o bloqueio opcional por biometria.

### 5. Leitura e gravação (`client/src/components/nfc-app/`)

- `webNfc.ts`: um `NDEFReader` por sessão; ler, gravar no próximo toque e conferir no toque seguinte; erros traduzidos (sem permissão, NFC desligado, chip protegido, chip retirado no meio).
- `QrScanner.tsx`: câmera traseira, `BarcodeDetector` com fallback para jsQR, lanterna quando o aparelho permite.
- Código digitado como terceira entrada.
- Leituras repetidas da mesma plaquinha encostada no celular são ignoradas.

### 6. Telas

- **Login** (`/nfc/login`): "Entrar com Face ID" quando o aparelho já tem passkey; senha e Google como alternativa.
- **Aparelhos** (`/nfc/devices`): aparelhos confiáveis e passkeys, com revogar; liga e desliga "Pedir Face ID ao abrir".
- **Início** (`/nfc/home`): "Aproximar NFC", "Escanear QR", campo de código, "Gravar link direto", recentes.
- **Tag Skale** (`/nfc/t/CÓDIGO`): código, status, chip, destino atual; campo de link com colar; tipo de destino sugerido; cliente; "Salvar e ativar"; desativar e reativar; "Gravar chip"; contadores de taps e scans.
- **Link direto** (`/nfc/direct`): link lido do chip, novo link, cliente opcional, "Gravar no chip", últimos links diretos.
- **Nova tag Skale** (`/nfc/new`): cria uma tag avulsa e segue para gravar o chip.
- **Gravar chip** (folha comum às duas): link com botão de copiar sempre visível; no Android grava e confere; no iPhone mostra o passo a passo do NFC Tools e "Marcar como gravado".

Visual: navy `#0A162E`, Inter, botões pill em `#5173D6`, bordas hairline, alvos de toque grandes, safe areas. Nenhum arquivo acima de 600 linhas.

### 7. Verificação

- `npm run check` e `npm test`.
- Testes de servidor para passkeys: cadastro exige admin, login recusa credencial desconhecida ou revogada, contador de uso não pode regredir.
- Face ID real só se valida no aparelho (iPhone e Android), no staging.
- Preview em viewport de celular: login, QR, código digitado, edição, ativação, link direto. O preview local usa o banco de produção e liga os crons, então é parado logo após conferir.
- Gravação NFC real só se valida num Android físico, no staging.

### 8. Entrega

- Aplicar as duas migrations em produção (`DATABASE_URL="$POSTGRES_URL" npm run db:migrate -- --apply`) antes do deploy: `smart_tag_direct_writes` e `admin_passkeys`. Sem elas, o registro de link direto e o Face ID falham; o resto funciona.
- Commit apenas dos arquivos desta tarefa (o checkout é compartilhado), depois push para `main`.
- Teste em campo no staging: instalar o app, ativar o Face ID, fechar e reabrir sem pedir login, gravar uma tag Skale e uma de cliente, conferir no admin.

## Fora desta versão

- Travar o chip (irreversível).
- Gravação em lote com avanço automático.
- Uso offline.
- App nativo para gravar NFC no iPhone.
