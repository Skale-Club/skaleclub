# Boards: Mind Map + Canvas livre (estilo MindMeister / Miro)

**Status:** planejamento, aguardando aprovação antes de implementar.
**Branch:** `feat/youthful-ritchie-33u74x`

---

## 1. Objetivo

Criar dentro do site um sistema de **Boards** que funcione como:

1. **Mind map** inspirado no MindMeister, mas mais moderno e fluido: criar nós pelo
   teclado, layout automático, ramos coloridos, colapsar/expandir, sem sensação de
   "travado".
2. **Canvas livre** estilo Miro: post-its, formas, texto, frames, conectores,
   imagens, caneta, com zoom/pan infinito e suave.

Os dois vivem no **mesmo editor e no mesmo documento**: um mind map é um canvas em
que os nós fazem parte de uma árvore com layout automático. Dá para ter um mapa
mental no meio de um board com post-its em volta, como no Miro.

---

## 2. O que já existe e será reaproveitado

O repo já tem **Whiteboards** (Excalidraw), que serve de molde para toda a
infraestrutura:

| Já existe | Arquivo | Como reaproveitar |
|---|---|---|
| Tabela com `slug`, `scene` jsonb, `thumbnailUrl`, `version` (controle de conflito) | `shared/schema/whiteboards.ts` | Mesmo desenho para a tabela `boards` |
| Rotas CRUD + público por slug + 409 `version_conflict` | `server/routes/whiteboards.ts` | Copiar o padrão, incluindo o limite de body grande (`LARGE_BODY_RE`) |
| Lista paginada com busca e thumbnails, abertura por URL `/admin/whiteboards/:id` | `client/src/components/admin/WhiteboardsSection.tsx` | Mesma UX de lista/cards |
| Editor em portal full-screen, dirty state, Ctrl+S, guarda de "voltar", diálogo de conflito | `client/src/components/admin/whiteboards/WhiteboardEditor.tsx` | Reutilizar o shell (barra superior, save, conflito), trocando o Excalidraw pelo novo motor |
| Página pública `/w/:slug` em modo leitura | `client/src/pages/WhiteboardViewer.tsx` + `App.tsx` | Nova rota `/b/:slug` com a mesma estrutura |
| Testes de rota com tabela em memória + e2e em Chromium/Firefox/WebKit | `server/routes/__tests__/`, `e2e/whiteboards.e2e.ts` | Mesmo harness para `boards` |
| Upload assinado para Supabase Storage | `server/routes/uploads.ts` | Imagens do board vão para o storage, não embutidas no JSON |
| Provedores de IA (Gemini, OpenAI, Groq) | `server/integrations`, `package.json` | "Gerar mapa com IA" e "expandir nó" |

**Os Whiteboards atuais continuam existindo.** Eles servem para desenho à mão
livre nos vídeos do YouTube. Boards é um produto novo ao lado, não uma
substituição. Se mais tarde fizer sentido, a seção Whiteboards pode ser
rebaixada para um "tipo" dentro de Boards.

---

## 3. Decisão de motor de canvas

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **React Flow (`@xyflow/react`)** | MIT, maduro, nós e arestas como componentes React (estilizamos tudo com Tailwind/tokens da marca), pan/zoom suave via d3-zoom, culling de viewport, seleção em caixa, snap, minimap, sub-flows (frames) nativos | Caneta livre e texto rico não vêm prontos (construímos em cima); layout de árvore é nosso | **Escolhido** |
| tldraw SDK | O mais "Miro" de todos de cara: caneta, formas, frames, setas inteligentes, colaboração | Licença: gratuito só com marca d'água "Made with tldraw"; uso comercial sem marca exige licença paga. Mind map ainda seria um shape custom nosso | Descartado pela licença |
| Excalidraw (já no repo) | Já integrado, caneta ótima | Estética "rabiscada", sem noção de árvore, sem layout automático, UI pouco customizável. É o que dá a sensação "travada" para mind map | Mantido só para Whiteboards |
| Motor próprio em Canvas 2D | Controle total | Meses de trabalho só para chegar onde React Flow já está | Descartado |

