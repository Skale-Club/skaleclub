# Revisão de Design — Páginas Públicas

**Data:** 2026-09-13
**Escopo:** `client/src` excluindo `/admin` (Home, Blog, Portfolio, Contact, FAQ, About, Privacy, Terms, Thank You, 404, landings dinâmicas, Links, VCard, SkaleHub, EstimateViewer, PresentationViewer, PrintFolder, LeadFormModal, ChatWidget, Navbar, Footer, `index.css`, `tailwind.config.ts`).
**Método:** revisão de código (JSX/Tailwind/CSS) com quatro auditores em paralelo; todos os achados de severidade Alta foram reconfirmados por grep. Sem screenshots (o container não tem banco de dados para subir o app).

---

## 1. Veredito

O site público está **visualmente coeso em produção, mas o design system documentado não é o que está no código**. As três cores oficiais do `DESIGN_SYSTEM.md` (`#0A162E`, `#406EF1`, `#355CD0`) têm zero ocorrências em componentes; o produto real usa `#5173D6`/`#3B5BBE` como CTA (60 ocorrências em 19 arquivos) e o próprio app declara isso no placeholder de Brand Guidelines. A fonte de headings (`Outfit`) está carregada mas nunca é aplicada, porque `--font-display` aponta para Inter. Além disso há um conjunto de **bugs visuais reais** (não apenas inconsistências) em VCard, EstimateViewer, LeadFormModal e PrintFolder que merecem correção antes de qualquer trabalho de polimento.

## 2. Números que resumem o problema

| Métrica | Valor | Fonte |
|---|---|---|
| Hex arbitrário `[#…]` no frontend público | 163 ocorrências em 31 de 146 arquivos | grep |
| Ocorrências de `#406EF1` (Action Blue documentada) | 0 | grep |
| Ocorrências de `#5173D6` (CTA real) | 60 (19 arquivos) | grep |
| Variantes de "azul-marinho" coexistindo | 6 (`#1C53A3`, `#0B1E3D`, `#111111`, `#18191f`, `#0a0f18`, `#10151f`) | Home/Navbar/Footer |
| `<section>` usando o padrão documentado `py-16 md:py-24` | 0 | grep |
| `--font-display` | `'Inter'` (doc pede Outfit) | `index.css:8` |
| `target="_blank"` sem `rel` | 12 | grep |
| Componentes públicos sem nenhum import (mortos) | 3 (`FaqSection`, `PracticalBlock`, `MobileLanguageToggle`) | grep |
| Classes CSS custom sem uso no repo | `.glass-panel`, `.shadow-elevation-*`, `.shadow-glow`, `.motion-*`, `.hover-lift` | grep |

## 3. Decisão que destrava o resto: qual é o azul?

O código é coerente consigo mesmo: `#5173D6` (hover `#3B5BBE`) é o CTA em toda parte, `PrintFolder.tsx:17` declara `ACTION_BLUE = "#5173D6"` e o placeholder de Brand Guidelines (`translations.ts:233`) diz "CTA / Button Color: #5173D6". Só o `DESIGN_SYSTEM.md` diz `#406EF1`.

**Recomendação:** oficializar `#5173D6`/`#3B5BBE` no `DESIGN_SYSTEM.md`, criar os tokens `--cta` / `--cta-hover` (e `--surface-dark`) em `index.css` + `tailwind.config.ts`, e substituir os 75 hex de CTA por `bg-cta hover:bg-cta-hover`. Migrar para `#406EF1` custaria o mesmo esforço e mudaria a cara do produto sem ganho.

Qualquer que seja a escolha, hoje há **três azuis competindo pelo papel de CTA** na mesma tela: `#5173D6` (hero, navbar, forms), `bg-primary`/`#1C53A3` (botão mobile do Blog, launcher do Chat, Links default) e `blue-600` (VCard).

## 4. Achados por área

Severidade: **Alta** = bug visível ao usuário ou violação sistêmica; **Média** = inconsistência clara; **Baixa** = polimento.

