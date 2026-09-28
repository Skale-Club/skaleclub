# NFC: guia de produto + pedido full screen

Criado em 2026-09-28 a partir da revisão de Vanildo sobre a página pública de
chaveiros NFC.

## Objetivo

Separar claramente três experiências que hoje estão misturadas:

1. **Landing page de venda** — apresenta o produto e gera interesse.
2. **Guia de produto / tira-dúvidas** — explica modelos, formação do preço,
   funcionamento do NFC, produção e dúvidas frequentes, com visual editorial e
   informativo, não de landing page.
3. **Pedido full screen** — link direto para uma pessoa que já conversou com a
   equipe e só precisa preencher os dados do pedido, sem hero, seções de venda ou
   clique adicional para abrir um modal.

## Contrato de rotas

| Função | Inglês | Português | Comportamento |
|---|---|---|---|
| Landing page | `/nfc-keychains` | `/br/nfc-keychains` | Página comercial existente; continua vendendo a ideia do produto. |
| Guia / tira-dúvidas | `/nfc-guide` | `/br/nfc-guide` | Nova página editorial e estruturada. Substitui conceitualmente a antiga página chamada `pricing`. |
| Formulário de pedido | `/nfc-order` | `/br/nfc-order` | Formulário full screen, aberto diretamente na primeira pergunta. |

### Compatibilidade de URLs

- `/nfc-pricing` deve redirecionar permanentemente para `/nfc-guide`.
- `/br/nfc-pricing` deve redirecionar permanentemente para `/br/nfc-guide`.
- As formas legadas `/nfc-pricing-br` e `/nfc-pricing/br` devem chegar ao guia
  português em um único redirecionamento.
- `/f/nfc-keychain-order` pode continuar funcionando durante a transição, mas
  os novos links enviados a clientes devem usar `/nfc-order` ou
  `/br/nfc-order`.
- As linhas dinâmicas antigas `nfc-order` e `nfc-order-br` na tabela `pages`
  devem ser desativadas depois que a rota dedicada full screen estiver no ar.
  A rota React explícita precisa ser registrada antes do catch-all `/:slug`.

## Princípios de experiência

### Landing page

- Continua sendo persuasiva e visual.
- Não absorve todo o conteúdo do guia.
- CTA principal pode continuar abrindo o modal no primeiro lançamento para não
  alterar de uma vez o funil de tráfego pago.
- CTA secundário “Veja modelos e tire suas dúvidas” aponta para `/nfc-guide`.
- Uma migração futura pode mandar o CTA principal ao formulário full screen,
  mas isso fica fora deste escopo até comparar conversão e abandono.

### Guia de produto

- Não usa hero de campanha, glow forte, sequência de badges ou repetição de
  CTAs típica de landing page.
- Aparência de guia de compra: fundo claro ou neutro, tipografia editorial,
  conteúdo com boa hierarquia, navegação por assuntos e bastante espaço.
- No desktop: sumário lateral ou sticky com âncoras. No celular: chips
  horizontais ou seletor compacto de assuntos.
- CTA é útil e discreto: “Fazer pedido” e “Falar no WhatsApp”, no topo e no fim,
  sem interromper cada seção.
- O conteúdo deve responder uma pergunta por bloco; FAQ sanfonado fica apenas
  para dúvidas curtas que não merecem uma seção completa.

### Formulário full screen

- Sem Navbar, Footer, ChatWidget, backdrop, botão de fechar ou conteúdo de
  venda.
- Abre diretamente no passo 1, com marca discreta, progresso, pergunta atual e
  controles de avançar/voltar.
- No desktop, usa uma área central confortável, sem parecer um modal flutuando
  sobre uma página vazia. No celular, ocupa a viewport inteira.
- Mantém salvamento local, retomada, autosave, upload, cálculo de preço,
  validação, atribuição/UTM, evento `form_open` e envio existentes.
- Escape não fecha; não há focus trap de diálogo; a página pode rolar quando o
  conteúdo do passo for maior que a viewport.
- Ao concluir, mantém a página de obrigado específica de pedidos NFC.

## Arquitetura do conteúdo do guia

### 1. Cabeçalho editorial

- Título: “Guia dos chaveiros NFC”.
- Resumo curto: o que são, quais modelos fazemos e como o preço é definido.
- Metadados úteis em formato compacto: pedido mínimo, produção personalizada e
  confirmação final pelo WhatsApp.
- Links de ação: “Fazer pedido” e “Falar no WhatsApp”.