Bibliotecas de apoio (todas MIT):

- `@xyflow/react` – canvas, nós, arestas, viewport.
- `zustand` + `zundo` – store do documento e undo/redo (zustand já é dependência
  transitiva do React Flow).
- `d3-hierarchy` – layout de árvore para o mind map (tidy tree, dois lados).
- `perfect-freehand` – traços da caneta (já está no lockfile via Excalidraw).
- `html-to-image` – thumbnail e export PNG/SVG no cliente, como já é feito hoje.
- `jspdf` só se o export PDF entrar na fase 3.

---

## 4. Modelo de dados

### 4.1 Tabela `boards` (nova migração em `migrations/`)

```
boards
  id            uuid pk
  slug          text unique           -- público em /b/:slug
  title         text
  kind          text  'mindmap' | 'canvas'   -- só define o template inicial e o ícone no card
  document      jsonb                 -- ver 4.2
  thumbnail_url text null
  visibility    text  'private' | 'link'     -- 'link' = qualquer um com o slug vê
  version       integer default 1     -- mesmo esquema de conflito dos whiteboards
  created_by    uuid null -> users
  created_at, updated_at
```

Imagens enviadas pelo usuário vão para Supabase Storage (bucket `boards`) e o
documento guarda só a URL. Isso mantém o JSON pequeno e o save rápido, diferente
dos whiteboards que embutem base64.

### 4.2 Documento (`shared/schema/boards.ts`, validado com Zod)

```ts
BoardDocument {
  schemaVersion: 1
  nodes: BoardNode[]
  edges: BoardEdge[]
  strokes: Stroke[]                 // caneta livre, fora do grafo
  viewport?: { x, y, zoom }         // só para reabrir onde parou
  theme: { palette: 'brand' | 'pastel' | 'mono', background: 'dots' | 'grid' | 'plain', dark?: boolean }
}

BoardNode {
  id, type, position: {x,y}, size?: {w,h}, parentId?: string (frame), zIndex, locked?
  data: discriminated union por `type`:
    'mind'    { text, color, collapsed, icon?, note?, link?, task?: {done}, rootId, side: 'left'|'right'|'auto' }
    'sticky'  { text, color }
    'shape'   { shape: 'rect'|'rounded'|'ellipse'|'diamond'|'triangle', text, fill, stroke }
    'text'    { text, fontSize, align }
    'frame'   { title, color }
    'image'   { url, alt, naturalW, naturalH }
}

BoardEdge {
  id, source, target, kind: 'tree' | 'connector'
  data: { label?, color?, style: 'curve'|'straight'|'step', arrowStart?, arrowEnd?, dashed? }
}
```

**Regra central:** arestas `tree` definem a hierarquia do mind map; o layout
automático reposiciona os nós `mind` a partir delas. Arestas `connector` são
livres (Miro). Um nó `mind` solto (sem aresta `tree` chegando) é raiz de um mapa.

Limites de validação: 5.000 nós, 10.000 arestas, 2.000 traços, texto de nó até
2.000 caracteres, documento até o `LARGE_BODY_LIMIT` atual.

---

## 5. Experiência do editor