### 4.1 Fundação (tokens, CSS global, primitivos)

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `index.css:8` | `--font-display: 'Inter'`. Outfit é carregada em `index.html` mas nunca aplicada; `h1..h6` renderizam em Inter. Outfit só aparece via `style={{fontFamily}}` inline 11× em `SlideRenderer.tsx`. | `--font-display: 'Outfit', sans-serif` e remover os inline styles. |
| Alta | `index.css:389-427` | `.container-custom` tem `max-width: 1600px`; o doc diz `max-w-7xl` (1280px). Portfolio e Thank You usam `max-w-7xl` cru, então a largura de conteúdo muda de página para página. | Decidir uma largura e usar `container-custom` em todas as páginas. |
| Alta | `ui/button.tsx:8,30,31` | `Button` base é `rounded-md`; o doc exige CTAs pill. Resultado: CTAs shadcn (SkaleHub, Contact) são retangulares, CTAs manuais (hero, navbar) são pill, LeadFormModal é `rounded-xl`. | Variante `pill` no `Button` (ou default `rounded-full`) e usar em todo CTA. |
| Média | `index.css:359` + páginas | `*:focus-visible { outline: none }` global, mas botões custom em Portfolio, ServiceDetailModal, HeroWebsitesSection, LeadFormCta, LeadThankYou, Links, VCard, PrintFolder não têm `focus-visible:ring`. Foco de teclado invisível nos CTAs principais. | `focus-visible:ring-2 ring-offset-2` em todo `<button>`/`<a>` custom, ou remover o reset global. |
| Média | `ui/spinner.tsx` | Spinner "brand" fixa `#5173D6` em vez de token. | Usar `--cta`. |
| Média | 12 links | `target="_blank"` sem `rel="noopener noreferrer"` (ServiceDetailModal, Footer, Navbar, VCard, BlogPost×4, Links, EstimateViewer). | Adicionar `rel`. |
| Média | 46 arquivos | Site é dark-only por design (`index.html`), mas 46 arquivos usam `bg-white`/`text-gray-*`/`text-slate-*` fixos e 33 usam tokens; `dark:` órfão em 8 arquivos. | Padronizar em tokens (`bg-background`, `text-foreground`, `text-muted-foreground`). |
| Baixa | `index.css` | `.glass-panel`, `.shadow-elevation-*`, `.shadow-glow`, `.motion-*`, `.hover-lift` não são usados em lugar nenhum; `.lc_reviews_widget { background:#111111 !important }` força hex com `!important`. | Remover CSS morto; tokenizar o widget. |

### 4.2 Home e layout global

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `HeroSection.tsx:37,79`; `Navbar.tsx:59,118,142,217`; `Footer.tsx:41`; `Home.tsx:107,121,145`; `TrustBadges.tsx:34`; `ReviewsSection.tsx:88,103`; `BlogSection.tsx:36` | Seis cores escuras diferentes (`#1C53A3`, `#0B1E3D`, `#111111`, `#18191f`, `#0a0f18→#0d1320`, `#10151f→#0a0c11`) para "superfície escura"; nenhuma é a Navy documentada. | Token `--surface-dark` + um gradiente nomeado. |
| Média | `Home.tsx:91,107` ↔ `HeroSection.tsx:29-31` | "Contrato de bleed" da trust bar: `mt-[-6.0625rem]`, `pb-[6.0625rem]` e `top-[6.0625rem]` precisam ser editados juntos em 3 lugares × 3 breakpoints. Bem comentado, mas frágil. | Encapsular num componente `HeroWithTrustBar` que calcula o overlap uma vez (CSS grid com sobreposição de linha). |
| Média | `HeroSection.tsx:64` | Hero title usa `clamp()` + 4 breakpoints custom; doc pede `text-5xl md:text-6xl`. Existem 10+ combinações de escala de hero no site. | Escolher uma escala (o `clamp` é bom) e documentar. |
| Média | `HeroSection.tsx:92-106`, `Footer.tsx:47,53` | `<img>` sem `width`/`height`/`aspect-ratio` (CLS). Navbar define dimensões nos mesmos logos; Footer não. | Dimensões intrínsecas. |
| Média | `BlogSection.tsx:25` | `isLoading` retorna `null`: a seção aparece de repente e empurra o conteúdo. | Skeleton de 3 cards. |
| Média | `Home.tsx:132` vs `ReviewsSection.tsx:91`, `AboutSection.tsx:24`, `AreasServedMap.tsx:45` | H2 de seção oscila entre `md:text-4xl` e `md:text-5xl`. | Padronizar em `text-3xl md:text-4xl`. |
| Média | `ReviewsSection.tsx:49,88,103` + `index.css:528-536` | Widget de reviews forçado a cantos quadrados com `!important`, único bloco não arredondado da página. | Aceitar e isolar visualmente, ou remover o override. |
| Baixa | `Home.tsx:125` | `<div className="h-0 bg-[#111111]">` sem efeito. | Remover. |
| Baixa | `PracticalBlock.tsx` | Componente de 72 linhas sem nenhum import. | Remover. |
| Baixa | `Home.tsx:135`, `ServicesSection.tsx:166` | `indigo-500/10`, `indigo-200/30` decorativos; indigo não é da paleta. | Usar navy/CTA com opacidade. |
| Baixa | `StepCard.tsx:63`, `OurServiceDetailModal.tsx:44` | `rounded-3xl` fora da escala (`rounded-2xl`). | Ajustar. |
| Baixa | `TrustBadges.tsx:39` | `hover:bg-white/5` em `div` não clicável sugere interação inexistente. | Remover hover. |

