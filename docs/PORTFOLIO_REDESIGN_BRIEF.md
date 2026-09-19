# Brief — Redesign do Portfólio, Serviços e Folder

> **Status (2026-09-18): executado.** Passos 0–7 da seção 5 implementados:
> `shared/catalog.ts` (CatalogItem + `category`), `components/catalog/`
> (CatalogCard, CatalogDetail, Cover), `/portfolio` refeito, home migrada,
> Admin com limites e preview, folder lendo o mesmo modelo. Decisões tomadas:
> capa **A** (home real numa janela), faixa de prova só com números tirados do
> catálogo (o "3 dias" ficou de fora por não ser verificável), popup conforme
> o mockup. Em aberto: `/print/folder` segue público (seção 6); drop das
> colunas de estilo por item; capas de Xsites, Xphere e Xtimator (sem site
> público: sobem pelo Admin em "Website home").

**Data:** 2026-09-18
**Para:** a próxima conversa que for executar este trabalho. Este documento é o
ponto de partida; leia inteiro antes de abrir qualquer arquivo.
**Origem:** o dono aprovou com entusiasmo o design de uma apresentação feita
para outro projeto dele (Stuscle) e considera o portfólio daqui "pobre e feio".
O pedido é levar **aquele nível de design e aquela coerência de estrutura** para
cá — não aquelas cores.

**Referência visual:** `docs/reference/stuscle-showcase-mockup.html`. Abra no
navegador antes de tudo (setas navegam, o botão "Portrait" mostra a
recomposição). É a régua de qualidade. A seção 2 explica *por que* ele funciona,
que é o que se transfere.

**Complementa, não substitui:** `docs/PUBLIC_PAGES_DESIGN_REVIEW.md`
(2026-09-13) — auditoria do site público inteiro. Parte dela já foi corrigida
(os tokens `--cta`, `--surface-dark` e `--font-display: Outfit` hoje existem em
`index.css`). Este brief cobre só o recorte abaixo, mais fundo, e com direção
de design, que aquele documento não dá.

---

## 0. Antes de tocar em qualquer coisa

### Há ~1000 linhas de trabalho não commitado exatamente nestes arquivos

`git status` em 2026-09-18 (branch `main`, igual a `origin/main`):

```
 M client/src/components/PortfolioCard.tsx            (442 linhas alteradas)
 M client/src/components/ServiceDetailModal.tsx       (182)
 M client/src/pages/Portfolio.tsx                     (527)
 M client/src/components/admin/portfolio/PortfolioServiceForm.tsx
 M client/src/components/home/ServicesCarousel.tsx
 M client/src/components/home/ServicesSection.tsx
 M client/src/print/items.ts
 M client/src/lib/translations.ts
 M shared/schema/cms.ts
?? client/src/components/home/ProjectPreview.tsx
?? migrations/0057_portfolio_dashboard_preview.sql
?? scripts/migrate-portfolio-previews.ts
```

Consequências:

- **Produção ≠ árvore local.** O que está em `skale.club/portfolio` é o commit
  `81a7971`; o que está no disco é outra página (hero com grade de pontos,
  faixa de métricas, filtros por categoria, cards com preço). Não assuma que o
  que você lê é o que o dono vê.
- **Não descarte esse trabalho.** Pergunte ao dono se é dele ou de outra
  conversa e se é para manter. Se sim: commit numa branch antes de começar. Se
  não souber: `git stash` nunca, branch sempre.
- Esse WIP introduz `home_image_url` / `dashboard_image_url` (migration 0057,
  ainda não rastreada pelo git — **não foi verificado se já rodou no banco**) e
  o `ProjectPreview` que alterna as duas imagens no card. A ideia é boa e este brief a aproveita (seção 4.3).

### A fonte da verdade do azul

