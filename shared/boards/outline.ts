// Mind map <-> outline text. The outline panel, "Export outline (Markdown)",
// "Import from text" and pasting indented text into a node all go through
// here. Pure, so it runs under `npm test`.
//
// Format written: an optional `# Root` heading, then `- text` bullets with two
// spaces of indentation per level. Line breaks inside a node become `<br>`.
// Read: the same, plus `*`/`+`/`1.` bullets, plain indented lines, tabs, any
// consistent indentation width and `#`..`######` headings.
import type { BoardEdge, BoardNode } from "../schema/boards.js";
import { buildMindForest, type MindForest } from "./layout.js";

export interface OutlineItem {
  text: string;
  children: OutlineItem[];
  collapsed?: boolean;
}

/** The tree under `rootId` (any mind node) as outline items. */
export function outlineFromMindMap(
  doc: { nodes: readonly BoardNode[]; edges: readonly BoardEdge[] },
  rootId: string,
  forest: MindForest = buildMindForest(doc.nodes, doc.edges),
): OutlineItem | null {
  const visit = (id: string, seen: Set<string>): OutlineItem | null => {
    const node = forest.nodes.get(id);
    if (!node || node.data.type !== "mind" || seen.has(id)) return null;
    seen.add(id);
    const children: OutlineItem[] = [];
    for (const child of forest.children.get(id) ?? []) {
      const item = visit(child, seen);
      if (item) children.push(item);
    }
    const item: OutlineItem = { text: node.data.text, children };
    if (node.data.collapsed && children.length) item.collapsed = true;
    return item;
  };
  return visit(rootId, new Set());
}

const encodeText = (text: string) => text.replace(/\r?\n/g, "<br>").trim();
const decodeText = (text: string) => text.replace(/<br\s*\/?>/gi, "\n").trim();

export function outlineToMarkdown(items: OutlineItem[], opts: { rootAsHeading?: boolean } = {}): string {
  const lines: string[] = [];
  const bullets = (list: OutlineItem[], level: number) => {
    for (const item of list) {
      lines.push(`${"  ".repeat(level)}- ${encodeText(item.text)}`);
      bullets(item.children, level + 1);
    }
  };
  if (opts.rootAsHeading) {
    items.forEach((item, i) => {
      if (i > 0) lines.push("");
      lines.push(`# ${encodeText(item.text)}`);
      if (item.children.length) lines.push("");
      bullets(item.children, 0);
    });
  } else {
    bullets(items, 0);
  }
  return lines.join("\n") + "\n";
}

/** A whole mind map as Markdown: `# Root` and a bullet list below it. */
export function mindMapToMarkdown(doc: { nodes: readonly BoardNode[]; edges: readonly BoardEdge[] }, rootIds: string[]): string {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const items = rootIds.map((id) => outlineFromMindMap(doc, id, forest)).filter((item): item is OutlineItem => !!item);
  return outlineToMarkdown(items, { rootAsHeading: true });
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^(?:[-*+•▪◦‣]|\d+[.)])\s+(.*)$/;
const RULE_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;

/**
 * Parses pasted text (a Markdown list, an indented outline, headings) into a
 * forest. Each line is one item; its parent is the closest line above with
 * less indentation. Headings sit above every bullet (`#` above `##`).
 */
export function parseIndentedText(input: string): OutlineItem[] {
  const roots: OutlineItem[] = [];
  const stack: { indent: number; item: OutlineItem }[] = [];
  for (const raw of input.replace(/\r\n?/g, "\n").split("\n")) {
    const expanded = raw.replace(/\t/g, "    ");
    const content = expanded.trim();
    if (!content || RULE_RE.test(content)) continue;
    let indent = expanded.length - expanded.trimStart().length;
    let text = content;
    const heading = HEADING_RE.exec(content);
    if (heading) {
      indent = -1000 + heading[1].length;
      text = heading[2];
    } else {
      const bullet = BULLET_RE.exec(content);
      if (bullet) text = bullet[1];
    }
    text = decodeText(text);
    if (!text) continue;
    const item: OutlineItem = { text, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.item.children.push(item);
    else roots.push(item);
    stack.push({ indent, item });
  }
  return roots;
}

export function countOutlineItems(items: OutlineItem[]): number {
  let total = 0;
  for (const item of items) total += 1 + countOutlineItems(item.children);
  return total;
}