### 4.3 Páginas de conteúdo e landings dinâmicas

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `Blog.tsx:64-94`, `Contact.tsx:74-86`, `AboutUs.tsx:16-22`, `Faq.tsx:18-26`, `PrivacyPolicy.tsx:20-33`, `TermsOfService.tsx:36-49` | Cada página tem um header diferente: Blog tem faixa `bg-primary/5` + breadcrumb + h1 `text-2xl md:text-3xl`; Contact/About h1 `text-4xl md:text-6xl` sem faixa; Privacy/Terms faixa `bg-primary` sólida + ícone; FAQ fundo `#F8FAFC` sem faixa. | Componente `PageHeader` único (título, subtítulo, breadcrumb opcional). |
| Alta | `WhatsAppGroupSection.tsx:133-137` | `document.body.style.backgroundColor = "#0a0f0d"` no mount: efeito colateral global que sobrescreve o tema e pode vazar. É também a única seção do registry sem `sectionThemeSchema`. | Fundo no container da seção; adicionar o schema de tema. |
| Alta | `Portfolio.tsx:95-149`, `ServiceDetailModal.tsx:355-490`, `HeroWebsitesSection.tsx:80`, `LeadFormCtaAdapter.tsx:51`, `LeadThankYou.tsx:74-99` | Botões custom sem `focus-visible` (ver 4.1). | Idem. |
| Média | `ContentBlocksSection:93`, `PricingTableSection:94`, `ProcessStepperSection:114`, `FaqAccordionSection:83` (`py-20 sm:py-24`) vs `Blog.tsx:96` (`py-8 md:py-12`) vs `Faq.tsx:20` (`py-20`) vs `LeadFormCtaAdapter:39` (`py-20`) | Nenhuma seção usa o padrão documentado; breakpoints `sm:` e `md:` misturados. | Adotar `py-16 md:py-24` (ou tokenizar `4.25rem`, o valor mais usado na Home). |
| Média | `not-found.tsx` vs `BlogPost.tsx:93-109` vs `PublicForm.tsx:58-72` | Três telas de "não encontrado" com identidades diferentes; a 404 usa `zinc-950` + glow vermelho sem nada da marca. | Um componente `NotFoundState` reutilizado. |
| Média | `Faq.tsx`, `FaqSection.tsx`, `FaqAccordionSection.tsx` | Três accordions de FAQ; `FaqSection` está morto; `Faq.tsx` mostra empty state, `FaqSection` retorna `null`. | Remover `FaqSection`; extrair `FaqList` compartilhado entre página e seção. |
| Média | `ServiceDetailModal.tsx` (610 l.) vs `home/OurServiceDetailModal.tsx` (92 l.) | Dois modais de detalhe de serviço para seções irmãs. | Unificar por schema comum, ou documentar por que são distintos. |
| Média | `Contact.tsx:93,232` (`rounded-3xl`), `Faq.tsx:37` (`rounded-lg`), `PortfolioCard.tsx:63` (`rounded-2xl`) | Radius de card sem critério. | `rounded-2xl`. |
| Baixa | `Contact.tsx:165-191` | `<input type="checkbox">` nativo em vez do `Checkbox` do sistema. | Trocar. |
| Baixa | `Contact.tsx:197` | `<Button>` shadcn com override inline `bg-[#5173D6]`. | Variante de marca. |
| Baixa | `Portfolio.tsx:85-136`, `LeadThankYou.tsx:51` | `max-w-7xl`/`max-w-5xl` crus em vez de `container-custom`. | Padronizar. |
| Baixa | `PricingTableSection`, `ProcessStepperSection`, `LeadThankYou` | Roxo `#4c4ac1` e navy `#0A192F` ad hoc. | Tokens. |

### 4.4 Páginas standalone (sem Navbar/Footer)

**Links (`Links.tsx`)**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:204-211` | Hover via `onMouseEnter` mutando `style.borderColor`; sem foco nem `:active`. | CSS var + `hover:`/`focus-visible:`. |
| Alta | `:229-240` | Ícones sociais são `<a>` de 24×24 sem padding (alvo abaixo de 44px, página mobile-first). | `w-11 h-11 flex items-center justify-center`. |
| Média | `shared/links.ts:13` | `primaryColor` default `#1C53A3` (azul do admin), não o CTA do site. | Alinhar. |
| Média | `:103-115` | Só spinner; sem skeleton, erro ou vazio. | Skeleton + fallback. |

