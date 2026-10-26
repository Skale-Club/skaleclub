// Present mode: a board becomes a list of "slides" (camera targets).
//  - With frames: each frame, in reading order (rows top to bottom, left to
//    right inside a row).
//  - Otherwise, for mind maps: each map's overview, then each first-level
//    branch (framed with its subtree; the caller dims everything else).
//  - Anything else: one step showing the whole board.
// Pure, so it runs under `npm test`.
import type { BoardDocument } from "../schema/boards.js";
import { unionBox, type Box, type CanvasSizeSource } from "./canvasOps.js";
import { boardContentBounds, nodeBoxes } from "./bounds.js";
import { buildMindForest, collectSubtree, computeHiddenMindNodes } from "./layout.js";

export interface PresentStep {
  id: string;
  kind: "frame" | "map" | "branch" | "all";
  /** What the camera frames (board coordinates). */
  box: Box;
  /** Nodes that stay at full strength; every other node is dimmed. null = nothing is dimmed. */
  focusIds: string[] | null;
  title?: string;
}

/** Frame ids in reading order. A row is every frame whose top lies within half a frame height of the row's first. */
export function frameReadingOrder(frames: { id: string; box: Box }[]): string[] {
  const sorted = [...frames].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const rows: { top: number; height: number; items: typeof sorted }[] = [];
  for (const frame of sorted) {
    const row = rows.find((r) => Math.abs(frame.box.y - r.top) <= r.height / 2);
    if (row) row.items.push(frame);
    else rows.push({ top: frame.box.y, height: frame.box.h, items: [frame] });
  }
  return rows.flatMap((row) => row.items.sort((a, b) => a.box.x - b.box.x).map((f) => f.id));
}

export function buildPresentSteps(doc: Pick<BoardDocument, "nodes" | "edges" | "strokes">, sizes?: CanvasSizeSource): PresentStep[] {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const boxes = nodeBoxes(doc, { sizes, forest });

  const frames = doc.nodes
    .filter((n) => n.data.type === "frame" && boxes.has(n.id))
    .map((n) => ({ id: n.id, box: boxes.get(n.id)!, title: n.data.type === "frame" ? n.data.title : undefined }));
  if (frames.length) {
    const byId = new Map(frames.map((f) => [f.id, f]));
    return frameReadingOrder(frames).map((id) => ({ id, kind: "frame", box: byId.get(id)!.box, focusIds: null, title: byId.get(id)!.title }));
  }

  if (forest.roots.length) {
    const hidden = computeHiddenMindNodes(forest);
    const steps: PresentStep[] = [];
    const roots = [...forest.roots].sort((a, b) => {
      const pa = forest.nodes.get(a)!.position;
      const pb = forest.nodes.get(b)!.position;
      return pa.y - pb.y || pa.x - pb.x;
    });
    for (const rootId of roots) {
      const inMap = Array.from(forest.rootOf.entries())
        .filter(([id, root]) => root === rootId && !hidden.has(id))
        .map(([id]) => boxes.get(id))
        .filter((b): b is Box => !!b);
      const overview = unionBox(inMap);
      if (!overview) continue;
      const rootNode = forest.nodes.get(rootId)!;
      steps.push({ id: rootId, kind: "map", box: overview, focusIds: null, title: rootNode.data.type === "mind" ? rootNode.data.text : undefined });
      for (const branchId of forest.children.get(rootId) ?? []) {
        if (hidden.has(branchId)) continue;
        const ids = [branchId, ...collectSubtree(forest, branchId)].filter((id) => !hidden.has(id));
        const box = unionBox(ids.map((id) => boxes.get(id)).filter((b): b is Box => !!b));
        if (!box) continue;
        const branch = forest.nodes.get(branchId)!;
        steps.push({ id: branchId, kind: "branch", box, focusIds: ids, title: branch.data.type === "mind" ? branch.data.text : undefined });
      }
    }
    if (steps.length) return steps;
  }

  const all = boardContentBounds(doc, { sizes, forest });
  return all ? [{ id: "all", kind: "all", box: all, focusIds: null }] : [];
}
