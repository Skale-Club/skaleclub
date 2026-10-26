// AI commands on the board. Each one ends in a single store edit (one undo step).
import { insertOutline } from '@shared/boards/mindOps';
import { boardToOutlineText } from '@shared/boards/summary';
import type { BoardStore } from '../store/boardStore';
import { getMindForest } from '../mindmap/autoLayout';
import { importOutlineText, selectNode } from '../mindmap/actions';
import { requestExpand, requestMindmap, requestSummary, type AiLanguage } from './boardsAiApi';

/** A topic becomes a new map at the centre of the view. Returns the new root. */
export async function generateMindmapFromTopic(store: BoardStore, input: { topic: string; depth: 2 | 3; language: AiLanguage }): Promise<string | null> {
  const outline = await requestMindmap(input);
  return importOutlineText(store, outline, input.topic);
}

/** Ancestor texts from the central topic down to the node's parent. */
function pathTo(store: BoardStore, id: string): string[] {
  const { document: doc } = store.getState();
  const forest = getMindForest(doc.nodes, doc.edges);
  const path: string[] = [];
  let parent = forest.parent.get(id);
  while (parent !== undefined && path.length < 30) {
    const node = forest.nodes.get(parent);
    if (node?.data.type === 'mind') path.unshift(node.data.text);
    parent = forest.parent.get(parent);
  }
  return path;
}

/** Thrown before any request when the topic to expand has no text yet. */
export class EmptyTopicError extends Error {
  constructor() {
    super('Write the topic text first');
    this.name = 'EmptyTopicError';
  }
}

/** Asks for 3 to 6 children and adds them under the node in one undo step. Returns how many were added. */
export async function expandNodeWithAi(store: BoardStore, id: string, language: AiLanguage): Promise<number> {
  const state = store.getState();
  if (state.readOnly || state.aiBusyNodeId) return 0;
  const forest = getMindForest(state.document.nodes, state.document.edges);
  const node = forest.nodes.get(id);
  if (!node || node.data.type !== 'mind') return 0;
  // Nothing to expand on: say so instead of sending an empty prompt.
  if (!node.data.text.trim()) throw new EmptyTopicError();
  const existing = (forest.children.get(id) ?? []).map((child) => forest.nodes.get(child)).flatMap((n) => (n?.data.type === 'mind' ? [n.data.text] : []));
  state.setAiBusyNode(id);
  try {
    const children = await requestExpand({ topic: node.data.text, path: pathTo(store, id), existing, language });
    // The map may have changed while the model was thinking.
    const now = store.getState();
    if (!getMindForest(now.document.nodes, now.document.edges).nodes.has(id)) return 0;
    const { doc, ids } = insertOutline(now.document, children.map((text) => ({ text, children: [] })), { parentId: id }, { sizes: now.measured });
    if (!ids.length) return 0;
    now.setDocument(doc);
    selectNode(store, ids[0], { focus: true });
    return ids.length;
  } finally {
    store.getState().setAiBusyNode(null);
  }
}

/** The board as an outline (maps keep their tree; canvases list frames and notes), summarized by the model. */
export async function summarizeBoard(store: BoardStore, language: AiLanguage): Promise<string | null> {
  const outline = boardToOutlineText(store.getState().document);
  if (!outline) return null;
  return requestSummary({ outline: outline.slice(0, 30_000), language });
}