**VCard (`VCard.tsx`) — primeiro contato via NFC**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:103,107,111` | Loading, "not found" e "inactive" são `<div>` com texto cru em inglês, sem logo, sem CTA. | Tela de estado com logo, título e link para o site. |
| Alta | `:257` | O cartão de cupom renderiza `<QrCode>` (ícone Lucide), não um QR real; o QR de verdade está em `:293`. | Usar `<QRCode value>` ou remover. |
| Média | `:216,225,253,303` | `blue-600`/`blue-700` do Tailwind em vez do CTA de marca. | Token. |
| Média | `:287,292,303` | Três sombras arbitrárias diferentes no mesmo scroll; cards `rounded-xl`. | `shadow-elevation-*` já definidos + `rounded-2xl`. |
| Média | `:183,191` | `alt="Favicon"` no logo; alt do retrato só com o primeiro nome. | Alt descritivo. |
| Baixa | `:202` | Comentário "Glassmorphism orange accent" em botão branco (resíduo da identidade antiga). | Remover. |
| Baixa | `:339` | Ícones sociais 40×40. | 44px. |

**SkaleHub (`SkaleHub.tsx`)** — nota: renderiza dentro do layout com Navbar, não é standalone.

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:170,172,246` | Gradiente literal `#f7f9fc/#eef4ff`, dois `radial-gradient` rgba e painel `#18191f`. | Tokens. |
| Média | `:316` | CTA principal é `Button` default (`rounded-md`). | Pill. |
| Média | `:233-243` | Sem ramo de `isError`; falha de API vira "próxima live em breve". | Estado de erro com retry. |
| Média | `:277-301` | Campo de telefone remonta borda/radius à mão e neutraliza o `Input`; mesmo padrão em `LeadFormModal.tsx:1288`. | Extrair `PhoneField`. |

**EstimateViewer (`/e/:slug`)**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:481-491` | `onWheel` no `window` sempre faz `preventDefault` e navega slide; o container interno `overflow-y-auto` (`:661`) nunca recebe scroll no desktop. Slides longos ficam inacessíveis. | Só interceptar quando o container está no topo/fim (a lógica já existe para touch em `:523-527`). |
| Alta | `:125,562` | `h-screen` com controles `fixed bottom-4` (`:623`): no iOS Safari a barra do navegador cobre a navegação. | `min-h-[100dvh]`. |
| Média | `:154-160` | Input do código de acesso sem `label`/`aria-label`. | `aria-labelledby`. |
| Média | `:585,628,639` | Dots 32px e setas mobile 36px (desktop respeita 44px). | Igualar. |
| Média | arquivo | Sem `@media print`; imprimir gera 1 slide. | Folha de impressão empilhando seções. |
| Baixa | `:57-67` | `NotFoundScreen` sem logo nem contato. | Reaproveitar logo de `siteSettings`. |

**PresentationViewer + SlideRenderer**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Média | `PresentationViewer.tsx:6,7,12` | `Button`, `Input`, `resolveField` importados e não usados. | Remover. |
| Média | `:557` | Botão "Cancel (Esc)" sem handler de Escape. | Implementar ou renomear. |
| Média | `:491` | Barra de edição `opacity-0 group-hover:opacity-100`: invisível em touch e sem foco. | `focus-within:opacity-100` + toggle. |
| Média | `SlideRenderer.tsx:57,151` | "Skale Club" hardcoded na capa/fecho; EstimateViewer usa logo de `siteSettings`. | Passar `siteSettings`. |
| Média | `SlideRenderer.tsx` (11×) | `fontFamily: 'Outfit'` inline. | `font-display` após corrigir o token. |
| Baixa | `:131,161,193` | Imagens como `background-image` (sem alt). | `<img alt>`. |
| Baixa | `:450-460` | `<video>` sem `poster`. | Adicionar. |

**PrintFolder (`/print/folder`)**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:291-293` | `flex min-h-screen` + `aside w-[300px]` sem breakpoint: em 375px sobra ~75px para o preview. | `flex-col lg:flex-row`. |
| Média | `:660,677` | Listas de serviço em `overflow-hidden` num painel de altura fixa: excedente é cortado em silêncio. | Limitar seleção ou avisar. |
| Média | `:276-282,487` | Só `break-after: page`; sem `break-inside: avoid`; `zoom` não é padrão (Firefox). | `break-inside: avoid` + `transform: scale()`. |
| Média | `:22-45` | `Editable` só indica edição no foco. | Underline pontilhado em hover. |
| Baixa | `:310-341,425,434` | Botões/inputs nativos com estilo próprio. | Primitivos shadcn. |