`DESIGN_SYSTEM.md` se contradiz (`#5173D6` no topo, `#406EF1` nas seções de
baixo) e o `CLAUDE.md` diz `#406EF1`. O código diz `#5173D6` (`--cta` em
`index.css:13`, `INK.cta` em `print/primitives.tsx`). **Vale o código.**
Corrigir os dois docs é o primeiro commit deste trabalho, para a próxima pessoa
não herdar a dúvida.

---

## 1. O que existe hoje (lido no código e visto em produção)

### 1.1 Dois catálogos, modelados de formas diferentes

| | Produtos ("Our Apps") | Serviços prestados ("Our Services") |
|---|---|---|
| Exemplos | Xareable, Xsites, Xkedule, XmartMenu, Xphere, Xtimator | Paid Advertising, Branding, Content Creation, 3D Printing |
| Onde mora | tabela `portfolio_services` (`shared/schema/cms.ts:103`) | JSON em `company_settings.homepage_content.ourServicesSection.cards` (`shared/schema/settings.ts:380`) |
| Tem id / slug / preço | sim / sim / sim | **não** / não / não |
| Editado em | Admin → Portfolio | Admin → Website → Our Services |
| Aparece em | `/portfolio`, carrossel da home, folder | carrossel da home, folder |

### 1.2 Três famílias de card, dois popups, três templates de folder

| Peça | Arquivo | Observação |
|---|---|---|
| Página | `client/src/pages/Portfolio.tsx` (407 l.) | hero + métricas + filtros + grid + CTA |
| Card web (cheio) | `client/src/components/PortfolioCard.tsx` (360 l.) | modo `compact=false` |
| Card web (compacto) | mesmo arquivo, `compact=true` | usado nos carrosséis da home |
| Card de serviço na home | `home/OurServicesSection.tsx` | **finge** ser produto: `as unknown as PortfolioService` |
| Popup de produto | `components/ServiceDetailModal.tsx` (**700 l.**) | três árvores JSX, uma por breakpoint |
| Popup de serviço | `home/OurServiceDetailModal.tsx` (92 l.) | `Dialog` do shadcn, outro visual |
| Folder (casca) | `pages/PrintFolder.tsx` (589 l.) | geometria em mm, sangria, CMYK |
| Folder (cards) | `print/cards.tsx` | `AppCard`, `ServiceCard`, `ServiceListItem` |
| Folder (templates) | `print/templates/{editorial,showcase,catalog}.tsx` | |
| Normalização | `print/items.ts` → `FolderItem` | **a única peça que trata os dois catálogos como um** |

### 1.3 O que está errado — estrutura

1. **Categoria por adivinhação de string.** `getServiceCategory()` em
   `Portfolio.tsx:23` decide a aba por `slug.includes("phere")`,
   `title.includes("ai")` etc. Esse último casa com qualquer título que
   contenha as letras "ai" — um produto chamado "Xm**ai**l" ou "Xp**ai**d"
   cairia em "AI & Automation". Renomear um produto muda a aba dele em
   silêncio.
2. **Ícone de fallback pelo mesmo truque, duplicado.** `getServiceFallbackIcon`
   existe idêntico em `PortfolioCard.tsx:41` e `ServiceDetailModal.tsx:22`.
3. **O popup desktop é um fork dos outros dois.** Tablet e mobile usam os
   helpers `renderTitle/renderPills/renderCta/renderScreen`; o desktop
   (`:473-648`) reescreve tudo inline e **divergiu**:
   - ignora `service.ctaText` e `ctaButtonColor` — o botão é sempre
     "Start/Começar" em `var(--cta)`, enquanto tablet/mobile usam o texto e um
     gradiente azul→índigo;
   - usa `sliderImages` em vez de `effectiveSliderImages` (`:612`), então **no
     desktop um produto sem slider mostra um laptop vazio com "Sem capturas de
     tela" mesmo tendo `imageUrl`**. Confirmado em produção no Xkedule.