### 2. Escolha o modelo

Apresentar os modelos lado a lado, com diferenças concretas e sem esconder como
o preço funciona:

| Modelo | O que é | Indicado para | Preço |
|---|---|---|---|
| Chapado | Base e logo com acabamento plano. | Logos simples, pedidos padronizados e melhor custo por unidade. | Calculado imediatamente pela quantidade no formulário. |
| Alto-relevo | Elementos elevados, perceptíveis visualmente e ao toque. | Marcas que precisam de mais volume e destaque. | Orçamento individual conforme desenho e complexidade. |
| Shape personalizado | Peça no formato de produto, ferramenta, mascote, bichinho, bonequinho ou contorno da logo. | Brindes memoráveis e formatos fora do padrão. | Orçamento individual conforme formato, detalhes e produção. |

Regras:

- Os nomes, estado ativo e comportamento de preço vêm de
  `shared/nfc-pricing.ts`; a página não cria uma segunda tabela comercial.
- Ampliar a descrição de `custom-shape` para incluir explicitamente mascotes,
  personagens, bichinhos e bonequinhos.
- Chapado pode mostrar preço inicial derivado de `nfcPriceCopy()`.
- Alto-relevo e shape mostram “Preço confirmado no WhatsApp”, nunca um valor
  inventado ou desatualizado.
- Se ainda não houver fotos específicas de cada modelo, usar ilustrações/ícones
  honestos e marcar a captura de fotos reais como melhoria posterior; não usar a
  mesma imagem como se provasse três acabamentos diferentes.

### 3. O que define o preço

- Tipo de chaveiro escolhido.
- Quantidade e faixas de volume.
- Complexidade do desenho e número de detalhes/camadas.
- Necessidade de preparar ou criar a arte.
- Primeira compra versus recompra, incluindo a taxa de arte quando aplicável.
- Deixar claro que chapado tem cálculo imediato; peças especiais são analisadas
  individualmente antes de qualquer produção.

Os números devem ser importados das constantes de preço existentes. O conteúdo
não pode repetir manualmente mínimo, faixas ou taxa em JSX/seed quando já existe
uma fonte compartilhada.

### 4. Como o NFC funciona

- O que existe dentro do chaveiro.
- Onde encostar o celular.
- Compatibilidade com iPhone e Android modernos.
- Não exige aplicativo.
- Destinos possíveis: avaliações Google, Instagram, WhatsApp, menu, vCard,
  website ou página de agendamento.
- Como trocar o destino posteriormente e em que situação a tag precisaria ser
  reprogramada.

### 5. Arte e personalização

- Formatos aceitos para a logo.
- O que fazer quando a pessoa só tem foto ou print.
- Limites de detalhes muito pequenos para impressão 3D.
- Aprovação da arte antes da produção.
- Diferença entre preparar uma logo e criar uma arte do zero.

### 6. Do pedido à entrega

Fluxo curto e factual:

1. Cliente preenche o pedido.
2. Equipe analisa modelo, quantidade e arte.
3. Valor final e detalhes são confirmados no WhatsApp.
4. Cliente aprova a arte e realiza o pagamento.
5. Produção, programação/teste da tag e envio.

Não prometer prazo fixo enquanto ele não estiver formalizado como regra de
negócio.

### 7. FAQ agrupado

Organizar perguntas em grupos, em vez de uma sanfona única e longa:

- **Modelos e personalização:** alto-relevo, shape, bonequinho, cores, logo.
- **Preço e quantidade:** mínimo, taxa de arte, recompra, alteração de
  quantidade, orçamento especial.
- **Tecnologia NFC:** compatibilidade, aplicativo, troca do link, reprogramação.
- **Pedido e produção:** aprovação, pagamento, arquivos, envio e o que acontece
  depois do formulário.

## Arquitetura técnica

### A. Um motor de formulário, duas apresentações

Não copiar o formulário para uma nova página. Evoluir o componente existente
para aceitar duas apresentações:

- `modal`: comportamento atual, com portal, backdrop, focus trap, Escape e
  botão fechar.
- `page`: render inline, sem portal e sem semântica/comportamento de diálogo.

Implementação sugerida:

- Manter a lógica de dados, passos e submissão em uma experiência compartilhada
  (`LeadFormExperience` ou equivalente).
- Preservar `LeadFormModal` como wrapper compatível para todos os consumidores
  atuais.
- Adicionar um wrapper `LeadFormPage`/`NfcOrderFormPage` que use o mesmo motor no
  modo `page`.