### 5.1 Layout da tela

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Voltar   [Título editável]   ● Salvo há 2s     Compartilhar ▾  ⋯ │  topbar 56px
├────┬─────────────────────────────────────────────────────┬────────┤
│ 🖱 │                                                     │ Painel │
│ 🧠 │                                                     │ de     │
│ 📝 │              canvas infinito                        │ estilo │
│ ▭  │              (pontos de fundo, snap)                │ ou     │
│ T  │                                                     │outline │
│ ⤷  │                                                     │        │
│ ✎  │                                   ┌──────┐          │        │
│ 🖼 │                                   │minimap│         │        │
│ ▦  │                                   └──────┘          │        │
├────┴─────────────────────────────────────────────────────┴────────┤
│ − 100% +   ⊡ ajustar   ↶ ↷                              ⌘? atalhos │  rodapé
└──────────────────────────────────────────────────────────────────┘
```

- Barra de ferramentas vertical à esquerda (Miro-like): Selecionar, Mind map,
  Post-it, Forma, Texto, Conector, Caneta, Imagem, Frame, Template.
- Painel direito contextual: estilo do que está selecionado (cor, forma, fonte,
  seta) ou **Outline** do mind map (árvore em texto, arrastável, clica e centraliza).
- Topbar reaproveita a do WhiteboardEditor: título, status de save, link público,
  salvar.
- Mobile: barra de ferramentas vira uma barra inferior; painel direito vira
  sheet; gestos de pinça e dois dedos para pan.

### 5.2 Mind map (o que faz ele parecer "moderno e solto")

| Interação | Comportamento |
|---|---|
| `Tab` | cria filho do nó selecionado e já entra em edição |
| `Enter` | cria irmão abaixo |
| `Shift+Tab` | sobe um nível (reparent para o avô) |
| `Delete`/`Backspace` | apaga nó e subárvore (com undo) |
| Setas | navega pela árvore (pai, filho, irmão) |
| `Espaço` ou clique no botão `−/+` | colapsa/expande ramo, com contador de filhos escondidos |
| Arrastar nó | solta em cima de outro nó para reparentar; sombra mostra onde vai cair; animação de 180ms até a nova posição |
| Duplo clique no vazio | cria novo mapa (nova raiz) ali |
| `/` dentro do nó | menu rápido: ícone, cor, tarefa, nota, link, imagem |
| Colar texto com indentação | vira subárvore (importar de Markdown/lista) |

Layout: tidy tree com `d3-hierarchy`, balanceado em dois lados a partir da raiz
(como o MindMeister), com opção de "só para a direita" e "org chart" (vertical).
Cada mudança reposiciona só o mapa afetado e anima a transição. Cor do ramo é
herdada do filho direto da raiz; usuário pode sobrescrever.

Arestas em curva bezier com espessura que afina conforme a profundidade. Nós em
pílula arredondada, tipografia do site, raiz maior e com fundo navy `#0A162E`
no tema brand.

### 5.3 Canvas livre (Miro-lite)

- **Post-its**: 8 cores pastel, texto auto-ajusta tamanho, duplo clique edita.
- **Formas**: retângulo, arredondado, elipse, losango, triângulo, com texto.
- **Texto** solto com tamanho/alinhamento.
- **Conectores**: arrasto da alça do nó para outro nó; rótulo no meio; setas
  nas pontas; curvo/reto/escada; tracejado.
- **Frames**: agrupam o que está dentro (sub-flow do React Flow); mover o frame
  move o conteúdo; título editável; servem para exportar "uma tela".
- **Caneta**: traços com `perfect-freehand`, cor e espessura, borracha por traço.
- **Imagens**: upload (Supabase Storage), colar do clipboard, arrastar arquivo.
- Seleção múltipla, grupo/desagrupar, alinhar e distribuir, trazer para
  frente/fundo, travar, duplicar (`Ctrl+D`), copiar/colar entre boards, linhas
  guia de alinhamento ao arrastar, snap na grade (opcional).
- Undo/redo ilimitado na sessão (`zundo`).
- Templates iniciais: Mind map em branco, Brainstorm (post-its), SWOT, Kanban,
  Jornada do cliente, Retrospectiva.

### 5.4 Salvamento

- Autosave com debounce de 1,5 s após a última alteração, mais `Ctrl+S` e
  save ao sair. Indicador "Salvando… / Salvo há Xs / Sem conexão, alterações
  pendentes".
- Controle de versão otimista igual ao dos whiteboards: envia `baseVersion`,
  recebe 409 se outra aba salvou, diálogo "Sobrescrever / Carregar salvo".
- Snapshot no `localStorage` por board como rede de segurança se a aba fechar
  com save pendente; ao reabrir, oferece restaurar.

### 5.5 Página pública `/b/:slug`

- Modo leitura com zoom/pan, colapsar ramos permitido, botão "Ajustar à tela",
  tema claro/escuro, título em sobreposição, `noindex`.
- Só responde quando `visibility = 'link'`; privado devolve 404.
- Botão "Apresentar": percorre frames (canvas) ou ramos de primeiro nível (mind
  map) um por um, como slides.