**LeadFormModal**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Alta | `:1056-1071` | Reimplementa o Dialog com `createPortal` + `role="dialog"`; tem Escape e scroll lock, mas **não tem focus trap** (Tab escapa para a página). | Migrar para `DialogContent` do shadcn. |
| Alta | `:1071,1082` | Barra de progresso em `-top-[6px]` dentro de `overflow-hidden`: metade dos 12px é cortada. Não há "Passo X de Y". | Mover para dentro do padding + contador. |
| Média | `:1104` | "Let's begin!" fixo em todos os steps, inclusive o último. | `Passo {n}/{total}`. |
| Média | `:1121,1140,1267,1306` | Quatro inputs nativos com a mesma string de classes duplicada. | `Input` ou `FormField`. |
| Média | `:1402` | CTA de avanço `rounded-xl` com cor hardcoded. | Pill + token. |

**ChatWidget**

| Sev. | Onde | Problema | Correção |
|---|---|---|---|
| Média | `:396,400` | `fixed right-4` + `w-80` = 336px; transborda em 320px. | `w-[calc(100vw-2rem)] sm:w-96`. |
| Média | `:372` vs site | Launcher `bg-primary` (`#1C53A3`) ao lado de CTAs `#5173D6`. | Unificar. |
| Média | `:400,441,485` | `bg-white`/`bg-slate-50` fixos, não segue tokens. | `bg-card`/`bg-muted`. |
| Baixa | `:351` vs `:400` | Balão `rounded-2xl`, painel `rounded-xl`. | Padronizar. |

## 5. Plano de ação sugerido

**Fase 1 — Fundação (1 dia, destrava todo o resto)**
1. Decidir o azul (recomendação: oficializar `#5173D6`/`#3B5BBE`); atualizar `DESIGN_SYSTEM.md`.
2. Criar tokens `--cta`, `--cta-hover`, `--surface-dark` em `index.css` + `tailwind.config.ts`.
3. `--font-display: 'Outfit'`.
4. Variante `pill` no `Button`; ring de foco padrão nos primitivos e nos CTAs custom.
5. Decidir a largura de container (1280 vs 1600) e alinhar doc + código.

**Fase 2 — Bugs visíveis ao usuário (1 a 2 dias)**
6. VCard: telas de estado com identidade + QR real.
7. EstimateViewer: scroll interno no desktop + `100dvh`.
8. LeadFormModal: focus trap (Dialog shadcn), barra de progresso, contador de passos.
9. PrintFolder responsivo; ChatWidget em 320px.
10. WhatsAppGroupSection: remover mutação de `body`.
11. `rel="noopener noreferrer"` nos 12 links; alvos de toque ≥44px em Links/VCard/EstimateViewer.

**Fase 3 — Consistência (2 a 3 dias)**
12. `PageHeader` único para Blog/Contact/About/FAQ/Privacy/Terms.
13. `NotFoundState` único (404, BlogPost, PublicForm, VCard, Estimate).
14. Substituir os 163 hex por tokens; padronizar `py` de seção, radius `rounded-2xl`, H2 `md:text-4xl`.
15. `FaqList` compartilhado; avaliar unificação dos dois modais de serviço.
16. Skeletons em BlogSection, Links, SkaleHub.

**Fase 4 — Limpeza**
17. Remover `FaqSection.tsx`, `PracticalBlock.tsx`, `MobileLanguageToggle.tsx`, imports mortos do PresentationViewer, `div h-0` da Home, CSS morto do `index.css`.
18. Encapsular o bleed da trust bar num componente.

## 6. O que está bem feito (manter)

- Navegação por swipe/roda dos viewers respeita o scroll interno com threshold e timeout (`EstimateViewer.tsx:496-537`, `PresentationViewer.tsx:214-252`).
- `useThemeColor` tinge a chrome do iOS conforme o slide.
- PrintFolder tem `@page` dinâmico, sangria, marcas de corte e `print-color-adjust: exact` corretos.
- Blog trata loading (skeleton), infinite scroll e vazio; PresentationViewer tem loading, not-found e vazio distintos.
- `PortfolioCard` tem altura fixa e variantes light/dark limpas; Privacy e Terms compartilham exatamente o mesmo padrão de seção.
- `ServicesCarousel` tem touch/drag/loop cuidadosos com `aria-label`; hero usa `text-balance` e `fetchpriority="high"`.
- Bilinguismo consistente via `resolveField` + `LanguageSwitch` nos viewers.