4. **Quatro sistemas de coordenadas mágicos no popup** (`U = 17.99`,
   `U_TABLET = 5.86`, `U_TABLET_CONTENT = 6.67`, `U_MOBILE = 3.06`), herdados de
   três frames do Figma, mais compensações em px (`RECLAIMED_GAP`,
   `LAPTOP_LIFT`, um `ResizeObserver` para o laptop caber). A intenção — tudo
   escala junto via `cqw` — está certa; a execução são três layouts colados.
5. **Campos de estilo por item que sabotam qualquer sistema:** `backgroundColor`
   (default `"bg-white"`), `textColor`, `accentColor`, `ctaButtonColor`,
   `iconName`, `badgeText` (default `"One-time Fee"`). Cada produto poder ter a
   própria cor de botão é o oposto de coerência.
6. **Arquivos acima do limite do próprio repo** (600 l.): `ServiceDetailModal`
   700, `PortfolioServiceForm` 704.
7. **Placeholder do Figma vazando como dado:** `FALLBACK_TITLE = "Title Title"`,
   preço `"$69"`, `"/mo"` aparecem se o campo vier vazio
   (`ServiceDetailModal.tsx:127-130, 277, 553`). Um produto sem preço mostra
   $69.

### 1.4 O que está errado — visual

Visto em `skale.club/portfolio` e lido no WIP local:

1. **As capas dos produtos são de quatro famílias diferentes lado a lado:**
   astronauta 3D com lettering (Xareable), foto de mockup em mesa (Xsites),
   screenshot de UI clara (Xkedule, Xphere), e **nada** — caixa cinza com ícone
   de imagem (XmartMenu, Xtimator). É a maior causa do "feio", e nenhum CSS
   resolve: é direção de arte. Compare com os serviços da home, gerados por
   `scripts/generate-service-images.ts` — todos 3D azul-escuro, e por isso
   *aquela* seção parece coesa.
2. **Hierarquia achatada.** No card tudo vive entre 11 e 18 px (título
   `text-lg`, subtítulo `text-sm`, pílulas `text-xs`). Nada é grande, então
   nada é importante. No mockup de referência o título tem ~9× o tamanho do
   rótulo acima dele.
3. **Excesso de "efeito" no WIP local**, o repertório inteiro de página gerada
   por IA: grade de pontos + três brilhos desfocados + vidro fosco + texto em
   gradiente + botão com `shadow-[0_0_30px…]` que cresce no hover + selo com
   ícone `Sparkles` + bolinha pulsando. E quatro cores de ícone na faixa de
   métricas (azul, índigo, esmeralda, roxo) numa marca que o próprio
   `DESIGN_SYSTEM.md` define como de **duas cores**.
4. **Cor fora do sistema.** Só nestes arquivos: `#09090b`, `#0d121f`, `#121829`,
   `#070b13`, `#0f172a`, `#0b1120`, `#070b14`, `#0c1322`, `#141e34`, `#0a0f1d`
   como "fundo escuro"; borda roxa `#524eae96` e pílulas lavanda
   `rgba(212,185,246,…)` no popup. O token `bg-surface-dark` existe e não é
   usado aqui.
5. **O CTA do portfólio não é o CTA da marca.** A regra é pill `bg-cta`; o WIP
   usa gradiente `blue-600→indigo-600` com glow; produção usa pill **branca**.
   Três CTAs para a mesma ação.
6. **Grid com órfãos.** Em produção: 2 colunas, depois cards sozinhos
   centralizados numa coluna. O WIP já corrige com grid de 3.
7. **O popup gasta a dobra em espaço morto.** Logo + título + descrição +
   pílulas + preço + botão empilhados, e o laptop — a única imagem — fica
   abaixo da dobra em telas comuns.
8. **Dois popups para seções irmãs** com cantos, fundos, pílulas e botões de
   fechar diferentes.

### 1.5 O popup de produto — a tela que mais incomoda o dono

Palavras dele sobre o popup do Xphere em produção: *"me incomoda
profundamente"*. É a prioridade visual deste trabalho. O que há de errado,
verificado em `GET /api/portfolio-services` em 2026-09-18:

1. **Os seis produtos têm `popupSliderImages: []`.** O laptop cinza com "Sem
   capturas de tela" não é um caso de borda: é o visual principal do popup **do
   catálogo inteiro**. O layout foi desenhado em torno de um conteúdo que não
   existe. E cinco dos seis têm `imageUrl` ou logo que o desktop simplesmente
   não usa (o bug de `sliderImages` vs `effectiveSliderImages`, 1.3.3).
2. **A única imagem fica abaixo da dobra.** Logo, título, descrição, pílulas,
   preço e botão empilhados numa coluna estreita e centralizada; o laptop só
   aparece rolando — e quando aparece, está vazio.
3. **Tudo tem o mesmo peso.** Título ~50 px, preço ~60 px, botão largo no meio:
   três elementos gritando, nenhum rótulo, nenhuma pista de *o que é* isto (um
   app? um serviço? de que categoria?) nem de *onde estou* (1 de 6?).
4. **Cor de fora do sistema:** borda roxa `#524eae96`, pílulas lavanda. Nenhuma
   das duas existe na marca.
5. **As setas flutuam fora do card**, coladas nas bordas da janela, sem dizer
   para onde levam.
6. **`badgeText` tem default `"One-time Fee"`** e ele vazou: XmartMenu ($29/mês),
   Xtimator ($49/mês) e Xkedule ($89/mês) estão marcados como "taxa única" no
   banco. Hoje o selo só aparece no card do WIP local, mas é informação errada
   sobre preço esperando para ir ao ar. Corrija os dados e remova o default.

**Proposta concreta:** `docs/reference/portfolio-popup-mockup.html` — abra no
navegador (← → navegam pelos seis produtos reais; o botão alterna para
celular). Feito na marca do Skale Club, com o conteúdo real da API. O que ele
decide:

- **Duas colunas: texto à esquerda, visual à direita, tudo acima da dobra.**
- **Três estados visuais desenhados, nenhum vazio:** capa (`imageUrl`) com wash
  da marca; galeria com segmentos de progresso quando houver telas; e, sem
  imagem nenhuma, a marca do produto grande sobre a superfície texturizada —
  lê como tratamento, não como erro. O laptop sai: ele só fazia sentido com
  screenshots, e emoldurar uma foto de mockup dentro de outro mockup é ruído.
- **Hierarquia em três níveis:** rótulo (`App · CRM e vendas`) → título enorme
  → frase de apoio. Features viram lista com traço, não pílulas.
- **Um acento:** `--cta` no traço, na régua e no botão; `#8FA9EE` (que o folder
  já usa sobre escuro) no rótulo, porque `#5173D6` sobre navy não passa em
  contraste para texto pequeno.
- **Preço e botão ancorados no rodapé da coluna**, separados por um fio; no
  celular viram barra fixa.
- **Navegação dentro do card, com nome:** `← XmartMenu · 05 / 06 · Xtimator →`.
- **"No ar em"** lista até três dos `popupUrls` como links reais — prova social
  que hoje aparece como URLs cruas empilhadas.
- Uma árvore só, recomposta por container query (`@container (max-width:
  720px)`), no lugar das três árvores e quatro réguas atuais.

O mockup é proposta para aprovação, não especificação final: mostre ao dono
antes de implementar, e espere ajustes.

### 1.6 O que já está bom — não reescreva

- **O motor do folder.** `PrintFolder.tsx` + `print/paper.ts` +
  `print/primitives.tsx`: milímetros reais, `@page` dinâmico, sangria, marcas
  de corte que invertem em fundo escuro, CMYK via Ghostscript WASM, templates
  como plugins puros. Os comentários explicam cada decisão. **Geometria e
  pré-impressão são intocáveis neste trabalho.**
- **`print/items.ts`.** A normalização `FolderItem` é o modelo certo — a seção
  3 propõe promovê-la.