### 5.6 Export e import

- Export PNG e SVG (board inteiro ou frame selecionado), Markdown/lista
  indentada do mind map, JSON do documento.
- Import: Markdown/lista indentada, JSON do próprio Boards.

### 5.7 IA (opcional, fase 3)

- "Gerar mapa a partir de um tema": prompt → árvore em JSON → inserida como mapa.
- "Expandir este nó": sugere 3 a 6 filhos.
- "Resumir board": gera texto a partir do outline.
- Usa o provedor já configurado em Integrações; sem chave, os botões não aparecem.

---

## 6. Arquitetura de código

```
shared/schema/boards.ts                      # tabela drizzle + Zod do documento + tipos
shared/boards/layout.ts                      # tidy tree (puro, testável em Node)
shared/boards/outline.ts                     # árvore ⇄ markdown/lista indentada
shared/boards/*.test.ts

server/routes/boards.ts                      # CRUD, público por slug, visibilidade, 409
server/routes/boardsAi.ts                    # fase 3
server/routes/__tests__/boards.test.ts
server/routes/__tests__/helpers/boardsHarness.ts
server/storage.ts                            # listBoards/getBoard/getBoardBySlug/create/update/delete
server/lib/bodyLimits.ts                     # incluir /api/boards no LARGE_BODY_RE
migrations/0059_boards.sql

client/src/features/boards/
  store/boardStore.ts                        # zustand + zundo: documento, seleção, ferramenta ativa
  store/history.ts
  engine/BoardCanvas.tsx                     # ReactFlow + plugins (pen layer, guides, minimap)
  engine/nodes/{MindNode,StickyNode,ShapeNode,TextNode,FrameNode,ImageNode}.tsx
  engine/edges/{TreeEdge,ConnectorEdge}.tsx
  engine/layers/PenLayer.tsx                 # SVG com perfect-freehand por cima do canvas
  engine/layers/GuidesLayer.tsx
  mindmap/useMindmapKeyboard.ts              # Tab/Enter/setas
  mindmap/useAutoLayout.ts                   # chama shared/boards/layout com animação
  mindmap/reparent.ts
  ui/{Toolbar,StylePanel,OutlinePanel,ZoomBar,ShareMenu,TemplatePicker,ShortcutsDialog}.tsx
  io/{exportImage,exportMarkdown,importMarkdown,thumbnail}.ts
  io/autosave.ts
  BoardEditor.tsx                            # shell (topbar, conflito, portal) derivado do WhiteboardEditor
  BoardViewer.tsx                            # modo leitura usado em /b/:slug

client/src/components/admin/BoardsSection.tsx   # lista/cards, igual WhiteboardsSection
client/src/pages/BoardViewer.tsx                # rota pública
client/src/App.tsx                              # rota /b/:slug
client/src/pages/Admin.tsx + AdminSidebar.tsx    # seção "Boards"
shared/reservedSlugs.ts                          # reservar "b"
e2e/boards.e2e.ts
```

Princípios:

- O **store é a única fonte de verdade**; React Flow recebe nós/arestas derivados
  e devolve eventos. Isso facilita undo/redo, autosave e, depois, colaboração.
- Layout e conversões ficam em `shared/` sem dependência de DOM para rodar em
  `npm test`.
- Editor carregado com `lazy()` como hoje: o bundle do board só desce quando
  alguém abre um.
- Textos de UI passam por `useTranslation()` (pt/en) como o resto do admin.

---

## 7. Fases e entregas

### Fase 0 – Fundação (2 a 3 dias)
- Migração, schema, storage, rotas e testes de rota (copiando o harness dos whiteboards).
- Seção "Boards" no admin: lista, busca, criar (escolhe Mind map ou Canvas), apagar, abrir.
- Shell do editor: topbar, canvas vazio com pan/zoom, fundo pontilhado, zoom bar,
  autosave + conflito, thumbnail no save.
- Rota pública `/b/:slug` com visibilidade.
- **Critério de pronto:** criar um board, mover a câmera, recarregar e ver o
  viewport/documento persistidos; `npm test` e `npm run check` verdes.