- Evitar uma refatoração geral de regras de negócio neste trabalho; a mudança é
  de composição e shell visual.

Arquivos principais:

- `client/src/components/LeadFormModal.tsx`
- `client/src/pages/PublicForm.tsx`
- novo `client/src/pages/NfcOrderForm.tsx`
- `client/src/App.tsx`

### B. Guia como rota dedicada, com layout próprio

Criar `/nfc-guide` como rota React explícita (o roteador de idioma atende
`/br/nfc-guide` com o mesmo componente), em vez de depender de uma linha no
banco. Isso garante que o guia abra junto com o deploy e não possa cair em 404
por seed ausente. O conteúdo usa um componente editorial dedicado, não uma
composição de `heroWebsites`, `trustBadges` e `leadFormCta`.

A seção dedicada deve:

- aceitar props tipadas e reutilizáveis;
- renderizar o layout editorial, sumário, blocos de conteúdo, comparação e FAQ;
- consumir os tipos e preços de `shared/nfc-pricing.ts`;
- usar traduções manuais no dicionário estático para EN/PT funcionar sem
  tradução automática ou seed;
- fornecer âncoras estáveis e `data-testid` nos assuntos principais.

Arquivos principais:

- novo `client/src/components/pages/sections/NfcProductGuideSection.tsx`
- novo `client/src/pages/NfcGuide.tsx`
- `client/src/App.tsx`
- `client/src/lib/translations.ts`
- `shared/nfc-pricing.ts`

### C. Rotas, SEO e links internos

- Registrar `/nfc-order` como rota conhecida antes de `/:slug`.
- Tratar a rota de pedido como experiência sem chrome global no `Router`.
- Adicionar SEO de `nfc-guide`/`nfc-guide-br` em `shared/landingSeo.ts`.
- Atualizar os metadados do pedido para refletir que é um formulário direto.
- Considerar `noindex, follow` no pedido full screen para ele não competir com
  a LP e o guia nos buscadores.
- Atualizar `server/canonicalHost.ts` para os redirecionamentos legados.
- Atualizar links na LP, página de obrigado e CTAs do guia.
- Preservar query string/UTMs em redirects e navegação para o formulário.

Arquivos principais:

- `client/src/App.tsx`
- `shared/landingSeo.ts`
- `server/canonicalHost.ts`
- `client/src/pages/LeadThankYou.tsx`
- `scripts/seed-nfc-keychains-landing.ts`
- `scripts/seed-nfc-keychains-translations.ts`

## Plano de execução

### Wave 1 — Contratos e shell do formulário

1. Definir constantes/ajudantes de rota para landing, guia e pedido, evitando
   strings divergentes nos seeds e componentes.
2. Adicionar a apresentação `page` ao motor do formulário sem alterar regras de
   cálculo, autosave ou submissão.
3. Criar `NfcOrderForm` e registrar `/nfc-order` antes do catch-all.
4. Remover Navbar, Footer e ChatWidget somente nessa rota.
5. Garantir PT por `/br/nfc-order`, inclusive traduções já existentes.

Critérios de aceite:

- Abrir `/br/nfc-order` mostra imediatamente “Passo 1/10” e a primeira pergunta.
- Não existe botão intermediário “Fazer meu pedido”.
- A página não tem hero, navbar, footer, chat, backdrop nem botão de fechar.
- Recarregar após responder passos retoma o mesmo pedido salvo.
- Flat mantém preço ao vivo; relevo e shape continuam como orçamento no
  WhatsApp.
- A submissão cria o mesmo lead `nfc-keychain-order` e abre a mesma página de
  obrigado.
- O modal aberto pela LP continua funcionando sem regressão.

### Wave 2 — Guia editorial

1. Criar o componente `NfcProductGuideSection` e a rota `NfcGuide` com layout e navegação próprios.
2. Implementar comparação dos três modelos usando o catálogo compartilhado.
3. Implementar blocos sobre preço, NFC, arte e processo.
4. Implementar FAQ agrupado e responsivo.
5. Adicionar as traduções manuais necessárias ao dicionário estático.

Critérios de aceite:

- `/br/nfc-guide` não reutiliza o hero nem a composição visual da LP.
- Chapado, alto-relevo e shape personalizado são explicados separadamente.
- “Bichinho”, “bonequinho”, mascote/personagem e formato de objeto aparecem na
  explicação de shape personalizado.
