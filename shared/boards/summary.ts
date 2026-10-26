// A board as plain outline text, for "Summarize board". Mind maps keep their
// tree; a free canvas becomes one bullet per frame (its notes below it) and one
// per loose note, shape, text or image caption, in reading order. Pure.
import type { BoardDocument, BoardNode } from "../schema/boards.js";
import { nodeBoxes } from "./bounds.js";
import { buildMindForest } from "./layout.js";
import { outlineFromMindMap, outlineToMarkdown, type OutlineItem } from "./outline.js";

function textOf(node: BoardNode): string {
  const d = node.data;
  switch (d.type) {
    case "mind":
    case "sticky":
    case "text":
      return d.text.trim();
    case "shape":
      return (d.text ?? "").trim();
    case "frame":
      return (d.title ?? "").trim();
    case "image":
      return (d.alt ?? "").trim();
  }
}

export function boardToOutlineText(doc: Pick<BoardDocument, "nodes" | "edges" | "strokes">): string {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const items: OutlineItem[] = [];
  for (const rootId of forest.roots) {
    const item = outlineFromMindMap(doc, rootId, forest);
    if (item) items.push(item);
  }

  const boxes = nodeBoxes(doc);
  const reading = (a: BoardNode, b: BoardNode) => {
    const pa = boxes.get(a.id) ?? { x: a.position.x, y: a.position.y };
    const pb = boxes.get(b.id) ?? { x: b.position.x, y: b.position.y };
    return pa.y - pb.y || pa.x - pb.x;
  };
  const canvas = doc.nodes.filter((n) => n.data.type !== "mind");
  const frames = canvas.filter((n) => n.data.type === "frame").sort(reading);
  const frameIds = new Set(frames.map((f) => f.id));
  for (const frame of frames) {
    const children = canvas
      .filter((n) => n.parentId === frame.id && n.data.type !== "frame")
      .sort(reading)
      .map((n) => textOf(n))
      .filter(Boolean)
      .map((text) => ({ text, children: [] }));
    const title = textOf(frame);
    if (title || children.length) items.push({ text: title || "Frame", children });
  }
  for (const node of canvas.filter((n) => n.data.type !== "frame" && !(n.parentId && frameIds.has(n.parentId))).sort(reading)) {
    const text = textOf(node);
    if (text) items.push({ text, children: [] });
  }
  return items.length ? outlineToMarkdown(items).trimEnd() : "";
}
