import { useCallback, useMemo, useRef, useState } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import { collectSubtree } from '@shared/boards/layout';
import type { BoardStore } from '../store/boardStore';
import { reparentByDrop } from './actions';
import { getMindForest } from './autoLayout';

type PointerLike = { clientX: number; clientY: number };

function pointerOf(event: unknown): PointerLike | null {
  const e = event as Partial<PointerLike> & { touches?: ArrayLike<PointerLike>; changedTouches?: ArrayLike<PointerLike> };
  if (typeof e?.clientX === 'number' && typeof e.clientY === 'number') return { clientX: e.clientX, clientY: e.clientY };
  const touch = e?.touches?.[0] ?? e?.changedTouches?.[0];
  return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
}

/**
 * The interactive half of the mind-map auto layout (the layout itself runs in
 * the store on every edit, see autoLayout.ts):
 * - node moves animate (the canvas adds `board-animate` while `animate` is true;
 *   it is off during a drag so nodes follow the pointer 1:1);
 * - dragging a branch carries its subtree; dropping it on another mind node
 *   reparents it (the target is highlighted, cycles are refused), dropping it
 *   anywhere else snaps it back into the layout;
 * - dragging a root moves the whole map.
 * The drag, the reparent and the relayout are one undo step.
 */
export function useAutoLayout(store: BoardStore, reactFlow: Pick<ReactFlowInstance, 'screenToFlowPosition' | 'getNodes'>) {
  const [dragging, setDragging] = useState(false);
  const branchRef = useRef<{ id: string; excluded: Set<string> } | null>(null);
  const pointRef = useRef<{ x: number; y: number } | null>(null);

  const findTarget = useCallback(
    (point: { x: number; y: number }, excluded: Set<string>) => {
      const { document: doc } = store.getState();
      const forest = getMindForest(doc.nodes, doc.edges);
      let best: { id: string; area: number } | null = null;
      for (const node of reactFlow.getNodes()) {
        if (excluded.has(node.id) || node.hidden || !forest.nodes.has(node.id)) continue;
        const w = node.measured?.width ?? node.width ?? 0;
        const h = node.measured?.height ?? node.height ?? 0;
        // A little slack around small nodes makes them easier to hit.
        const pad = 6;
        if (point.x < node.position.x - pad || point.x > node.position.x + w + pad || point.y < node.position.y - pad || point.y > node.position.y + h + pad) continue;
        const area = w * h;
        if (!best || area < best.area) best = { id: node.id, area };
      }
      return best?.id ?? null;
    },
    [reactFlow, store],
  );

  const onNodeDragStart = useCallback(
    (_event: unknown, node: Node, nodes: Node[]) => {
      setDragging(true);
      const state = store.getState();
      state.beginBatch();
      branchRef.current = null;
      const forest = getMindForest(state.document.nodes, state.document.edges);
      if (nodes.length <= 1 && forest.nodes.has(node.id) && forest.parent.has(node.id)) {
        branchRef.current = { id: node.id, excluded: new Set([node.id, ...collectSubtree(forest, node.id)]) };
      }
    },
    [store],
  );

  const onNodeDrag = useCallback(
    (event: unknown) => {
      const branch = branchRef.current;
      if (!branch) return;
      const pointer = pointerOf(event);
      if (!pointer) return;
      const point = reactFlow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      pointRef.current = point;
      store.getState().setDropTarget(findTarget(point, branch.excluded));
    },
    [findTarget, reactFlow, store],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: Node, nodes: Node[]) => {
      const state = store.getState();
      const target = state.dropTargetId;
      const branch = branchRef.current;
      branchRef.current = null;
      state.setDropTarget(null);
      let reparented = false;
      if (branch && target) reparented = reparentByDrop(store, branch.id, target, pointRef.current ?? undefined);
      if (!reparented) {
        // Branches never keep a hand-dragged position: they snap back.
        const forest = getMindForest(state.document.nodes, state.document.edges);
        const moved = nodes.map((n) => n.id).filter((id) => forest.parent.has(id));
        if (moved.length) store.getState().relayout(moved);
      }
      pointRef.current = null;
      setDragging(false);
      store.getState().endBatch();
    },
    [store],
  );

  const onSelectionDragStart = useCallback(() => setDragging(true), []);
  const onSelectionDragStop = useCallback(() => setDragging(false), []);

  return useMemo(
    () => ({ animate: !dragging, onNodeDragStart, onNodeDrag, onNodeDragStop, onSelectionDragStart, onSelectionDragStop }),
    [dragging, onNodeDrag, onNodeDragStart, onNodeDragStop, onSelectionDragStart, onSelectionDragStop],
  );
}