- A página explica por que tipos diferentes têm preços diferentes.
- Nenhum valor comercial é duplicado manualmente fora da fonte compartilhada.
- Todos os grupos são navegáveis por teclado e por âncora.
- O layout funciona em 360 px, tablet e desktop sem overflow horizontal.

### Wave 3 — Migração de rotas e integrações

1. Alterar redirects `nfc-pricing` para o novo guia.
2. Manter as páginas dinâmicas antigas `nfc-order` sombreadas pela rota dedicada;
   elas podem ser desativadas posteriormente no admin sem afetar a publicação.
3. Atualizar SEO, canonical e hreflang dos três destinos.
4. Atualizar CTAs e links internos.
5. Corrigir o link antigo da página de obrigado que ainda aponta para
   `/nfc-pricing`.
6. Validar que query strings de campanha chegam ao pedido e permanecem nos
   dados de atribuição.

Critérios de aceite:

- `/br/nfc-pricing` termina em `/br/nfc-guide`.
- `/br/nfc-keychains`, `/br/nfc-guide` e `/br/nfc-order` retornam/renderizam as
  três experiências distintas.
- Canonical e hreflang não apontam duas URLs para o mesmo conteúdo.
- Nenhum link público novo usa a palavra `pricing`.

### Wave 4 — Verificação e publicação

1. Rodar `npm run check`.
2. Rodar `npm run build`.
3. Validar manualmente EN/PT e mobile/desktop.
4. Testar o pedido completo nos três tipos de chaveiro, incluindo upload e
   retomada.
5. Conferir no admin que o snapshot de preço, tipo e quantidade foi preservado.
6. Implantar o código no Coolify; as novas rotas não dependem de seed.
7. Fazer smoke test nas URLs públicas depois do deploy.

## Matriz mínima de QA

| Cenário | Resultado esperado |
|---|---|
| LP PT → “Veja modelos” | Abre `/br/nfc-guide`. |
| Guia PT → “Fazer pedido” | Abre `/br/nfc-order` diretamente no passo 1. |
| Pedido Flat, 20 peças | Mostra cálculo vindo de `shared/nfc-pricing.ts`. |
| Pedido Alto-relevo | Mostra preço a confirmar no WhatsApp, sem valor falso. |
| Pedido Shape/bonequinho | Mostra orçamento individual e salva `custom-shape`. |
| Recarregar no meio do pedido | Retoma respostas e passo salvos. |
| Concluir pedido | Cria lead, snapshot e redireciona ao obrigado. |
| Abrir CTA modal na LP | Modal continua funcionando com o mesmo motor. |
| URL antiga `/br/nfc-pricing` | Redireciona em um salto para `/br/nfc-guide`. |
| Alternar EN/PT no guia | Troca entre `/nfc-guide` e `/br/nfc-guide`. |

## Fora de escopo

- Checkout ou cobrança online.
- Definir preço automático para alto-relevo ou shape customizado.
- Alterar faixas, mínimo ou taxa de arte sem decisão comercial separada.
- Refazer a landing page principal além dos links necessários.
- Criar galeria fotográfica sem imagens reais e aprovadas dos modelos.
- Migrar todos os formulários públicos do site para full screen; esta entrega é
  específica do pedido de chaveiros NFC.

## Riscos e cuidados

- **Rota sombreada:** `/:slug` pode capturar `/nfc-order`; a rota explícita deve
  vir antes dele.
- **Fonte duplicada:** conteúdo do guia não pode criar uma tabela paralela de
  modelos ou preços.
- **Regressão do modal:** a nova apresentação precisa compartilhar o motor, mas
  preservar portal, focus trap, Escape e fechamento apenas no modo modal.
- **Rota legada ativa no banco:** a rota explícita tem precedência, mas as linhas
  antigas devem ser desativadas no admin para evitar confusão editorial futura.
- **SEO concorrente:** formulário de pedido não deve competir com a LP e o guia
  por termos de busca.
- **Traduções antigas:** o seed atual contém textos obsoletos de `pricing` e deve
  ser limpo/renomeado sem apagar traduções compartilhadas por outras páginas.

## Definição de pronto

- As três funções têm URLs, visual e comportamento inequívocos.
- O guia resolve dúvidas de modelo e preço sem parecer uma página de compra.
- O pedido abre como formulário full screen em um link direto.
- Modal e full screen usam exatamente as mesmas regras e endpoints.
- EN/PT, canonical, hreflang, redirects e atribuição foram verificados.
- Type check, build e fluxo manual completo passam em produção.