- **`SectionHeading`** (`components/layout/SectionHeading.tsx`): rótulo em
  caixa-alta + título + régua azul. É o mesmo padrão "eyebrow + título + régua"
  do mockup de referência e já é da casa. A página de portfólio é que não usa.
- **Limite de 40 palavras** na descrição (`shared/portfolio.ts`) — restrição de
  conteúdo é design. Falta estender a ideia (seção 4.5).
- `startTransition` no toque do carrossel (fix de INP) e o `history.pushState`
  do popup de serviço (botão voltar fecha o modal). Preserve os dois.

---

## 2. Por que o mockup de referência funciona

Nada disto é a paleta. É o que se transfere:

1. **Uma unidade.** Todo tamanho deriva de uma variável (`--u`, % do
   contêiner). Por isso a composição é *idêntica* em qualquer tela e se
   *recompõe* (lado-a-lado → empilhado) em vez de encolher. O popup daqui já
   quis isso com `cqw`; fez com quatro réguas em vez de uma.
2. **Hierarquia por contraste de escala, não por enfeite.** Rótulo minúsculo em
   caixa-alta com tracking largo → título enorme e pesado → texto de apoio
   médio e mais apagado. Três níveis, saltos grandes entre eles.
3. **Um acento só, usado pouco.** Rótulos, réguas, numerais, preço. Todo o
   resto é neutro. É por ser raro que ele chama atenção.
4. **Layouts fixos com encaixes.** Cada tipo de slide é um layout; o conteúdo
   preenche encaixes e nunca diagrama. Texto com limite, título com ajuste
   automático, imagem com `object-fit: cover`, vazio com tratamento desenhado.
5. **Atmosfera contida:** uma textura quase invisível + um brilho de canto.
   Não grade + três brilhos + vidro + glow.
6. **Texto nunca direto sobre foto** — degradê escuro na base, sempre.
7. **Cromo persistente e discreto** (logo, progresso) que dá moldura a tudo.
8. **Movimento só de `opacity`/`transform`**, escalonado na entrada, e
   respeitando `prefers-reduced-motion`.

---

## 3. Estrutura alvo

### 3.1 Um modelo: `CatalogItem`

Promova `FolderItem` (`client/src/print/items.ts`) para `shared/catalog.ts` e
faça **web e impresso** consumirem o mesmo:

```ts
interface CatalogItem {
  key: string                 // "product:12" | "service:paid-advertising"
  kind: "product" | "service"
  category: CatalogCategory   // explícita, nunca adivinhada
  title: string
  subtitle?: string
  description?: string
  features: string[]
  cover?: string              // a imagem de capa, já resolvida
  screens: string[]           // galeria do popup; [] é um estado válido
  logo?: string
  price?: { value: string; label?: string; setup?: string }  // ausente = sem preço, nunca "$69"
  cta: { label: string }      // sem cor — a cor é do sistema
  links: string[]
}
```

- `category` vira **coluna** em `portfolio_services` e campo nos cards de
  serviço; `getServiceCategory()` e as duas cópias de
  `getServiceFallbackIcon()` somem. O ícone de fallback sai de `category`.
- O cast `as unknown as PortfolioService` em `OurServicesSection.tsx` some.
- **Não unifique o armazenamento** agora (tabela vs JSON). É migração de dados
  em produção para um ganho que a camada de normalização já entrega. Registre
  como trabalho futuro.
- **Não apague as colunas de estilo por item** (`backgroundColor`,
  `textColor`, `accentColor`, `ctaButtonColor`). Pare de lê-las e tire-as do
  formulário do Admin; drop de coluna é outra conversa, com backup.

### 3.2 Uma família de cards

Um componente `CatalogCard` com variantes — `tile` (grid do portfólio),
`compact` (carrosséis), `row` (lista) — sobre os mesmos primitivos
(`Cover`, `Eyebrow`, `FeaturePills`, `PriceTag`). Os cards do folder
(`print/cards.tsx`) **continuam separados** — unidades em mm/pt e restrições de
papel são outro meio — mas passam a espelhar os mesmos nomes, a mesma ordem de
informação e a mesma lógica de fallback.

