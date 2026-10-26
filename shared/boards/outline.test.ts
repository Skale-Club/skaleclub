// Run: npx tsx --test shared/boards/outline.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardEdge, BoardNode } from "../schema/boards.js";
import { createEmptyDocument } from "./document.js";
import { insertOutline } from "./mindOps.js";
import { countOutlineItems, mindMapToMarkdown, outlineFromMindMap, outlineToMarkdown, parseIndentedText, type OutlineItem } from "./outline.js";

const mind = (id: string, text = id, extra: Record<string, unknown> = {}): BoardNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "mind", text, ...extra },
});
const tree = (source: string, target: string): BoardEdge => ({ id: `${source}>${target}`, source, target, kind: "tree" });

// Strip to text/children for comparisons.
const shape = (items: OutlineItem[]): unknown => items.map((item) => [item.text, shape(item.children)]);

test("a mind map exports as a heading and a two-space bullet list", () => {
  const nodes = [mind("r", "Plano Q3"), mind("a", "Ads"), mind("a1", "Google"), mind("a2", "Meta"), mind("b", "SEO\nlocal")];
  const edges = [tree("r", "a"), tree("a", "a1"), tree("a", "a2"), tree("r", "b")];
  assert.equal(
    mindMapToMarkdown({ nodes, edges }, ["r"]),
    ["# Plano Q3", "", "- Ads", "  - Google", "  - Meta", "- SEO<br>local", ""].join("\n"),
  );
});

test("tree -> markdown -> tree round-trips", () => {
  const nodes = [mind("r", "Root"), mind("a", "A"), mind("a1", "A1"), mind("a1x", "A1x"), mind("b", "B line 1\nline 2"), mind("c", "C")];
  const edges = [tree("r", "a"), tree("a", "a1"), tree("a1", "a1x"), tree("r", "b"), tree("r", "c")];
  const original = outlineFromMindMap({ nodes, edges }, "r")!;
  const markdown = outlineToMarkdown([original], { rootAsHeading: true });
  const parsed = parseIndentedText(markdown);
  assert.deepEqual(shape(parsed), shape([original]));

  // ...and back into a document, which exports to the same text.
  const inserted = insertOutline(createEmptyDocument(), parsed, { position: { x: 0, y: 0 } });
  assert.equal(inserted.ids.length, 6);
  assert.equal(mindMapToMarkdown(inserted.doc, [inserted.rootId!]), markdown);
});

test("bullets without a heading round-trip too", () => {
  const items: OutlineItem[] = [
    { text: "One", children: [{ text: "One.a", children: [] }] },
    { text: "Two", children: [] },
  ];
  assert.deepEqual(shape(parseIndentedText(outlineToMarkdown(items))), shape(items));
});

test("pasted text: tabs, other bullets, numbers, plain indented lines and blanks", () => {
  const text = [
    "Marketing",
    "\tAds",
    "\t\t* Google",
    "\t\t+ Meta",
    "",
    "\tSEO",
    "        1. Blog",
    "        2) Local",
    "Sales",
  ].join("\r\n");
  assert.deepEqual(shape(parseIndentedText(text)), [
    ["Marketing", [["Ads", [["Google", []], ["Meta", []]]], ["SEO", [["Blog", []], ["Local", []]]]]],
    ["Sales", []],
  ]);
});

test("headings nest above bullets and below bigger headings", () => {
  const text = "# Plan\n## Ads\n- Google\n- Meta\n## SEO\n- Blog\n---\n";
  assert.deepEqual(shape(parseIndentedText(text)), [["Plan", [["Ads", [["Google", []], ["Meta", []]]], ["SEO", [["Blog", []]]]]]]);
});

test("odd indentation still nests under the closest shallower line", () => {
  const text = "- a\n   - b\n - c\n      - d\n- e";
  assert.deepEqual(shape(parseIndentedText(text)), [["a", [["b", []], ["c", [["d", []]]]]], ["e", []]]);
  assert.equal(countOutlineItems(parseIndentedText(text)), 5);
});

test("collapsed state is read from the map", () => {
  const nodes = [mind("r"), mind("a", "a", { collapsed: true }), mind("a1")];
  const outline = outlineFromMindMap({ nodes, edges: [tree("r", "a"), tree("a", "a1")] }, "r")!;
  assert.equal(outline.children[0].collapsed, true);
});