### Fase 1 – Mind map (4 a 5 dias)
- Nó `mind`, aresta `tree`, layout automático dois lados, animação.
- Teclado completo (Tab/Enter/Shift+Tab/Delete/setas/F2), edição inline,
  colapsar/expandir, drag para reparentar, cores por ramo, ícones, nota, link, tarefa.
- Outline panel, import/export Markdown.
- Undo/redo.
- **Critério de pronto:** montar um mapa de 100 nós só pelo teclado sem travar
  (60 fps no drag em notebook comum), e2e em Chromium cobrindo criar filho/irmão,
  colapsar, reparentar, salvar e abrir público.

### Fase 2 – Canvas livre (4 a 5 dias)
- Post-it, forma, texto, frame, imagem (upload Supabase), conector com rótulo.
- Caneta e borracha.
- Multi-seleção, alinhar/distribuir, z-order, travar, duplicar, copiar/colar,
  linhas guia, snap.
- Painel de estilo contextual, templates.
- Mobile: toolbar inferior, gestos.
- **Critério de pronto:** reproduzir um SWOT e um Kanban só com a UI; e2e para
  post-it, conector e frame; e2e em Firefox/WebKit como já se faz hoje.

### Fase 3 – Acabamento (2 a 3 dias)
- Export PNG/SVG, modo apresentar, atalhos (`⌘?`), tema escuro, snapshot local.
- IA: gerar mapa, expandir nó (se houver provedor configurado).
- Revisão visual com os tokens do `DESIGN_SYSTEM.md`, revisão em telas de
  celular e desktop.

### Fase 4 – Colaboração em tempo real (futuro, separado)
- Yjs no store + `y-websocket` servido pelo mesmo Express (o container na
  Coolify aceita WebSocket), cursores e seleção dos outros, comentários em nó.
- Não entra agora: exige sessão para convidados, limites de conexão e outro
  modelo de permissão. O store já nasce preparado (documento = estado puro).

Total estimado para as fases 0 a 3: **12 a 16 dias de trabalho**, entregue em
PRs por fase para dar para testar cedo.

---

## 8. Testes

- **Unitários (`npm test`)**: layout de árvore (posições determinísticas, dois
  lados, nós colapsados), outline ⇄ markdown, validação Zod do documento com
  limites, rotas de `boards` com tabela em memória (CRUD, slug, visibilidade,
  409 de versão, body grande).
- **E2E (`npm run test:e2e`)**: suíte `boards.e2e.ts` nos três engines, cobrindo
  os critérios de pronto das fases 1 e 2, público em celular emulado.
- **Manual antes de cada PR**: trackpad no Mac (pinça e scroll), mouse com roda,
  touch no celular, modo escuro, 500 nós.

---

## 9. Riscos e como lidar

| Risco | Mitigação |
|---|---|
| Performance com muitos nós | `onlyRenderVisibleElements` do React Flow, memo nos nós, layout só do mapa afetado, limite de 5.000 nós |
| Caneta "pesada" em SVG | Traços concluídos vão para um `<canvas>` rasterizado; só o traço ativo fica em SVG |
| Documento crescer com imagens | Imagens sempre no storage; o JSON guarda URL |
| Conflito entre abas | Mesmo esquema de versão já testado nos whiteboards |
| Escopo virar "o Miro inteiro" | Fases fechadas com critério de pronto; colaboração em tempo real fica fora |
| Texto rico (negrito, listas) dentro de nós | Fase 1 e 2 usam texto simples com quebras de linha; rich text fica como follow-up |

---

## 10. Decisões que precisam de confirmação

Vou seguir com os padrões abaixo se não houver objeção:

1. **Nome do produto:** "Boards" no admin, rota pública `/b/:slug`.
2. **Quem edita:** só admins logados, como os whiteboards. Visualização pública
   por link opcional por board.
3. **Whiteboards (Excalidraw) permanecem** como estão.
4. **Motor:** React Flow (MIT). tldraw descartado por licença.
5. **Colaboração em tempo real fica para a fase 4**, fora deste ciclo.
6. **Idioma da UI:** pt/en via o sistema de tradução atual.