### 3.3 Um popup

Um `CatalogDetail` para os dois tipos: serviço é o mesmo layout sem preço e sem
galeria de telas. **Uma** árvore JSX, **uma** unidade de escala, recomposição
por container query em vez de três blocos `hidden lg:block`. Alvo: < 300 linhas
somando os subcomponentes. Mantém: `Esc`, setas ←/→ entre itens, botão voltar
fecha, trava de scroll do body, pausa do slider no hover.

---

## 4. Direção de design

A marca é a do Skale Club: navy `#0A162E`, CTA `#5173D6`, Outfit nos títulos,
Inter no corpo. **Não traga a paleta nem as fontes da Stuscle.**

### 4.1 Superfícies: três, não dez

| Token | Uso |
|---|---|
| `surface-dark` (`#111111`, já existe) | fundo da página e das seções |
| um tom acima (novo token) | cards e popup |
| um tom acima desse (novo token) | encaixe de imagem vazio, hover |

Todos os hex escuros listados em 1.4.4 são substituídos por esses três. Bordas
pelo token `border`, como o `CLAUDE.md` já manda.

### 4.2 Tipografia: a mesma família, com convicção

Outfit 700–800 em tamanhos que hoje o site não usa, tracking apertado nos
grandes. Escala sugerida para a página (desktop): rótulo 12–13 px caixa-alta
`tracking-[0.18em]` · título de seção 48–64 px · título de card 22–24 px ·
corpo 15–16 px. No popup o título pode ir a 56–72 px. O teste é o do mockup:
entre o rótulo e o título tem que haver um salto que se vê de longe.

### 4.3 Capas: direção de arte, não upload livre

É o item de maior retorno. Duas opções — **leve as duas ao dono**:

- **A (recomendada): capa composta pelo sistema.** Um componente `Cover` monta
  a capa a partir de `dashboardImageUrl` (screenshot) dentro de uma moldura de
  dispositivo, sobre a superfície da marca, com o logo do produto. Toda capa
  sai da mesma família por construção; produto sem screenshot cai no logo
  grande sobre a mesma superfície (o WIP já tem esse fallback — mantenha). O
  `LaptopMockup` existente é o ponto de partida.
- **B: gerar as capas dos produtos** com o mesmo pipeline dos serviços
  (`scripts/generate-service-images.ts`), no mesmo estilo 3D azul-escuro.
  Coeso com a seção de serviços, mas esconde o produto real.

Em ambas: o encaixe de capa tem proporção fixa, e o wash de cor que o folder já
usa (`ImageFrame tone="cta"`, `print/primitives.tsx:123`) vale a pena trazer
para a web — é o que faz fotos de origens diferentes parecerem uma coleção.

### 4.4 A página `/portfolio`, recomposta

1. **Hero** no padrão da casa: `SectionHeading` grande, alinhado à esquerda, um
   único CTA `variant="cta" size="pill"`. Sem selo com `Sparkles`, sem texto em
   gradiente, sem glow.
2. **Faixa de prova** — se ficar, ícones em **uma** cor, ou troque por números
   grandes (o padrão "numerais" do mockup). Se os quatro textos atuais não
   forem verdade verificável ("Fast 3-7 Day Deployment"), confirme com o dono
   antes de imprimir isso maior.
3. **Duas seções, não uma grade com abas:** "Apps" e "Serviços", cada uma com
   seu `SectionHeading`. É a mesma divisão que o folder já faz nos painéis 2 e
   3, e resolve o filtro por adivinhação. Se o dono quiser manter filtros, eles
   passam a ler `category`.
4. **Grid** 3 / 2 / 1 colunas, sem órfão centralizado; item ímpar final ocupa a
   linha (a lógica já existe em `CardGrid`, `print/cards.tsx:265`).
5. **CTA final:** um bloco, um botão, WhatsApp como link secundário.

### 4.5 Restrições de conteúdo no Admin

Hoje só a descrição tem limite. Estenda: título (≈ 24 caracteres), subtítulo
(≈ 48), no máximo 3 features de ≈ 22 caracteres, capa obrigatória para
publicar. Contadores ao vivo no `PortfolioServiceForm` e — o que mais ajuda —
**um preview do card e do popup reais ao lado do formulário**. Aproveite para
quebrar o arquivo (704 l.).

### 4.6 Folder

Motor intocado. O trabalho é só voz visual: mesma escala relativa de tipografia
(o título de painel em 16 pt é tímido para um A4 — o mockup sugere dobrar),
mesma régua, mesmo tratamento de capa, numerais grandes nos "trust points".
Verifique as três templates, nos dois papéis, com e sem preços, com 3, 8 e 13
itens por painel — os comentários em `cards.tsx` documentam onde cada layout
quebra.

---

## 5. Como conduzir

**Faça um mockup estático antes de mexer em componente.** Foi o que funcionou
na origem deste brief: um HTML único, com os layouts reais e o conteúdo real,
mostrado ao dono, ajustado em três rodadas curtas. Ele decide rápido e bem
quando *vê*; decide mal em abstrato. Inclua no mockup um seletor para as
decisões abertas (opção A vs B de capa, com/sem faixa de prova) — alternar ao
vivo encerrou a discussão de cor em minutos.

Sobre o dono: escreve em português; rejeitou verde sem hesitar; gosta de tipo
grande, rótulo + régua, numerais, atmosfera discreta; quer a marca respeitada
(logo e cores reais, puxados dos dados, não inventados).

Ordem sugerida, cada passo um commit que passa em `npm run check`:

0. Resolver o WIP (seção 0). Corrigir o azul nos dois docs.
1. Mockup estático → aprovação.
2. Tokens de superfície + `shared/catalog.ts` + coluna `category`.
3. `CatalogCard` (tile, compact) substituindo `PortfolioCard`; home e portfólio
   migram juntos para não haver dois visuais no ar.
4. `CatalogDetail` substituindo os dois modais.
5. Página `/portfolio`.
6. Formulário do Admin: limites, preview, quebra do arquivo.
7. Folder: voz visual.

Regras do repo que mordem aqui:

- Todo literal em `t()` precisa de entrada PT em `translations.ts` **antes** do
  commit — o TypeScript recusa a chave. E o arquivo tem teto de 600 linhas (o
  WIP já acrescentou 28).
- Máximo de 600 linhas por arquivo.
- `npm run db:push` aplica schema **no Supabase de produção**. A coluna
  `category` é aditiva e segura, mas confirme com o dono antes de rodar, e
  veja primeiro o que a migration 0057 pendente faz.
- Não há testes automatizados: verificação é manual — PT e EN, três
  larguras, teclado, e o PDF do folder. Sobre foco: `index.css:352-364` zera o
  outline global mas já repõe um fallback (`:where(a, button, [role="button"],
  summary):focus-visible`), então `<button>` e `<a>` novos ficam cobertos; um
  `<div onClick>` com `tabIndex` — como o card cheio é hoje — **não** fica, a
  menos que ganhe `role="button"`. Prefira elementos nativos.

---

## 6. Observações fora do escopo

- **`/print/folder` está público em produção**, sem login. Não vaza dado
  privado — tudo ali já está no site — mas é uma ferramenta interna exposta, com
  textos editáveis e o rótulo "Folder para impressão". Vale perguntar ao dono
  se era a intenção.
- O `PUBLIC_PAGES_DESIGN_REVIEW.md` lista achados que já foram corrigidos
  desde 2026-09-13 (tokens de CTA, `--font-display`, fallback de foco). Antes
  de agir sobre qualquer item dele, confira no código se ainda vale.
